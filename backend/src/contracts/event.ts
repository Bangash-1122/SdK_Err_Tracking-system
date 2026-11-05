import { z } from 'zod';

export const StackFrameSchema = z.object({
  filename: z.string().max(1024),
  functionName: z.string().max(256).nullable().optional(),
  lineno: z.number().int().nonnegative().nullable().optional(),
  colno: z.number().int().nonnegative().nullable().optional(),
  in_app: z.boolean().default(true),
  context_line: z.string().max(2048).nullable().optional(),
  pre_context: z.array(z.string().max(2048)).max(10).optional(),
  post_context: z.array(z.string().max(2048)).max(10).optional(),
});
export type StackFrame = z.infer<typeof StackFrameSchema>;

export const BreadcrumbSchema = z.object({
  type: z.string().max(64).optional(),
  category: z.string().max(128).default('default'),
  message: z.string().max(2048).nullable().optional(),
  level: z.enum(['debug', 'info', 'warning', 'error', 'fatal']).default('info'),
  timestamp: z.union([z.string().datetime(), z.number(), z.date()]),
  data: z.record(z.any()).nullable().optional(),
});
export type Breadcrumb = z.infer<typeof BreadcrumbSchema>;

export const BreadcrumbsSchema = BreadcrumbSchema;
export type Breadcrumbs = Breadcrumb;

export const IngestUserSchema = z.object({
  id: z.string().max(128).optional(),
  email: z.string().email().max(256).optional(),
  username: z.string().max(128).optional(),
  ip_address: z.string().max(64).optional(),
});
export type IngestUser = z.infer<typeof IngestUserSchema>;

export const IngestRequestSchema = z.object({
  url: z.string().max(2048).optional(),
  method: z.string().max(16).optional(),
  headers: z.record(z.string()).optional(),
  query_string: z.string().max(2048).optional(),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const IngestExceptionSchema = z.object({
  type: z.string().max(256),
  value: z.string().max(4096),
  stacktrace: z
    .object({
      frames: z.array(StackFrameSchema).max(100),
    })
    .optional(),
});
export type IngestException = z.infer<typeof IngestExceptionSchema>;

export const IngestSdkInfoSchema = z.object({
  name: z.string().max(64),
  version: z.string().max(32),
});
export type IngestSdkInfo = z.infer<typeof IngestSdkInfoSchema>;

export const IngestEventPayloadSchema = z.object({
  eventId: z.string().max(64).optional(),
  timestamp: z.union([z.string().datetime(), z.number(), z.date()]).optional(),
  platform: z.string().max(64).default('javascript'),
  level: z.enum(['fatal', 'error', 'warning', 'info', 'debug']).default('error'),
  environment: z.string().max(64).default('production'),
  release: z.string().max(128).nullable().optional(),
  dist: z.string().max(64).nullable().optional(),
  message: z.string().max(4096).optional(),
  exception: IngestExceptionSchema.optional(),
  breadcrumbs: z.array(BreadcrumbSchema).max(100).default([]),
  user: IngestUserSchema.nullable().optional(),
  tags: z.record(z.string().max(256)).optional(),
  extra: z.record(z.any()).optional(),
  request: IngestRequestSchema.nullable().optional(),
  sdk: IngestSdkInfoSchema.optional(),
});
export type IngestEventPayload = z.infer<typeof IngestEventPayloadSchema>;

