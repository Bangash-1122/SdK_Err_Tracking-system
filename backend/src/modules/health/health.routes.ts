import { Router } from 'express';
import { healthController } from './health.controller';
import { asyncHandler } from '@/middleware/errors';
import { sessionMiddleware, requireAuth } from '@/middleware/session.middleware';
import { tenantRbacMiddleware, requireRole } from '@/middleware/tenantRbac.middleware';

export const healthRoutes = Router();

// Liveness probe for Kubernetes / orchestrators
healthRoutes.get('/live', healthController.getLive);

// Readiness probe verifying DB & Redis connectivity
healthRoutes.get('/ready', asyncHandler(healthController.getReady));

// High-level system & memory status
healthRoutes.get('/system-status', healthController.getSystemStatus);

// Admin-only cache diagnostics
healthRoutes.get(
  '/cache-diagnostics',
  sessionMiddleware,
  requireAuth,
  tenantRbacMiddleware,
  requireRole(['Owner', 'Administrator']),
  asyncHandler(healthController.getCacheDiagnostics)
);

