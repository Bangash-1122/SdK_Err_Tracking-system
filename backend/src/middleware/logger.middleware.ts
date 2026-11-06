import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import { env } from '@/config/env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'req.headers["x-api-key"]',
      'password',
      'passwordHash',
      'token',
      'secret',
      'csrfSecret',
      'creditCard',
      'cvv',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

/**
 * Middleware Step 3: Structured JSON Logging with Automatic Redaction
 */
export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  req.log = logger.child({ requestId: req.id });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      req.log?.error(logData, 'HTTP Request Error');
    } else if (res.statusCode >= 400) {
      req.log?.warn(logData, 'HTTP Request Client Warning');
    } else {
      req.log?.info(logData, 'HTTP Request Completed');
    }
  });

  next();
}
