import { Router } from 'express';
import { realtimeController } from './realtime.controller';
import { requireAuth } from '@/middleware/session.middleware';

const router = Router();

router.use(requireAuth);

router.get('/issues', realtimeController.streamIssues);
router.get('/', realtimeController.streamIssues);

export const realtimeRoutes = router;

