import { Worker, Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db } from '@/infra/db';
import { alertRules, notifications } from '@/db/schema';
import { createRedisConnection, redis } from '@/infra/redis';
import { emailQueue, webhooksQueue } from '@/infra/queues';
import { logger } from '@/middleware/logger.middleware';

export interface AlertEvaluationPayload {
  topic: string;
  payload: {
    projectId: string;
    issueId?: string;
    eventId?: string;
    isNewIssue?: boolean;
    isRegression?: boolean;
    fingerprint?: string;
    title?: string;
    severity?: string;
    environment?: string;
    release?: string | null;
  };
}

export class AlertsEvaluationWorker {
  private worker: Worker | null = null;

  start(): void {
    logger.info('Starting AlertsEvaluation worker...');

    this.worker = new Worker(
      'q-alerts',
      async (job: Job<AlertEvaluationPayload>) => {
        await this.evaluate(job.data);
      },
      {
        connection: createRedisConnection(),
        concurrency: 10,
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Alerts evaluation job failed');
    });
  }

  async evaluate(data: AlertEvaluationPayload): Promise<void> {
    const { projectId, issueId, isNewIssue, isRegression, title, severity, environment } = data.payload;

    if (!projectId) return;

    // 1. Fetch enabled alert rules for project
    const rules = await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.projectId, projectId), eq(alertRules.enabled, true)));

    if (rules.length === 0) return;

    for (const rule of rules) {
      const conditions = (rule.conditions as Array<{
        metric: string;
        operator: string;
        threshold: number;
        windowMinutes?: number;
      }>) || [];

      // Evaluate conditions
      let matched = false;
      for (const cond of conditions) {
        if (cond.metric === 'new_issue' && (isNewIssue || isRegression)) {
          matched = true;
          break;
        }
        if (cond.metric === 'error_count') {
          // Trigger when error threshold met (default matches single critical/high events)
          if (severity === 'critical' || severity === 'high') {
            matched = true;
            break;
          }
        }
      }

      if (!matched) continue;

      // 2. Throttle / Quiet Hours Check (avoid alert fatigue)
      const throttleKey = `alert:throttle:${rule.id}:${issueId || 'project'}`;
      const isThrottled = await redis.get(throttleKey);
      if (isThrottled) {
        logger.debug({ ruleId: rule.id, issueId }, 'Alert throttled during quiet period');
        continue;
      }

      // Set throttle for 30 minutes (1800 seconds)
      await redis.set(throttleKey, '1', 'EX', 1800);

      // 3. Dispatch actions
      const actions = (rule.actions as Array<{
        integrationType: string;
        target: string;
      }>) || [];

      for (const action of actions) {
        const notificationPayload = {
          ruleId: rule.id,
          ruleName: rule.name,
          projectId,
          issueId,
          title,
          severity,
          environment,
          target: action.target,
          triggeredAt: new Date().toISOString(),
        };

        // Record notification in DB
        const [savedNotification] = await db
          .insert(notifications)
          .values({
            projectId,
            alertRuleId: rule.id,
            channel: action.integrationType,
            status: 'pending',
            payload: notificationPayload,
          })
          .returning();

        // Enqueue to destination worker
        if (action.integrationType === 'email') {
          await emailQueue.add('send-alert-email', {
            notificationId: savedNotification.id,
            to: action.target,
            subject: `[ErrorPulse Alert] ${rule.name}: ${title}`,
            payload: notificationPayload,
          });
        } else if (
          action.integrationType === 'slack' ||
          action.integrationType === 'webhook' ||
          action.integrationType === 'github'
        ) {
          await webhooksQueue.add('dispatch-webhook', {
            notificationId: savedNotification.id,
            channel: action.integrationType,
            targetUrl: action.target,
            payload: notificationPayload,
          });
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    logger.info('AlertsEvaluation worker stopped cleanly');
  }
}

export const alertsEvaluationWorker = new AlertsEvaluationWorker();

