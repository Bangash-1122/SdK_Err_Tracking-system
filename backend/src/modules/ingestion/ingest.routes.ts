import { Router } from 'express';
import { ingestController } from './ingest.controller';
import { validateRequest } from '@/middleware/validate.middleware';
import { createRateLimiter } from '@/middleware/rateLimiter.middleware';
import { IngestEventPayloadSchema } from '@/contracts/event';

const router = Router();

// High-capacity token-bucket rate limiter for SDK telemetry ingestion
const ingestLimiter = createRateLimiter({ limit: 300, windowSeconds: 60 });

// Core Event Ingestion Endpoint
router.post(
  '/events',
  ingestLimiter,
  validateRequest({ body: IngestEventPayloadSchema }),
  ingestController.ingestEvent
);

// Alias root POST / if mounted directly at /api/v1/events
router.post(
  '/',
  ingestLimiter,
  validateRequest({ body: IngestEventPayloadSchema }),
  ingestController.ingestEvent
);

// SDK Health & Availability Probe
router.get(
  '/sdk-health',
  ingestController.getSdkHealth
);

export const ingestRoutes = router;
