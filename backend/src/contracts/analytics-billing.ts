import { z } from 'zod';

export const AnalyticsQuerySchema = z.object({
  projectId: z.string().optional(),
  environment: z.string().optional(),
  startDate: z.union([z.string().datetime(), z.date(), z.string()]),
  endDate: z.union([z.string().datetime(), z.date(), z.string()]),
  interval: z.enum(['1m', '5m', '1h', '1d']).default('1d').optional(),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

export const DashboardStatsDtoSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  unresolvedIssues: z.number().int().nonnegative(),
  affectedUsers: z.number().int().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  errorRate: z.number().min(0).max(100),
  timeseries: z.array(
    z.object({
      timestamp: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
});
export type DashboardStatsDto = z.infer<typeof DashboardStatsDtoSchema>;

export const ApmPerformanceDtoSchema = z.object({
  transactionName: z.string(),
  callCount: z.number().int().nonnegative(),
  p50Ms: z.number().nonnegative(),
  p95Ms: z.number().nonnegative(),
  p99Ms: z.number().nonnegative(),
  errorPercentage: z.number().min(0).max(100),
});
export type ApmPerformanceDto = z.infer<typeof ApmPerformanceDtoSchema>;

export const SessionHealthDtoSchema = z.object({
  totalSessions: z.number().int().nonnegative(),
  crashedSessions: z.number().int().nonnegative(),
  crashFreeSessionRate: z.number().min(0).max(100),
  crashFreeUserRate: z.number().min(0).max(100),
});
export type SessionHealthDto = z.infer<typeof SessionHealthDtoSchema>;

export const SubscriptionTierEnum = z.enum(['free', 'pro', 'team', 'enterprise']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierEnum>;

export const SubscriptionStatusEnum = z.enum(['active', 'past_due', 'canceled', 'trialing']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>;

export const SubscriptionDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  tier: SubscriptionTierEnum,
  status: SubscriptionStatusEnum,
  currentPeriodStart: z.union([z.string().datetime(), z.date()]),
  currentPeriodEnd: z.union([z.string().datetime(), z.date()]),
  cancelAtPeriodEnd: z.boolean(),
  eventAllowance: z.number().int().positive(),
  eventUsage: z.number().int().nonnegative(),
});
export type SubscriptionDto = z.infer<typeof SubscriptionDtoSchema>;

export const InvoiceDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  invoiceNumber: z.string(),
  amountPaid: z.number().nonnegative(),
  currency: z.string().default('usd'),
  status: z.enum(['paid', 'open', 'void', 'uncollectible']),
  invoicePdfUrl: z.string().url().nullable().optional(),
  createdAt: z.union([z.string().datetime(), z.date()]),
});
export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;

export const AuditLogEntryDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().nullable().optional(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.union([z.string().datetime(), z.date()]),
});
export type AuditLogEntryDto = z.infer<typeof AuditLogEntryDtoSchema>;

