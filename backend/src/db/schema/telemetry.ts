import { pgTable, text, timestamp, uuid, integer, bigint, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const releases = pgTable('releases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  environment: text('environment').default('production').notNull(),
  commitSha: text('commit_sha'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(),
    status: text('status').default('unresolved').notNull(), // 'unresolved' | 'resolved' | 'ignored'
    severity: text('severity').default('error').notNull(), // 'critical' | 'high' | 'medium' | 'low' | 'info'
    count: bigint('count', { mode: 'number' }).default(1).notNull(),
    userCount: bigint('user_count', { mode: 'number' }).default(1).notNull(),
    firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    version: integer('version').default(1).notNull(), // Optimistic locking
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('issues_project_fingerprint_idx').on(table.projectId, table.fingerprint),
    index('issues_cursor_idx').on(
      table.projectId,
      table.status,
      table.severity,
      table.lastSeen.desc(),
      table.id.desc()
    ),
  ]
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    stacktrace: jsonb('stacktrace'),
    breadcrumbs: jsonb('breadcrumbs').default([]).notNull(),
    tags: jsonb('tags').default({}).notNull(),
    extra: jsonb('extra'),
    user: jsonb('user'),
    request: jsonb('request'),
    sdk: jsonb('sdk'),
    environment: text('environment').default('production').notNull(),
    release: text('release'),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('events_project_id_idx').on(table.projectId, table.id),
    index('events_issue_timestamp_idx').on(table.issueId, table.timestamp.desc()),
  ]
);

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  distinctId: text('distinct_id').notNull(),
  environment: text('environment').default('production').notNull(),
  release: text('release'),
  status: text('status').default('ok').notNull(), // 'ok' | 'errored' | 'crashed'
  durationMs: integer('duration_ms').default(0).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});
