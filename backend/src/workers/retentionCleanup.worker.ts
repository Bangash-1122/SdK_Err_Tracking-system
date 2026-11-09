import { Worker, Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import { projectSettings } from '@/db/schema';
import { createRedisConnection } from '@/infra/redis';
import { logger } from '@/middleware/logger.middleware';

export class RetentionCleanupWorker {
  private worker: Worker | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  start(intervalMs = 3600000): void {
    logger.info('Starting RetentionCleanup worker and scheduler (1-hour interval)...');

    // 1. BullMQ Worker for on-demand triggers
    this.worker = new Worker(
      'q-retention',
      async (job: Job) => {
        logger.info({ jobId: job.id }, 'Executing retention and auto-resolve sweep');
        await this.runCleanup();
      },
      {
        connection: createRedisConnection(),
        concurrency: 1,
      }
    );

    // 2. Periodic scheduled sweep (default: every 1 hour)
    this.intervalTimer = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (err) {
        logger.error({ err }, 'Error during scheduled retention cleanup sweep');
      }
    }, intervalMs);
  }

  async runCleanup(): Promise<void> {
    await this.autoResolveInactiveIssues();
    await this.pruneExpiredEvents();
    await this.pruneProcessedOutbox();
  }

  /**
   * Section H: Auto-Resolve Inactive Issues
   * Resolves issues that have not received new events within autoResolveInactiveDays
   */
  async autoResolveInactiveIssues(): Promise<number> {
    const settingsList = await db.select().from(projectSettings);
    let totalResolved = 0;

    for (const settings of settingsList) {
      const days = settings.autoResolveInactiveDays;
      if (!days || days <= 0) continue;

      const result = await db.execute(sql`
        UPDATE issues
        SET status = 'resolved', updated_at = NOW()
        WHERE project_id = ${settings.projectId}
          AND status = 'unresolved'
          AND last_seen < NOW() - make_interval(days => ${days})
      `);

      const affected = Number(result.rowCount || 0);
      if (affected > 0) {
        logger.info({ projectId: settings.projectId, affected, days }, 'Auto-resolved inactive issues');
        totalResolved += affected;
      }
    }

    return totalResolved;
  }

  /**
   * Section G: Telemetry Retention Pruning
   * Prunes events older than telemetryRetentionDays
   */
  async pruneExpiredEvents(): Promise<number> {
    const settingsList = await db.select().from(projectSettings);
    let totalPruned = 0;

    for (const settings of settingsList) {
      const days = settings.telemetryRetentionDays || 30;

      const result = await db.execute(sql`
        DELETE FROM events
        WHERE project_id = ${settings.projectId}
          AND timestamp < NOW() - make_interval(days => ${days})
      `);

      totalPruned += Number(result.rowCount || 0);
    }

    return totalPruned;
  }

  /**
   * Prunes completed outbox entries older than 7 days
   */
  async pruneProcessedOutbox(): Promise<number> {
    const result = await db.execute(sql`
      DELETE FROM outbox
      WHERE status IN ('completed', 'failed')
        AND created_at < NOW() - INTERVAL '7 days'
    `);

    return Number(result.rowCount || 0);
  }

  async stop(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    logger.info('RetentionCleanup worker stopped cleanly');
  }
}

export const retentionCleanupWorker = new RetentionCleanupWorker();

