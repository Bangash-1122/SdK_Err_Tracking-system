import crypto from 'node:crypto';
import {
  authRepository,
} from './auth.repo';
import {
  SignupBody,
  LoginBody,
  UserProfile,
  ActiveOrganizationSummary,
  Role,
} from '@/contracts/auth';
import { hashPassword, verifyPassword, hashSha256, generateRandomHex64 } from '@/infra/crypto';
import { sendEmail } from '@/infra/mailer';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';
import { env } from '@/config/env';

export interface AuthResult {
  user: UserProfile;
  organization: ActiveOrganizationSummary;
  role: Role;
  rawSessionToken: string;
  csrfSecret: string;
}

export class AuthService {
  async signup(
    body: SignupBody,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuthResult> {
    const existing = await authRepository.findUserByEmail(body.email);
    if (existing) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const passwordHash = await hashPassword(body.password);
    const orgName = body.organizationName?.trim() || `${body.name.trim()}'s Organization`;

    const { user, organization } = await authRepository.createSignupTransaction(
      {
        email: body.email,
        passwordHash,
        name: body.name,
      },
      orgName
    );

    // Create Session
    const rawSessionToken = generateRandomHex64();
    const hashedSessionToken = hashSha256(rawSessionToken);
    const csrfSecret = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await authRepository.createSession({
      id: hashedSessionToken,
      userId: user.id,
      activeOrgId: organization.id,
      csrfSecret,
      expiresAt,
    });

    // Record Audit Event
    await auditService.record({
      organizationId: organization.id,
      userId: user.id,
      action: 'auth.signup',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: { email: user.email, orgName: organization.name },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      role: 'Owner',
      rawSessionToken,
      csrfSecret,
    };
  }

  async login(
    body: LoginBody,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuthResult> {
    const user = await authRepository.findUserByEmail(body.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isValid = await verifyPassword(user.passwordHash, body.password);
    if (!isValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const primaryOrg = await authRepository.findUserPrimaryOrg(user.id);
    if (!primaryOrg) {
      throw AppError.forbidden('User does not belong to any active organization');
    }

    // Create Session
    const rawSessionToken = generateRandomHex64();
    const hashedSessionToken = hashSha256(rawSessionToken);
    const csrfSecret = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await authRepository.createSession({
      id: hashedSessionToken,
      userId: user.id,
      activeOrgId: primaryOrg.organization.id,
      csrfSecret,
      expiresAt,
    });

    // Record Audit Event
    await auditService.record({
      organizationId: primaryOrg.organization.id,
      userId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: { email: user.email },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      organization: {
        id: primaryOrg.organization.id,
        name: primaryOrg.organization.name,
        slug: primaryOrg.organization.slug,
      },
      role: primaryOrg.role as Role,
      rawSessionToken,
      csrfSecret,
    };
  }

  async logout(sessionId: string, actorId?: string, orgId?: string): Promise<void> {
    await authRepository.revokeSession(sessionId);

    if (actorId && orgId) {
      await auditService.record({
        organizationId: orgId,
        userId: actorId,
        action: 'auth.logout',
        resourceType: 'session',
        resourceId: sessionId,
      });
    }
  }

  async getMe(userId: string): Promise<{
    user: UserProfile;
    organization: ActiveOrganizationSummary;
    role: Role;
  }> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const primaryOrg = await authRepository.findUserPrimaryOrg(user.id);
    if (!primaryOrg) {
      throw AppError.forbidden('No active organization found for this user');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      organization: {
        id: primaryOrg.organization.id,
        name: primaryOrg.organization.name,
        slug: primaryOrg.organization.slug,
      },
      role: primaryOrg.role as Role,
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      // Return cleanly to prevent email enumeration timing attacks
      return;
    }

    const rawToken = generateRandomHex64();
    const tokenHash = hashSha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const primaryOrigin = env.CORS_ORIGINS.split(',')[0]?.trim() || 'http://localhost:3000';
    const resetLink = `${primaryOrigin}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your ErrorPulse password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${user.name},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link is valid for 1 hour. If you did not make this request, you can safely ignore this email.</p>
      `,
      text: `Hello ${user.name},\n\nWe received a request to reset your password. Please open the link below to set a new password:\n${resetLink}\n\nThis link is valid for 1 hour.`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashSha256(token);
    const validToken = await authRepository.findValidPasswordResetToken(tokenHash);

    if (!validToken) {
      throw AppError.badRequest('Password reset token is invalid or has expired');
    }

    const newPasswordHash = await hashPassword(newPassword);
    await authRepository.consumePasswordResetToken(
      validToken.id,
      validToken.userId,
      newPasswordHash
    );
  }
}

export const authService = new AuthService();
