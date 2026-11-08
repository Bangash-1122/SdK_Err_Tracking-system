import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '@/middleware/validate.middleware';
import { requireAuth } from '@/middleware/session.middleware';
import { createRateLimiter } from '@/middleware/rateLimiter.middleware';
import {
  SignupBodySchema,
  LoginBodySchema,
  ForgotPasswordBodySchema,
  ResetPasswordBodySchema,
} from '@/contracts/auth';

const router = Router();

// Strict rate limiter for authentication attempts (10 attempts per minute)
const authLimiter = createRateLimiter({ limit: 10, windowSeconds: 60 });

router.post(
  '/signup',
  authLimiter,
  validateRequest({ body: SignupBodySchema }),
  authController.signup
);

router.post(
  '/login',
  authLimiter,
  validateRequest({ body: LoginBodySchema }),
  authController.login
);

router.post(
  '/logout',
  requireAuth,
  authController.logout
);

router.get(
  '/me',
  requireAuth,
  authController.me
);

router.post(
  '/forgot-password',
  authLimiter,
  validateRequest({ body: ForgotPasswordBodySchema }),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  validateRequest({ body: ResetPasswordBodySchema }),
  authController.resetPassword
);

export const authRoutes = router;
