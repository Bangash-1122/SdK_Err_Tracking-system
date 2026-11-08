import { Router } from 'express';
import { alertsController } from './alerts.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import { CreateAlertRuleBodySchema } from '@/contracts/releases-alerts';

const router = Router();

router.use(requireAuth);

router.get('/', alertsController.listAlertRules);

router.post(
  '/',
  requireRole(['Owner', 'Administrator', 'Developer']),
  validateRequest({ body: CreateAlertRuleBodySchema }),
  alertsController.createAlertRule
);

router.get('/:id', alertsController.getAlertRule);

router.patch(
  '/:id',
  requireRole(['Owner', 'Administrator', 'Developer']),
  validateRequest({ body: CreateAlertRuleBodySchema.partial() }),
  alertsController.updateAlertRule
);

router.delete(
  '/:id',
  requireRole(['Owner', 'Administrator']),
  alertsController.deleteAlertRule
);

export const alertsRoutes = router;

