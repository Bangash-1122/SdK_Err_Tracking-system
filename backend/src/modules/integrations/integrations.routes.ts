import { Router } from 'express';
import { integrationsController } from './integrations.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', integrationsController.listIntegrations);

router.post(
  '/',
  requireRole(['Owner', 'Administrator']),
  integrationsController.createIntegration
);

router.post(
  '/:id/test',
  requireRole(['Owner', 'Administrator']),
  integrationsController.testDelivery
);

router.delete(
  '/:id',
  requireRole(['Owner', 'Administrator']),
  integrationsController.deleteIntegration
);

export const integrationsRoutes = router;

