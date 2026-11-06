import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errors';

export interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Middleware Step 9: Request Validation against Shared Zod Schemas
 * Returns 422 Unprocessable Entity with structured field details on failure
 */
export function validateRequest(schemas: ValidationTargets): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        const result = await schemas.params.safeParseAsync(req.params);
        if (!result.success) {
          return next(formatZodError('params', result.error));
        }
        req.params = result.data;
      }

      if (schemas.query) {
        const result = await schemas.query.safeParseAsync(req.query);
        if (!result.success) {
          return next(formatZodError('query', result.error));
        }
        req.query = result.data;
      }

      if (schemas.body) {
        const result = await schemas.body.safeParseAsync(req.body);
        if (!result.success) {
          return next(formatZodError('body', result.error));
        }
        req.body = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function formatZodError(target: string, error: ZodError): AppError {
  const details = error.errors.map((e) => ({
    field: `${target}.${e.path.join('.')}`,
    message: e.message,
    code: e.code,
  }));

  return new AppError(
    422,
    'VALIDATION_ERROR',
    `Validation failed for request ${target}`,
    details
  );
}
