import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '@/infra/db';
import { orgMembers } from '@/db/schema';
import { Role } from '@/contracts/auth';
import { AppError } from './errors';

const ROLE_HIERARCHY: Record<Role, number> = {
  Owner: 4,
  Administrator: 3,
  Developer: 2,
  Viewer: 1,
};

/**
 * Middleware Step 7: Tenant & RBAC Resolution
 * Resolves organization & project context, verifies membership, and attaches req.tenant
 */
export async function tenantRbacMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const rawOrgId =
      (req.headers['x-organization-id'] as string) ||
      req.session?.activeOrgId ||
      null;

    const rawProjectId = (req.headers['x-project-id'] as string) || null;

    if (!rawOrgId || !req.user) {
      return next();
    }

    // Verify membership in the organization
    const [membership] = await db
      .select({
        role: orgMembers.role,
      })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, rawOrgId),
          eq(orgMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!membership) {
      return next(
        new AppError(
          403,
          'ORG_MEMBERSHIP_REQUIRED',
          'You do not have membership access to this organization'
        )
      );
    }

    req.tenant = {
      orgId: rawOrgId,
      role: membership.role as Role,
      projectId: rawProjectId,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * RBAC Guard Middleware: Enforces minimum role level or exact role match
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      return next(
        new AppError(
          403,
          'TENANT_CONTEXT_MISSING',
          'Organization context is required for this action'
        )
      );
    }

    const currentRole = req.tenant.role;
    const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
    const minRequiredLevel = Math.min(
      ...allowedRoles.map((r) => ROLE_HIERARCHY[r] || 0)
    );

    // Allow if direct inclusion or higher hierarchy level
    if (allowedRoles.includes(currentRole) || currentLevel >= minRequiredLevel) {
      return next();
    }

    return next(
      new AppError(
        403,
        'INSUFFICIENT_PERMISSIONS',
        `Role '${currentRole}' does not have sufficient permissions. Required: ${allowedRoles.join(
          ', '
        )}`
      )
    );
  };
}

