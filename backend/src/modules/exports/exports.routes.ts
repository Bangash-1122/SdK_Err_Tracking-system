import { Router } from 'express';
import { z } from 'zod';
import { exportsController } from './exports.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';
import { validateRequest } from '@/middleware/validate.middleware';

const router = Router();

const ExportBodySchema = z.object({
  projectId: z.string().optional(),
  type: z.enum(['events', 'issues']).default('events').optional(),
  format: z.enum(['json', 'csv']).default('json').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

router.use(requireAuth);

router.post(
  '/',
  requireRole(['Owner', 'Administrator', 'Developer']),
  validateRequest({ body: ExportBodySchema }),
  exportsController.exportTelemetry
);

export const exportsRoutes = router;

