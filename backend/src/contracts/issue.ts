import { z } from 'zod';

export const IssueStatusEnum = z.enum(['unresolved', 'resolved', 'ignored']);
export type IssueStatus = z.infer<typeof IssueStatusEnum>;

export const IssueSeverityEnum = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type IssueSeverity = z.infer<typeof IssueSeverityEnum>;

export const ListIssuesQuerySchema = z.object({
  status: IssueStatusEnum.optional(),
  severity: IssueSeverityEnum.optional(),
  environment: z.string().optional(),
  query: z.string().optional(),
  search: z.string().optional(),
  searchQuery: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});
export type ListIssuesQuery = z.infer<typeof ListIssuesQuerySchema>;

export const UpdateIssueStatusBodySchema = z.object({
  status: IssueStatusEnum,
  version: z.number().int().nonnegative().describe('Optimistic concurrency control version'),
  optimisticVersion: z.number().int().nonnegative().optional().describe('Alias for optimistic concurrency version'),
});
export type UpdateIssueStatusBody = z.infer<typeof UpdateIssueStatusBodySchema>;

export const BulkTriageIssuesBodySchema = z.object({
  issueIds: z.array(z.string().min(1)).min(1).max(100),
  status: IssueStatusEnum,
});
export type BulkTriageIssuesBody = z.infer<typeof BulkTriageIssuesBodySchema>;

export const IssueDetailDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  culprit: z.string().nullable().optional(),
  status: IssueStatusEnum,
  severity: IssueSeverityEnum,
  environment: z.string().default('production'),
  firstSeenAt: z.union([z.string().datetime(), z.date()]),
  lastSeenAt: z.union([z.string().datetime(), z.date()]),
  eventsCount: z.number().int().nonnegative().default(0),
  usersCount: z.number().int().nonnegative().default(0),
  version: z.number().int().nonnegative().default(1),
  assignedTo: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.union([z.string().datetime(), z.date()]).optional(),
  updatedAt: z.union([z.string().datetime(), z.date()]).optional(),
});
export type IssueDetailDto = z.infer<typeof IssueDetailDtoSchema>;

