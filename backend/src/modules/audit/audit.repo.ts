import { eq, desc, and, lt } from 'drizzle-orm';
import { db } from '@/infra/db';
import { auditLogs } from '@/db/schema';

export interface CreateAuditLogParams {
  organizationId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListAuditLogsOptions {
  limit?: number;
  cursor?: string; // createdAt timestamp ISO or ID for pagination
}

export class AuditRepository {
  async insert(params: CreateAuditLogParams) {
    const [inserted] = await db
      .insert(auditLogs)
      .values({
        organizationId: params.organizationId,
        userId: params.userId || null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata || {},
      })
      .returning();

    return inserted;
  }

  async findByOrganization(orgId: string, options: ListAuditLogsOptions = {}) {
    const limit = Math.min(options.limit || 20, 100);

    const conditions = [eq(auditLogs.organizationId, orgId)];

    if (options.cursor) {
      conditions.push(lt(auditLogs.createdAt, new Date(options.cursor)));
    }

    const items = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.createdAt.toISOString() : null;
    }

    return { items, nextCursor };
  }
}

export const auditRepository = new AuditRepository();

