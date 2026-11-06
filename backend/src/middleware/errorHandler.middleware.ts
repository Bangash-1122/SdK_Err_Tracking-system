import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '@/config/env';
import { AppError } from './errors';
import { ApiErrorEnvelope } from '@/contracts/envelope';

/**
 * Middleware Step 12: Centralized Error Handler
 * Formats all errors into a safe { error, meta: { requestId } } envelope
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.id || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred';
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } else if (err instanceof SyntaxError && 'body' in err) {
    // Malformed JSON payload
    statusCode = 400;
    code = 'BAD_JSON_PAYLOAD';
    message = 'Malformed JSON body in request';
  } else if (err?.code === '23505') {
    // PostgreSQL Unique Constraint Violation
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'A record with this identifier already exists';
  }

  // Log error using structured Pino logger
  if (statusCode >= 500) {
    req.log?.error(
      {
        err,
        statusCode,
        code,
        requestId,
        path: req.originalUrl,
      },
      'Unhandled internal server exception'
    );
  } else {
    req.log?.warn(
      {
        statusCode,
        code,
        requestId,
        path: req.originalUrl,
      },
      `Client error response: ${message}`
    );
  }

  const responsePayload: ApiErrorEnvelope = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(env.NODE_ENV !== 'production' && statusCode >= 500
        ? { details: { stack: err.stack, originalMessage: err.message } }
        : {}),
    },
    meta: {
      requestId,
    },
  };

  res.status(statusCode).json(responsePayload);
};

