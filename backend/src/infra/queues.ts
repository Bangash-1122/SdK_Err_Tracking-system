import { Queue, DefaultJobOptions } from 'bullmq';
import { createRedisConnection } from './redis';

const defaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s, 8s, 16s...
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

// Priority-Isolated BullMQ Queues
export const outboxRelayQueue = new Queue('q-outbox-relay', {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const alertsQueue = new Queue('q-alerts', {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const webhooksQueue = new Queue('q-webhooks', {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const emailQueue = new Queue('q-email', {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const analyticsRollupQueue = new Queue('q-analytics-rollup', {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const retentionQueue = new Queue('q-retention', {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const allQueues = [
  outboxRelayQueue,
  alertsQueue,
  webhooksQueue,
  emailQueue,
  analyticsRollupQueue,
  retentionQueue,
];

export async function closeAllQueues(): Promise<void> {
  await Promise.all(allQueues.map((q) => q.close()));
}

