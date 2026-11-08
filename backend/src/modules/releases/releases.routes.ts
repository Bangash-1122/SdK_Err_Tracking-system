import { Router } from 'express';
import { releasesController } from './releases.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import {
  CreateReleaseBodySchema,
  PresignSourceMapBodySchema,
} from '@/contracts/releases-alerts';

const router = Router();

router.use(requireAuth);

router.get('/', releasesController.listReleases);

router.post(
  '/',
  requireRole(['Owner', 'Administrator', 'Developer']),
  validateRequest({ body: CreateReleaseBodySchema }),
  releasesController.createRelease
);

router.post(
  '/sourcemaps/presign',
  requireRole(['Owner', 'Administrator', 'Developer']),
  validateRequest({ body: PresignSourceMapBodySchema }),
  releasesController.presignSourceMap
);

export const releasesRoutes = router;
