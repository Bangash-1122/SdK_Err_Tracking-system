import helmet from 'helmet';
import cors from 'cors';
import { RequestHandler } from 'express';
import { corsOrigins } from '@/config/env';
import { AppError } from './errors';

/**
 * Middleware Step 2: Helmet Security Headers & Strict CORS
 */

export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: false, // Pure REST/JSON API
  crossOriginEmbedderPolicy: false,
});

export const corsMiddleware: RequestHandler = cors({
  origin: (requestOrigin, callback) => {
    // Allow non-browser requests (e.g. mobile/desktop SDKs, server-to-server, curl)
    if (!requestOrigin) {
      return callback(null, true);
    }

    if (corsOrigins.includes(requestOrigin)) {
      return callback(null, true);
    }

    return callback(
      new AppError(403, 'CORS_NOT_ALLOWED', `Origin '${requestOrigin}' is not permitted by CORS policy`)
    );
  },
  credentials: true, // Never wildcard
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-CSRF-Token',
    'X-Organization-Id',
    'X-Project-Id',
    'X-API-Key',
  ],
  exposedHeaders: ['X-Request-Id', 'Retry-After'],
});

