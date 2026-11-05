import { pgTable, text, timestamp, uuid, boolean, integer, bigint, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './tenancy';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    platform: text('platform').default('javascript').notNull(),
    eventCount: bigint('event_count', { mode: 'number' }).default(0).notNull(),
    quotaLimit: bigint('quota_limit', { mode: 'number' }).default(100000).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('projects_org_slug_idx').on(table.organizationId, table.slug),
  ]
);

export const projectKeys = pgTable('project_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  keyPrefix: text('key_prefix').notNull(),
  hashedKey: text('hashed_key').notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectSettings = pgTable('project_settings', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  // Section A: Default Environment
  defaultEnvironment: text('default_environment').default('production').notNull(),
  // Section B: Timezone
  timezone: text('timezone').default('UTC').notNull(),
  // Section C: Error Sample Rate
  errorSampleRate: text('error_sample_rate').default('1.0').notNull(),
  // Section D: Ignored Errors
  ignoredErrors: jsonb('ignored_errors').$type<string[]>().default([]).notNull(),
  // Section E: Sensitive Data Scrubbing Fields
  sensitiveDataScrubbingFields: jsonb('sensitive_data_scrubbing_fields')
    .$type<string[]>()
    .default(['password', 'secret', 'token', 'authorization', 'creditCard', 'cvv'])
    .notNull(),
  // Section G: Telemetry Retention Days
  telemetryRetentionDays: integer('telemetry_retention_days').default(30).notNull(),
  // Section H: Auto-Resolve Inactive Days
  autoResolveInactiveDays: integer('auto_resolve_inactive_days').default(14).notNull(),
  // Section J: Performance & Regression Monitoring
  regressionDetectionEnabled: boolean('regression_detection_enabled').default(true).notNull(),
  performanceSampleRate: text('performance_sample_rate').default('1.0').notNull(),
  slowRequestThresholdMs: integer('slow_request_threshold_ms').default(1000).notNull(),
  // Version for Optimistic Concurrency Control
  version: integer('version').default(1).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
