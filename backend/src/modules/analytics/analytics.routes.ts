import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { requireAuth } from '@/middleware/session.middleware';
import { validateRequest } from '@/middleware/validate.middleware';
import { AnalyticsQuerySchema } from '@/contracts/analytics-billing';

const router = Router();

router.use(requireAuth);

router.get(
  '/stats',
  validateRequest({ query: AnalyticsQuerySchema }),
  analyticsController.getStats
);

router.get(
  '/performance',
  validateRequest({ query: AnalyticsQuerySchema }),
  analyticsController.getPerformance
);

router.get(
  '/sessions',
  validateRequest({ query: AnalyticsQuerySchema }),
  analyticsController.getSessions
);

export const analyticsRoutes = router;
