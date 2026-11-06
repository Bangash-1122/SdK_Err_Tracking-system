import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

/**
 * Middleware Step 11: 404 Not Found Route Handler
 * Catches all unmatched requests and routes them to the centralized error handler
 */
export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError(
      404,
      'ROUTE_NOT_FOUND',
      `Cannot ${req.method} ${req.originalUrl || req.url}`
    )
  );
}
