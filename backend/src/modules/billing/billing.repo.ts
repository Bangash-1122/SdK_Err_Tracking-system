import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import {
  subscriptions,
  invoices,
  projects,
  webhookInbox,
} from '@/db/schema';
import { SubscriptionTier, SubscriptionStatus } from '@/contracts/analytics-billing';

export class BillingRepository {
  async getSubscriptionByOrg(organizationId: string) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .limit(1);

    return sub || null;
  }

  async calculateTotalEventUsage(organizationId: string): Promise<number> {
    const [result] = await db
      .select({
        total: sql<number>`coalesce(sum(${projects.eventCount}), 0)::int`,
      })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    return result ? Number(result.total) : 0;
  }

  async listInvoicesByOrg(organizationId: string) {
    return db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .orderBy(desc(invoices.createdAt));
  }

  async findInvoiceById(invoiceId: string) {
    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    return inv || null;
  }

  async updateSubscription(
    organizationId: string,
    data: {
      tier?: SubscriptionTier;
      status?: SubscriptionStatus;
      eventAllowance?: number;
      stripeSubscriptionId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    }
  ) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        ...(data.tier && { tier: data.tier }),
        ...(data.status && { status: data.status }),
        ...(data.eventAllowance !== undefined && { eventAllowance: data.eventAllowance }),
        ...(data.stripeSubscriptionId && { stripeSubscriptionId: data.stripeSubscriptionId }),
        ...(data.currentPeriodStart && { currentPeriodStart: data.currentPeriodStart }),
        ...(data.currentPeriodEnd && { currentPeriodEnd: data.currentPeriodEnd }),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.organizationId, organizationId))
      .returning();

    return updated || null;
  }

  async recordWebhookEvent(data: {
    source: string;
    eventId: string;
    payload: Record<string, unknown>;
  }) {
    const [record] = await db
      .insert(webhookInbox)
      .values({
        source: data.source,
        eventId: data.eventId,
        payload: data.payload,
        status: 'pending',
      })
      .returning();

    return record;
  }
}

export const billingRepository = new BillingRepository();

