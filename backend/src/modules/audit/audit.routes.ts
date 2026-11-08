import { Router } from 'express';
import { auditController } from './audit.controller';
import { asyncHandler } from '@/middleware/errors';
import { sessionMiddleware, requireAuth } from '@/middleware/session.middleware';
import { tenantRbacMiddleware, requireRole } from '@/middleware/tenantRbac.middleware';

export const auditRoutes = Router();

// GET /api/v1/audit (Admin & Owner access)
auditRoutes.get(
  '/',
  sessionMiddleware,
  requireAuth,
  tenantRbacMiddleware,
  requireRole(['Owner', 'Administrator']),
  asyncHandler(auditController.listAuditLogs)
);

