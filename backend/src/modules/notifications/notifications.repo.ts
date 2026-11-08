import { eq, desc } from 'drizzle-orm';
import { db } from '@/infra/db';
import { notifications } from '@/db/schema';

export class NotificationsRepository {
  async listByProject(projectId: string, limit: number = 50) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.projectId, projectId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markAsRead(notificationId: string) {
    const [updated] = await db
      .update(notifications)
      .set({
        status: 'delivered',
        sentAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updated || null;
  }

  async createNotification(data: {
    projectId: string;
    alertRuleId?: string;
    channel: string;
    payload: Record<string, unknown>;
  }) {
    const [created] = await db
      .insert(notifications)
      .values({
        projectId: data.projectId,
        alertRuleId: data.alertRuleId || null,
        channel: data.channel,
        status: 'pending',
        payload: data.payload,
      })
      .returning();

    return created;
  }
}

export const notificationsRepository = new NotificationsRepository();
