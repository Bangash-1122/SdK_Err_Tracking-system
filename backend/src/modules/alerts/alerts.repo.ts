import { eq, desc } from 'drizzle-orm';
import { db } from '@/infra/db';
import { alertRules } from '@/db/schema';
import { CreateAlertRuleBody } from '@/contracts/releases-alerts';

export class AlertsRepository {
  async createAlertRule(projectId: string, data: CreateAlertRuleBody) {
    const [created] = await db
      .insert(alertRules)
      .values({
        projectId,
        name: data.name,
        enabled: data.enabled ?? true,
        conditions: data.conditions,
        actions: data.actions,
      })
      .returning();

    return created;
  }

  async listAlertRules(projectId: string) {
    return db
      .select()
      .from(alertRules)
      .where(eq(alertRules.projectId, projectId))
      .orderBy(desc(alertRules.createdAt));
  }

  async findById(id: string) {
    const [rule] = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, id))
      .limit(1);

    return rule || null;
  }

  async updateAlertRule(id: string, data: Partial<CreateAlertRuleBody>) {
    const [updated] = await db
      .update(alertRules)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.conditions && { conditions: data.conditions }),
        ...(data.actions && { actions: data.actions }),
        updatedAt: new Date(),
      })
      .where(eq(alertRules.id, id))
      .returning();

    return updated || null;
  }

  async deleteAlertRule(id: string) {
    await db.delete(alertRules).where(eq(alertRules.id, id));
  }
}

export const alertsRepository = new AlertsRepository();
