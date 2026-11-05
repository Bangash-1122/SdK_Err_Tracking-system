import { z } from 'zod';

export const ProjectSettingsSchema = z.object({
  // Section A: Default Environment
  defaultEnvironment: z.string().default('production'),
  // Section B: Timezone
  timezone: z.string().default('UTC'),
  // Section C: Error Sample Rate (0.0 to 1.0)
  errorSampleRate: z.number().min(0).max(1).default(1.0),
  // Section D: Ignored Errors
  ignoredErrors: z.array(z.string()).default([]),
  // Section E: Sensitive Data Scrubbing Fields
  sensitiveDataScrubbingFields: z.array(z.string()).default([
    'password',
    'secret',
    'token',
    'authorization',
    'creditCard',
    'cvv',
  ]),
  // Section G: Telemetry Retention Days
  telemetryRetentionDays: z.number().int().positive().default(30),
  // Section H: Auto-Resolve Inactive Days
  autoResolveInactiveDays: z.number().int().min(0).default(14),
  // Section J: Performance & Regression Monitoring
  regressionDetectionEnabled: z.boolean().default(true),
  performanceSampleRate: z.number().min(0).max(1).default(1.0),
  slowRequestThresholdMs: z.number().int().positive().default(1000),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export const UpdateProjectSettingsBodySchema = ProjectSettingsSchema.partial();
export type UpdateProjectSettingsBody = z.infer<typeof UpdateProjectSettingsBodySchema>;

