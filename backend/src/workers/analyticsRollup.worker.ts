import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/infra/db';
import { exportJobs } from '@/db/schema';
import { createRedisConnection, invalidateByTag } from '@/infra/redis';
import { generatePresignedDownloadUrl } from '@/infra/objectStorage';
import { env } from '@/config/env';
import { logger } from '@/middleware/logger.middleware';

export interface RollupJobData {
  topic?: string;
  payload?: {
    projectId?: string;
    organizationId?: string;
    [key: string]: unknown;
  };
  exportJobId?: string;
  storageKey?: string;
}

export class AnalyticsRollupWorker {
  private worker: Worker | null = null;

  start(): void {
    logger.info('Starting AnalyticsRollup worker...');

    this.worker = new Worker(
      'q-analytics-rollup',
      async (job: Job<RollupJobData>) => {
        if (job.name === 'export-job' && job.data.exportJobId && job.data.storageKey) {
          await this.processExportJob(job.data.exportJobId, job.data.storageKey);
        } else {
          await this.processRollup(job.data);
        }
      },
      {
        connection: createRedisConnection(),
        concurrency: 5,
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Analytics rollup job failed');
    });
  }

  private async processRollup(data: RollupJobData): Promise<void> {
    const projectId = data.payload?.projectId;
    if (projectId) {
      // Invalidate cached stats so subsequent dashboard requests retrieve fresh telemetry
      await invalidateByTag(`project:${projectId}`);
    }
  }

  private async processExportJob(exportJobId: string, storageKey: string): Promise<void> {
    logger.info({ exportJobId, storageKey }, 'Processing background telemetry export completion');

    const downloadUrl = await generatePresignedDownloadUrl({
      key: storageKey,
      bucket: env.S3_BUCKET_NAME,
      expiresInSeconds: 86400, // 24 hours
    });

    const expiresAt = new Date(Date.now() + 86400 * 1000);

    await db
      .update(exportJobs)
      .set({
        status: 'completed',
        downloadUrl,
        expiresAt,
        completedAt: new Date(),
      })
      .where(eq(exportJobs.id, exportJobId));
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    logger.info('AnalyticsRollup worker stopped cleanly');
  }
}

export const analyticsRollupWorker = new AnalyticsRollupWorker();
