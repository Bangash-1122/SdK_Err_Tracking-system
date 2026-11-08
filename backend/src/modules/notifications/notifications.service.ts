import { notificationsRepository } from './notifications.repo';
import { AppError } from '@/middleware/errors';

export class NotificationsService {
  async listNotifications(projectId: string, limit: number = 50) {
    return notificationsRepository.listByProject(projectId, limit);
  }

  async markAsRead(notificationId: string) {
    const updated = await notificationsRepository.markAsRead(notificationId);
    if (!updated) {
      throw AppError.notFound('Notification not found');
    }
    return updated;
  }
}

export const notificationsService = new NotificationsService();

