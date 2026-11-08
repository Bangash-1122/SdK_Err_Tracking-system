import { Router } from 'express';
import { billingController } from './billing.controller';
import { handlePaymentWebhook } from './billing.webhook';
import { requireAuth } from '@/middleware/session.middleware';
import { requireRole } from '@/middleware/tenantRbac.middleware';

const router = Router();

// Public Payment Provider Webhook Endpoint
router.post('/webhook', handlePaymentWebhook);

// Authenticated billing management routes
router.get(
  '/subscription',
  requireAuth,
  billingController.getSubscription
);

router.post(
  '/checkout',
  requireAuth,
  requireRole(['Owner', 'Administrator']),
  billingController.createCheckoutSession
);

router.get(
  '/invoices',
  requireAuth,
  billingController.listInvoices
);

router.get(
  '/invoices/:id/download',
  requireAuth,
  billingController.downloadInvoice
);

export const billingRoutes = router;

