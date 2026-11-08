import { Router } from 'express';
import { z } from 'zod';
import { organizationsController } from './orgs.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import { OrgSettingsSchema } from '@/contracts/organization';

const router = Router();

const UpdateOrgBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const UpdateOrgSettingsBodySchema = OrgSettingsSchema.partial();

// All organization routes require authentication
router.use(requireAuth);

router.get('/:orgId?', organizationsController.getOrganization);

router.patch(
  '/:orgId?',
  requireRole(['Owner', 'Administrator']),
  validateRequest({ body: UpdateOrgBodySchema }),
  organizationsController.updateOrganization
);

router.get('/:orgId/settings', organizationsController.getSettings);

router.patch(
  '/:orgId/settings',
  requireRole(['Owner', 'Administrator']),
  validateRequest({ body: UpdateOrgSettingsBodySchema }),
  organizationsController.updateSettings
);

export const organizationsRoutes = router;

