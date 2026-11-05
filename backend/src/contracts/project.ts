import { z } from 'zod';

export const CreateProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  organizationId: z.string().optional(),
  platform: z.string().default('javascript'),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;

export const ProjectDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  platform: z.string(),
  apiKeyPrefix: z.string(),
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]),
});
export type ProjectDto = z.infer<typeof ProjectDtoSchema>;

export const RotateKeyResponseSchema = z.object({
  apiKeyPrefix: z.string(),
  rawIngestionKey: z.string().length(64).regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-character hex key'),
});
export type RotateKeyResponse = z.infer<typeof RotateKeyResponseSchema>;

