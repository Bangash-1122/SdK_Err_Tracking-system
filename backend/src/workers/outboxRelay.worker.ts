import { Worker, Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import { outbox } from '@/db/schema';
import { createRedisConnection, redis } from '@/infra/redis';
import {
  alertsQueue,
  analyticsRollupQueue,
} from '@/infra/queues';
import { logger } from '@/middleware/logger.middleware';

export interface OutboxRecord extends Record<string, unknown> {
  id: string;
  dedupeKey: string;
  topic: string;
  payload: Record<string, unknown>;
  retryCount: number;
}

export class OutboxRelayWorker {
  private isPolling = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private bullWorker: Worker | null = null;

  start(pollIntervalMs = 2000): void {
    logger.info('Starting OutboxRelay worker and poller...');

    // 1. BullMQ Worker for on-demand outbox triggers
    this.bullWorker = new Worker(
      'q-outbox-relay',
      async (job: Job) => {
        logger.debug({ jobId: job.id }, 'Processing on-demand outbox relay job');
        await this.pollAndDispatch();
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      }
    );

    // 2. Continuous interval polling with FOR UPDATE SKIP LOCKED
    this.intervalTimer = setInterval(async () => {
      await this.pollAndDispatch();
    }, pollIntervalMs);
  }

  async pollAndDispatch(): Promise<number> {
    if (this.isPolling) return 0;
    this.isPolling = true;

    let processedCount = 0;

    try {
      await db.transaction(async (tx) => {
        // Query pending records with SKIP LOCKED for high-concurrency multi-worker safety
        const pendingRecords = await tx.execute<OutboxRecord>(sql`
          SELECT id, dedupe_key as "dedupeKey", topic, payload, retry_count as "retryCount"
          FROM outbox
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `);

        const rows = pendingRecords.rows || [];
        if (rows.length === 0) {
          return;
        }

        for (const record of rows) {
          try {
            await this.dispatchRecord(record);

            // Mark completed
            await tx.execute(sql`
              UPDATE outbox
              SET status = 'completed', processed_at = NOW()
              WHERE id = ${record.id}
            `);

            processedCount++;
          } catch (err) {
            const newRetryCount = (record.retryCount || 0) + 1;
            const newStatus = newRetryCount >= 5 ? 'failed' : 'pending';

            logger.error(
              { err, recordId: record.id, retryCount: newRetryCount, newStatus },
              'Failed to dispatch outbox record'
            );

            await tx.execute(sql`
              UPDATE outbox
              SET retry_count = ${newRetryCount}, status = ${newStatus}
              WHERE id = ${record.id}
            `);
          }
        }
      });
    } catch (err) {
      logger.error({ err }, 'Error during outbox poll transaction');
    } finally {
      this.isPolling = false;
    }

    return processedCount;
  }

  private async dispatchRecord(record: OutboxRecord): Promise<void> {
    const { topic, payload, dedupeKey } = record;

    // 1. Publish to Redis for SSE Realtime Streaming
    try {
      const channel = `realtime:events:${payload.organizationId || payload.projectId || 'global'}`;
      await redis.publish(
        channel,
        JSON.stringify({
          topic,
          payload,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to publish event to Redis realtime channel');
    }

    // 2. Route by topic to background queues
    if (topic === 'event.ingested' || topic === 'issue.regression' || topic === 'issue.new') {
      await alertsQueue.add(
        'evaluate-alerts',
        {
          topic,
          payload,
        },
        { jobId: `alert_${dedupeKey}` }
      );

      await analyticsRollupQueue.add(
        'event-rollup',
        {
          topic,
          payload,
        },
        { jobId: `rollup_${dedupeKey}` }
      );
    }
  }

  async stop(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.bullWorker) {
      await this.bullWorker.close();
      this.bullWorker = null;
    }
    logger.info('OutboxRelay worker stopped cleanly');
  }
}

export const outboxRelayWorker = new OutboxRelayWorker();
