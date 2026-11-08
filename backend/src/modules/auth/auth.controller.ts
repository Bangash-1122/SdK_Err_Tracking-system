import { Request, Response } from 'express';
import { authService } from './auth.service';
import { SESSION_COOKIE_NAME } from '@/middleware/session.middleware';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AuthPrincipalDto } from '@/contracts/auth';
import { env } from '@/config/env';

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthController {
  signup = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.signup(req.body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(SESSION_COOKIE_NAME, result.rawSessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
    });

    res.setHeader('X-CSRF-Token', result.csrfSecret);

    const envelope: ApiSuccessEnvelope<AuthPrincipalDto & { csrfToken: string }> = {
      success: true,
      data: {
        user: result.user,
        organization: result.organization,
        role: result.role,
        csrfToken: result.csrfSecret,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.login(req.body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(SESSION_COOKIE_NAME, result.rawSessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_MS,
    });

    res.setHeader('X-CSRF-Token', result.csrfSecret);

    const envelope: ApiSuccessEnvelope<AuthPrincipalDto & { csrfToken: string }> = {
      success: true,
      data: {
        user: result.user,
        organization: result.organization,
        role: result.role,
        csrfToken: result.csrfSecret,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    if (req.session) {
      await authService.logout(req.session.id, req.user?.id, req.tenant?.orgId);
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: { message: 'Logged out successfully' },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.getMe(req.user!.id);

    const envelope: ApiSuccessEnvelope<AuthPrincipalDto> = {
      success: true,
      data: {
        user: result.user,
        organization: result.organization,
        role: result.role,
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    await authService.forgotPassword(req.body.email);

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: {
        message: 'If the email exists in our system, a password reset link has been dispatched.',
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    await authService.resetPassword(req.body.token, req.body.newPassword);

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: {
        message: 'Password has been successfully reset. Please log in with your new credentials.',
      },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const authController = new AuthController();

