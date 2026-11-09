import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/infra/db';
import { notifications } from '@/db/schema';
import { createRedisConnection } from '@/infra/redis';
import { sendEmail } from '@/infra/mailer';
import { logger } from '@/middleware/logger.middleware';

export interface EmailJobData {
  notificationId?: string;
  to: string | string[];
  subject: string;
  payload: {
    ruleName?: string;
    title?: string;
    severity?: string;
    environment?: string;
    target?: string;
    triggeredAt?: string;
    [key: string]: unknown;
  };
}

export class EmailDeliveryWorker {
  private worker: Worker | null = null;

  start(): void {
    logger.info('Starting EmailDelivery worker...');

    this.worker = new Worker(
      'q-email',
      async (job: Job<EmailJobData>) => {
        await this.deliver(job.data);
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Email delivery job failed');
    });
  }

  async deliver(data: EmailJobData): Promise<void> {
    const { notificationId, to, subject, payload } = data;

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #e53e3e;">[ErrorPulse Alert] ${payload.ruleName || 'Incident Alert'}</h2>
        <p><strong>Title:</strong> ${payload.title || 'Uncaught Exception'}</p>
        <p><strong>Severity:</strong> <span style="text-transform: uppercase; font-weight: bold;">${payload.severity || 'high'}</span></p>
        <p><strong>Environment:</strong> ${payload.environment || 'production'}</p>
        <p><strong>Triggered At:</strong> ${payload.triggeredAt || new Date().toISOString()}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">You are receiving this notification because an alert condition was met in ErrorPulse.</p>
      </div>
    `;

    const text = `[ErrorPulse Alert] ${payload.ruleName || 'Incident Alert'}\nTitle: ${payload.title}\nSeverity: ${payload.severity}\nEnvironment: ${payload.environment}\nTriggered At: ${payload.triggeredAt}`;

    try {
      const result = await sendEmail({
        to,
        subject,
        html,
        text,
      });

      if (notificationId) {
        await db
          .update(notifications)
          .set({
            status: result.success ? 'delivered' : 'failed',
            sentAt: result.success ? new Date() : null,
          })
          .where(eq(notifications.id, notificationId));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send email';
      logger.error({ err, to }, 'Failed to deliver transactional alert email');

      if (notificationId) {
        await db
          .update(notifications)
          .set({ status: 'failed', errorMessage })
          .where(eq(notifications.id, notificationId));
      }

      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    logger.info('EmailDelivery worker stopped cleanly');
  }
}

export const emailDeliveryWorker = new EmailDeliveryWorker();

