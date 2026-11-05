import { z } from 'zod';

export const CreateReleaseBodySchema = z.object({
  version: z.string().trim().min(1).max(128),
  ref: z.string().trim().max(128).optional(),
  url: z.string().url().optional(),
});
export type CreateReleaseBody = z.infer<typeof CreateReleaseBodySchema>;

export const PresignSourceMapBodySchema = z.object({
  release: z.string().trim().min(1).max(128),
  filename: z.string().trim().min(1).max(512),
  contentType: z.string().default('application/json'),
});
export type PresignSourceMapBody = z.infer<typeof PresignSourceMapBodySchema>;

export const GitHubIntegrationConfigSchema = z.object({
  type: z.literal('github'),
  repo: z.string().min(1),
  installationId: z.string().min(1),
  token: z.string().optional(),
});
export type GitHubIntegrationConfig = z.infer<typeof GitHubIntegrationConfigSchema>;

export const SlackIntegrationConfigSchema = z.object({
  type: z.literal('slack'),
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
});
export type SlackIntegrationConfig = z.infer<typeof SlackIntegrationConfigSchema>;

export const WebhookIntegrationConfigSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().url(),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
});
export type WebhookIntegrationConfig = z.infer<typeof WebhookIntegrationConfigSchema>;

export const EmailIntegrationConfigSchema = z.object({
  type: z.literal('email'),
  recipients: z.array(z.string().email()).min(1),
});
export type EmailIntegrationConfig = z.infer<typeof EmailIntegrationConfigSchema>;

export const IntegrationConfigSchema = z.discriminatedUnion('type', [
  GitHubIntegrationConfigSchema,
  SlackIntegrationConfigSchema,
  WebhookIntegrationConfigSchema,
  EmailIntegrationConfigSchema,
]);
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

export const AlertRuleConditionSchema = z.object({
  metric: z.enum(['error_count', 'affected_users', 'slow_requests', 'new_issue']),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
  threshold: z.number(),
  windowMinutes: z.number().int().positive().default(5),
});
export type AlertRuleCondition = z.infer<typeof AlertRuleConditionSchema>;

export const AlertRuleActionSchema = z.object({
  integrationType: z.enum(['slack', 'webhook', 'email', 'github']),
  target: z.string().min(1),
});
export type AlertRuleAction = z.infer<typeof AlertRuleActionSchema>;

export const AlertRuleSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  conditions: z.array(AlertRuleConditionSchema),
  actions: z.array(AlertRuleActionSchema),
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]).optional(),
});
export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const CreateAlertRuleBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
  enabled: z.boolean().default(true),
  conditions: z.array(AlertRuleConditionSchema).min(1),
  actions: z.array(AlertRuleActionSchema).min(1),
});
export type CreateAlertRuleBody = z.infer<typeof CreateAlertRuleBodySchema>;

