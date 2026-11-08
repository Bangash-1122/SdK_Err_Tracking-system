import { eq, and } from 'drizzle-orm';
import { db } from '@/infra/db';
import { integrations, deliveryAttempts } from '@/db/schema';

export class IntegrationsRepository {
  async createIntegration(data: {
    organizationId: string;
    type: string;
    config: Record<string, unknown>;
  }) {
    const [created] = await db
      .insert(integrations)
      .values({
        organizationId: data.organizationId,
        type: data.type,
        config: data.config,
        isActive: true,
      })
      .returning();

    return created;
  }

  async listByOrg(organizationId: string) {
    return db
      .select()
      .from(integrations)
      .where(eq(integrations.organizationId, organizationId));
  }

  async findById(id: string) {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .limit(1);

    return integration || null;
  }

  async updateIntegration(
    id: string,
    data: { config?: Record<string, unknown>; isActive?: boolean }
  ) {
    const [updated] = await db
      .update(integrations)
      .set({
        ...(data.config && { config: data.config }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning();

    return updated || null;
  }

  async deleteIntegration(id: string) {
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  async recordDeliveryAttempt(data: {
    targetType: string;
    targetId: string;
    attemptNumber: number;
    status: 'success' | 'failed';
    statusCode?: number;
    responseBody?: string;
  }) {
    const [attempt] = await db
      .insert(deliveryAttempts)
      .values({
        targetType: data.targetType,
        targetId: data.targetId,
        attemptNumber: data.attemptNumber,
        status: data.status,
        statusCode: data.statusCode || null,
        responseBody: data.responseBody || null,
      })
      .returning();

    return attempt;
  }
}

export const integrationsRepository = new IntegrationsRepository();

