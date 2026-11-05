import { pgTable, text, timestamp, uuid, boolean, jsonb, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './identity';

export const orgRoleEnum = pgEnum('org_role', ['Owner', 'Administrator', 'Developer', 'Viewer']);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').default('free').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgRoleEnum('role').default('Developer').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('org_members_org_user_idx').on(table.orgId, table.userId),
  ]
);

export const orgSettings = pgTable('org_settings', {
  orgId: uuid('org_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  complianceTier: text('compliance_tier').default('standard').notNull(),
  mfaRequired: boolean('mfa_required').default(false).notNull(),
  ipAllowlist: jsonb('ip_allowlist').$type<string[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
