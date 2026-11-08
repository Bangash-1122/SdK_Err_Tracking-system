import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { requireAuth } from '@/middleware/session.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', notificationsController.listNotifications);
router.patch('/:id/read', notificationsController.markAsRead);

export const notificationsRoutes = router;
