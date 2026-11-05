import { pgTable, text, timestamp, uuid, integer, bigint, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './identity';
import { organizations } from './tenancy';
import { projects } from './projects';

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dedupeKey: text('dedupe_key').notNull(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').default('pending').notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
    retryCount: integer('retry_count').default(0).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('outbox_dedupe_key_idx').on(table.dedupeKey),
    index('outbox_status_idx').on(table.status),
  ]
);

export const webhookInbox = pgTable('webhook_inbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(), // 'stripe' | 'github' | 'slack'
  eventId: text('event_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').default('pending').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deliveryAttempts = pgTable('delivery_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  targetType: text('target_type').notNull(), // 'notification' | 'webhook'
  targetId: uuid('target_id').notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  status: text('status').notNull(), // 'success' | 'failed'
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
});

export const objectAssets = pgTable('object_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  bucketName: text('bucket_name').notNull(),
  assetType: text('asset_type').notNull(), // 'sourcemap' | 'attachment' | 'export'
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').default('application/octet-stream').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').default('queued').notNull(), // 'queued' | 'running' | 'completed' | 'failed'
  downloadUrl: text('download_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // e.g. 'project.create', 'key.rotate', 'member.invite'
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_org_idx').on(table.organizationId, table.createdAt.desc()),
  ]
);
