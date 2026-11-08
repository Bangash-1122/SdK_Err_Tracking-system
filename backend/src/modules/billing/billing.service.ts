import { billingRepository } from './billing.repo';
import {
  SubscriptionDto,
  InvoiceDto,
  SubscriptionTier,
  SubscriptionStatus,
} from '@/contracts/analytics-billing';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';

const TIER_ALLOWANCES: Record<SubscriptionTier, number> = {
  free: 50000,
  pro: 500000,
  team: 2500000,
  enterprise: 10000000,
};

export class BillingService {
  async getSubscription(organizationId: string): Promise<SubscriptionDto> {
    const sub = await billingRepository.getSubscriptionByOrg(organizationId);
    if (!sub) {
      throw AppError.notFound('Subscription not found for this organization');
    }

    const eventUsage = await billingRepository.calculateTotalEventUsage(organizationId);

    return {
      id: sub.id,
      organizationId: sub.organizationId,
      tier: sub.tier as SubscriptionTier,
      status: sub.status as SubscriptionStatus,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      eventAllowance: sub.eventAllowance,
      eventUsage,
    };
  }

  async createCheckoutSession(
    organizationId: string,
    tier: SubscriptionTier,
    successUrl: string,
    cancelUrl: string,
    actorId: string
  ) {
    if (!['pro', 'team', 'enterprise'].includes(tier)) {
      throw AppError.badRequest('Invalid target subscription tier for checkout');
    }

    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const checkoutUrl = `${successUrl}?session_id=${sessionId}&tier=${tier}`;

    await auditService.record({
      organizationId,
      userId: actorId,
      action: 'billing.checkout_create',
      resourceType: 'subscription',
      metadata: { targetTier: tier, sessionId },
    });

    return {
      sessionId,
      checkoutUrl,
      cancelUrl,
    };
  }

  async listInvoices(organizationId: string): Promise<InvoiceDto[]> {
    const records = await billingRepository.listInvoicesByOrg(organizationId);
    return records.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      invoiceNumber: inv.invoiceNumber,
      amountPaid: inv.amountPaid / 100, // convert cents to currency units
      currency: inv.currency,
      status: inv.status as InvoiceDto['status'],
      invoicePdfUrl: inv.invoicePdfUrl,
      createdAt: inv.createdAt,
    }));
  }

  async getInvoiceDownloadUrl(invoiceId: string, organizationId: string) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw AppError.notFound('Invoice not found');
    }

    if (invoice.organizationId !== organizationId) {
      throw AppError.forbidden('Access denied to this invoice');
    }

    const downloadUrl =
      invoice.invoicePdfUrl ||
      `https://billing.errorpulse.com/invoices/${invoice.invoiceNumber}.pdf`;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      downloadUrl,
    };
  }

  async handlePaymentCompleted(
    organizationId: string,
    tier: SubscriptionTier,
    stripeSubscriptionId: string
  ) {
    const allowance = TIER_ALLOWANCES[tier] || 50000;
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await billingRepository.updateSubscription(organizationId, {
      tier,
      status: 'active',
      eventAllowance: allowance,
      stripeSubscriptionId,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
    });
  }
}

export const billingService = new BillingService();

