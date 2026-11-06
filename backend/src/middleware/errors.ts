import { Request, Response, NextFunction, RequestHandler } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details?: any): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not Found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Resource already exists'): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static unprocessable(message = 'Unprocessable Entity', details?: any): AppError {
    return new AppError(422, 'VALIDATION_ERROR', message, details);
  }

  static tooManyRequests(message = 'Too Many Requests', details?: any): AppError {
    return new AppError(429, 'RATE_LIMIT_EXCEEDED', message, details);
  }

  static internal(message = 'Internal Server Error', details?: any): AppError {
    return new AppError(500, 'INTERNAL_SERVER_ERROR', message, details);
  }
}

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Eliminates repetitive try/catch blocks in Express controllers
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

