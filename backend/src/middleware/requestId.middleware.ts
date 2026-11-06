import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

/**
 * Middleware Step 1: Request ID Tracking
 * Reads existing incoming X-Request-Id header or generates a unique req_<uuid>
 * Sets X-Request-Id header on response and binds to req.id
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];

  let requestId: string;
  if (typeof incomingId === 'string' && incomingId.trim().length > 0) {
    requestId = incomingId.trim();
  } else {
    requestId = `req_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
