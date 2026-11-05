import { z } from 'zod';
import { RoleEnum } from './auth';

export const ComplianceTierEnum = z.enum(['standard', 'hipaa', 'soc2', 'enterprise']);
export type ComplianceTier = z.infer<typeof ComplianceTierEnum>;

export const OrgSettingsSchema = z.object({
  complianceTier: ComplianceTierEnum.default('standard'),
  mfaRequired: z.boolean().default(false),
  mfaRequirement: z.boolean().optional(),
  ipAllowlist: z.array(z.string()).default([]),
});
export type OrgSettings = z.infer<typeof OrgSettingsSchema>;

export const OrganizationDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  settings: OrgSettingsSchema,
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]),
});
export type OrganizationDto = z.infer<typeof OrganizationDtoSchema>;

export const InviteMemberBodySchema = z.object({
  email: z.string().trim().email(),
  role: RoleEnum,
});
export type InviteMemberBody = z.infer<typeof InviteMemberBodySchema>;

export const UpdateMemberRoleBodySchema = z.object({
  role: RoleEnum,
});
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBodySchema>;

