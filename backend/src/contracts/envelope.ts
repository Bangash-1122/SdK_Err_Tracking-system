import { z } from 'zod';

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  direction: z.enum(['forward', 'backward']).default('forward').optional(),
});
export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;

export const ApiSuccessEnvelopeMetaSchema = z.object({
  requestId: z.string(),
  nextCursor: z.string().nullable().optional(),
});
export type ApiSuccessEnvelopeMeta = z.infer<typeof ApiSuccessEnvelopeMetaSchema>;

export const createApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true).default(true),
    data: dataSchema,
    meta: ApiSuccessEnvelopeMetaSchema,
  });

export const ApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  createApiSuccessEnvelopeSchema(dataSchema);

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
    nextCursor?: string | null;
  };
};

export const ApiErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
  code: z.string().optional(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.union([z.array(ApiErrorDetailSchema), z.record(z.unknown()), z.unknown()]).optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const ApiErrorEnvelopeSchema = z.object({
  success: z.literal(false).default(false),
  error: ApiErrorBodySchema,
  meta: z.object({
    requestId: z.string(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

