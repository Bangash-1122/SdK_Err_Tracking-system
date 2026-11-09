import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { pool } from './infra/db';
import { redis } from './infra/redis';
import {
  requestIdMiddleware,
  helmetMiddleware,
  corsMiddleware,
  loggerMiddleware,
  sessionMiddleware,
  csrfMiddleware,
  tenantRbacMiddleware,
  notFoundMiddleware,
  errorHandlerMiddleware,
} from './middleware';
import { logger } from './middleware/logger.middleware';

// Domain Module Routes
import { healthRoutes } from './modules/health/health.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { organizationsRoutes } from './modules/organizations/orgs.routes';
import { membersRoutes } from './modules/members/members.routes';
import { projectsRoutes } from './modules/projects/projects.routes';
import { ingestRoutes } from './modules/ingestion/ingest.routes';
import { issuesRoutes } from './modules/issues/issues.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { releasesRoutes } from './modules/releases/releases.routes';
import { exportsRoutes } from './modules/exports/exports.routes';
import { alertsRoutes } from './modules/alerts/alerts.routes';
import { integrationsRoutes } from './modules/integrations/integrations.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { handlePaymentWebhook } from './modules/billing/billing.webhook';
import { realtimeRoutes } from './modules/realtime/realtime.routes';

export function createServer(): Express {
  const app = express();

  // 1. Request ID Injection (Step 1)
  app.use(requestIdMiddleware);

  // 2. Helmet & Strict CORS (Step 2)
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // 3. Structured Pino Logger (Step 3)
  app.use(loggerMiddleware);

  // 4. Raw Body Parser for Payment Webhooks BEFORE global JSON parser (Step 4)
  app.post(
    ['/api/v1/billing/webhook', '/api/v1/webhooks/billing'],
    express.raw({ type: 'application/json' }),
    handlePaymentWebhook
  );

  // Standard Body Parsers & Cookie Parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 5. Session Cookie Authentication (Step 5)
  app.use(sessionMiddleware);

  // 6. CSRF Protection for Session Requests (Step 6)
  app.use(csrfMiddleware);

  // 7. Multi-Tenant Context & RBAC Resolver (Step 7)
  app.use(tenantRbacMiddleware);

  // 8. Mount Domain Modules under /api/v1 (Step 10)
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/organizations', organizationsRoutes);
  app.use('/api/v1/organizations/:orgId/members', membersRoutes);
  app.use('/api/v1/projects', projectsRoutes);
  app.use('/api/v1/events', ingestRoutes);
  app.use('/api/v1/sdk-health', ingestRoutes);
  app.use('/api/v1/issues', issuesRoutes);
  app.use('/api/v1/search', issuesRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/performance', analyticsRoutes);
  app.use('/api/v1/sessions', analyticsRoutes);
  app.use('/api/v1/releases', releasesRoutes);
  app.use('/api/v1/exports', exportsRoutes);
  app.use('/api/v1/alerts', alertsRoutes);
  app.use('/api/v1/integrations', integrationsRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/realtime', realtimeRoutes);

  // 9. 404 Not Found Handler (Step 11)
  app.use(notFoundMiddleware);

  // 10. Universal Error Handler Envelope (Step 12)
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createServer();

// Start HTTP server if executed directly
const isMainModule =
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js') ||
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js');

if (isMainModule && process.env.NODE_ENV !== 'test') {
  const port = env.PORT || 4000;
  const server = app.listen(port, () => {
    logger.info(`⚡ ErrorPulse API Server listening on port ${port} [env=${env.NODE_ENV}]`);
  });

  // Graceful Shutdown Handler for SIGTERM & SIGINT
  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Graceful server shutdown initiated. Closing HTTP server...');

    server.close(async () => {
      logger.info('HTTP server closed. Draining database and cache connections...');
      try {
        await redis.quit();
        await pool.end();
        logger.info('Database pool and Redis connections cleanly closed. Exiting process.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force close after 10s if ongoing requests hang
    setTimeout(() => {
      logger.error('Forced shutdown timeout reached. Terminating process.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
