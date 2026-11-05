import { z } from 'zod';

export const RoleEnum = z.enum(['Owner', 'Administrator', 'Developer', 'Viewer']);
export type Role = z.infer<typeof RoleEnum>;

export const SignupBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
  organizationName: z.string().trim().min(1).max(100).optional(),
});
export type SignupBody = z.infer<typeof SignupBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const ForgotPasswordBodySchema = z.object({
  email: z.string().trim().email(),
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>;

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.union([z.string().datetime(), z.date()]),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ActiveOrganizationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type ActiveOrganizationSummary = z.infer<typeof ActiveOrganizationSummarySchema>;

export const AuthPrincipalDtoSchema = z.object({
  user: UserProfileSchema,
  organization: ActiveOrganizationSummarySchema,
  role: RoleEnum,
});
export type AuthPrincipalDto = z.infer<typeof AuthPrincipalDtoSchema>;

