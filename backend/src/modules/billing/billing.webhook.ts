import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { billingRepository } from './billing.repo';
import { billingService } from './billing.service';
import { SubscriptionTier } from '@/contracts/analytics-billing';
import { env } from '@/config/env';
import { AppError } from '@/middleware/errors';

export function verifyStripeSignature(
  rawPayload: string | Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  try {
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='))?.slice(2);
    const signaturePart = parts.find((p) => p.startsWith('v1='))?.slice(3);

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const payloadStr = typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8');
    const signedPayload = `${timestampPart}.${payloadStr}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature);
    const actualBuf = Buffer.from(signaturePart);

    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export async function handlePaymentWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = env.SESSION_SECRET; // fallback secret or provider webhook secret

  const rawBody = req.body;
  const rawBodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

  // If in production with strict signature validation
  if (env.NODE_ENV === 'production' && signature) {
    const isValid = verifyStripeSignature(rawBodyStr, signature, webhookSecret);
    if (!isValid) {
      throw AppError.forbidden('Invalid payment webhook signature');
    }
  }

  const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const eventId = payload.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const eventType = payload.type || 'payment.event';

  // 1. Atomically record incoming webhook into webhook_inbox
  await billingRepository.recordWebhookEvent({
    source: 'stripe',
    eventId,
    payload,
  });

  // 2. Process payment state update
  if (eventType === 'checkout.session.completed') {
    const orgId = payload.data?.object?.metadata?.organizationId || payload.data?.object?.client_reference_id;
    const tier = (payload.data?.object?.metadata?.tier as SubscriptionTier) || 'pro';
    const subId = payload.data?.object?.subscription || `sub_${Date.now()}`;

    if (orgId) {
      await billingService.handlePaymentCompleted(orgId, tier, subId);
    }
  }

  res.status(200).json({ received: true });
}

