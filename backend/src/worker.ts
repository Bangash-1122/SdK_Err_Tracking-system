import { outboxRelayWorker } from './workers/outboxRelay.worker';
import { alertsEvaluationWorker } from './workers/alertsEvaluation.worker';
import { webhookDispatchWorker } from './workers/webhookDispatch.worker';
import { emailDeliveryWorker } from './workers/emailDelivery.worker';
import { analyticsRollupWorker } from './workers/analyticsRollup.worker';
import { retentionCleanupWorker } from './workers/retentionCleanup.worker';
import { closeAllQueues } from './infra/queues';
import { pool } from './infra/db';
import { redis } from './infra/redis';
import { logger } from './middleware/logger.middleware';

async function bootstrapWorkers(): Promise<void> {
  logger.info('Initializing ErrorPulse background workers...');

  // 1. Start all workers and pollers
  outboxRelayWorker.start();
  alertsEvaluationWorker.start();
  webhookDispatchWorker.start();
  emailDeliveryWorker.start();
  analyticsRollupWorker.start();
  retentionCleanupWorker.start();

  logger.info('🚀 All background workers and schedulers are actively running.');

  // 2. Register Graceful Shutdown Handler for SIGTERM & SIGINT
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Graceful shutdown initiated. Draining workers and active jobs...');

    try {
      // Stop accepting new jobs and stop pollers
      await Promise.allSettled([
        outboxRelayWorker.stop(),
        alertsEvaluationWorker.stop(),
        webhookDispatchWorker.stop(),
        emailDeliveryWorker.stop(),
        analyticsRollupWorker.stop(),
        retentionCleanupWorker.stop(),
      ]);

      // Close all BullMQ queues
      await closeAllQueues();

      // Disconnect Redis client
      await redis.quit();

      // Drain PostgreSQL connection pool
      await pool.end();

      logger.info('Clean shutdown completed successfully. Exiting worker process.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error occurred during graceful worker shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

bootstrapWorkers().catch((err) => {
  logger.fatal({ err }, 'Fatal error during worker bootstrap');
  process.exit(1);
});
