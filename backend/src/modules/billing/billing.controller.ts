import { Request, Response } from 'express';
import { billingService } from './billing.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class BillingController {
  getSubscription = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization context is required');
    }

    const subscription = await billingService.getSubscription(orgId);

    const envelope: ApiSuccessEnvelope<typeof subscription> = {
      success: true,
      data: subscription,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization context is required');
    }

    const { tier, successUrl, cancelUrl } = req.body;
    if (!tier || !successUrl || !cancelUrl) {
      throw AppError.badRequest('tier, successUrl, and cancelUrl are required for checkout');
    }

    const session = await billingService.createCheckoutSession(
      orgId,
      tier,
      successUrl,
      cancelUrl,
      req.user!.id
    );

    const envelope: ApiSuccessEnvelope<typeof session> = {
      success: true,
      data: session,
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  listInvoices = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization context is required');
    }

    const invoices = await billingService.listInvoices(orgId);

    const envelope: ApiSuccessEnvelope<typeof invoices> = {
      success: true,
      data: invoices,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  downloadInvoice = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const orgId = req.tenant?.orgId;
    if (!id || !orgId) {
      throw AppError.badRequest('Invoice ID and organization context are required');
    }

    const result = await billingService.getInvoiceDownloadUrl(id, orgId);

    const envelope: ApiSuccessEnvelope<typeof result> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const billingController = new BillingController();

