import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '@/infra/db';
import { sessions, users } from '@/db/schema';
import { hashSha256 } from '@/infra/crypto';
import { AppError } from './errors';

export const SESSION_COOKIE_NAME = 'ep_session';

/**
 * Middleware Step 5: Session Cookie Authentication
 * Validates HttpOnly session token against PostgreSQL sessions and users tables
 */
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Extract raw session token from cookies or Authorization Bearer header
    const rawToken =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : null);

    if (!rawToken) {
      return next();
    }

    // 2. Hash raw token with SHA-256 to lookup primary key in sessions table
    const hashedToken = hashSha256(rawToken);

    // 3. Find active, unexpired, unrevoked session
    const [result] = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.id, hashedToken),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (result) {
      req.user = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: result.user.avatarUrl,
      };
      req.session = {
        id: result.session.id,
        activeOrgId: result.session.activeOrgId,
        csrfSecret: result.session.csrfSecret,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware Step 6: CSRF Token Verification on State-Changing HTTP Methods
 */
export function csrfMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Skip CSRF for safe/read-only HTTP methods
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // Only enforce CSRF when a browser session exists (Bearer tokens / public SDK endpoints bypass CSRF)
  if (!req.session) {
    return next();
  }

  const incomingCsrf = req.headers['x-csrf-token'];
  if (typeof incomingCsrf !== 'string' || !incomingCsrf) {
    return next(new AppError(403, 'CSRF_MISSING', 'Missing required X-CSRF-Token header'));
  }

  const expectedCsrf = req.session.csrfSecret;

  try {
    const incomingBuf = Buffer.from(incomingCsrf);
    const expectedBuf = Buffer.from(expectedCsrf);

    if (
      incomingBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(incomingBuf, expectedBuf)
    ) {
      return next(new AppError(403, 'CSRF_INVALID', 'Invalid X-CSRF-Token provided'));
    }
  } catch {
    return next(new AppError(403, 'CSRF_INVALID', 'Invalid X-CSRF-Token provided'));
  }

  next();
}

/**
 * Guard middleware requiring an active authenticated user
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required to access this resource'));
  }
  next();
}
