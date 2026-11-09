import { Worker, Job } from 'bullmq';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { eq } from 'drizzle-orm';
import { db } from '@/infra/db';
import { deliveryAttempts, notifications } from '@/db/schema';
import { createRedisConnection } from '@/infra/redis';
import { env } from '@/config/env';
import { logger } from '@/middleware/logger.middleware';

export interface WebhookJobData {
  notificationId?: string;
  channel: string;
  targetUrl: string;
  payload: Record<string, unknown>;
  secret?: string;
}

/**
 * Validates target URL against SSRF (Server-Side Request Forgery) attacks
 * Blocks private IP ranges, loopback, link-local, and cloud metadata endpoints.
 */
export async function validateSafeUrl(urlString: string): Promise<boolean> {
  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block obvious loopback/local names
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal'
    ) {
      return false;
    }

    // Resolve DNS address
    const { address } = await dns.lookup(hostname);

    // Private IPv4 ranges
    if (
      address.startsWith('127.') || // Loopback
      address.startsWith('10.') || // Class A private
      address.startsWith('192.168.') || // Class C private
      address.startsWith('169.254.') || // Link-local
      address === '0.0.0.0'
    ) {
      return false;
    }

    // Class B private: 172.16.0.0 to 172.31.255.255
    const parts = address.split('.').map(Number);
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      return false;
    }

    // IPv6 private/loopback
    if (
      address === '::1' ||
      address.startsWith('fc') ||
      address.startsWith('fd') ||
      address.startsWith('fe80')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export class WebhookDispatchWorker {
  private worker: Worker | null = null;

  start(): void {
    logger.info('Starting WebhookDispatch worker with SSRF protection...');

    this.worker = new Worker(
      'q-webhooks',
      async (job: Job<WebhookJobData>) => {
        await this.dispatch(job.data, job.attemptsMade + 1);
      },
      {
        connection: createRedisConnection(),
        concurrency: 10,
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Webhook dispatch job failed');
    });
  }

  async dispatch(data: WebhookJobData, attemptNumber = 1): Promise<void> {
    const { notificationId, targetUrl, payload, secret = env.SESSION_SECRET } = data;

    // 1. SSRF Guard
    const isSafe = await validateSafeUrl(targetUrl);
    if (!isSafe) {
      logger.warn({ targetUrl }, 'Blocked potentially unsafe SSRF destination URL');
      if (notificationId) {
        await db
          .update(notifications)
          .set({ status: 'failed', errorMessage: 'Destination URL blocked by SSRF protection' })
          .where(eq(notifications.id, notificationId));
      }
      return;
    }

    // 2. Sign Payload (HMAC-SHA256)
    const bodyStr = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest('hex');

    let status: 'success' | 'failed' = 'failed';
    let statusCode: number | null = null;
    let responseText = '';

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ErrorPulse-Webhook-Dispatcher/1.0',
          'X-ErrorPulse-Signature': `sha256=${signature}`,
          'X-ErrorPulse-Timestamp': timestamp,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      statusCode = response.status;
      responseText = await response.text();
      status = response.ok ? 'success' : 'failed';
    } catch (err: unknown) {
      responseText = err instanceof Error ? err.message : 'Unknown network failure';
      status = 'failed';
    }

    // 3. Record delivery attempt in delivery_attempts
    if (notificationId) {
      await db.insert(deliveryAttempts).values({
        targetType: 'webhook',
        targetId: notificationId,
        attemptNumber,
        status,
        statusCode: statusCode || null,
        responseBody: responseText.substring(0, 2048),
      });

      // Update notification record
      await db
        .update(notifications)
        .set({
          status: status === 'success' ? 'delivered' : 'failed',
          errorMessage: status === 'failed' ? responseText.substring(0, 500) : null,
          sentAt: status === 'success' ? new Date() : null,
        })
        .where(eq(notifications.id, notificationId));
    }

    if (status === 'failed') {
      throw new Error(`Webhook dispatch failed with HTTP ${statusCode}: ${responseText}`);
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    logger.info('WebhookDispatch worker stopped cleanly');
  }
}

export const webhookDispatchWorker = new WebhookDispatchWorker();
