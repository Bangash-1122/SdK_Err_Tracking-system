import { Router } from 'express';
import { z } from 'zod';
import { projectsController } from './projects.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import { CreateProjectBodySchema } from '@/contracts/project';
import { UpdateProjectSettingsBodySchema } from '@/contracts/settings';

const router = Router();

const UpdateProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  platform: z.string().optional(),
});

router.use(requireAuth);

router.get('/', projectsController.listProjects);

router.post(
  '/',
  requireRole(['Owner', 'Administrator', 'Developer']),
  validateRequest({ body: CreateProjectBodySchema }),
  projectsController.createProject
);

router.get('/:projectId', projectsController.getProject);

router.patch(
  '/:projectId',
  requireRole(['Owner', 'Administrator']),
  validateRequest({ body: UpdateProjectBodySchema }),
  projectsController.updateProject
);

router.post(
  '/:projectId/keys/rotate',
  requireRole(['Owner', 'Administrator']),
  projectsController.rotateKey
);

router.delete(
  '/:projectId',
  requireRole(['Owner']),
  projectsController.deleteProject
);

router.get('/:projectId/settings', projectsController.getSettings);

router.patch(
  '/:projectId/settings',
  requireRole(['Owner', 'Administrator']),
  validateRequest({
    body: UpdateProjectSettingsBodySchema.extend({
      version: z.number().int().positive().optional(),
    }),
  }),
  projectsController.updateSettings
);

export const projectsRoutes = router;

