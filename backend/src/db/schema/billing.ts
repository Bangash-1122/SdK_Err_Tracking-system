import { pgTable, text, timestamp, uuid, boolean, integer, bigint } from 'drizzle-orm/pg-core';
import { organizations } from './tenancy';
import { projects } from './projects';

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id'),
  tier: text('tier').default('free').notNull(), // 'free' | 'pro' | 'team' | 'enterprise'
  status: text('status').default('active').notNull(), // 'active' | 'past_due' | 'canceled' | 'trialing'
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  eventAllowance: bigint('event_allowance', { mode: 'number' }).default(50000).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  metric: text('metric').notNull(), // 'events' | 'sessions' | 'attachments'
  quantity: bigint('quantity', { mode: 'number' }).default(0).notNull(),
  period: text('period').notNull(), // e.g. '2026-11'
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  invoiceNumber: text('invoice_number').notNull().unique(),
  amountPaid: integer('amount_paid').default(0).notNull(), // amount in cents
  currency: text('currency').default('usd').notNull(),
  status: text('status').default('paid').notNull(), // 'paid' | 'open' | 'void' | 'uncollectible'
  invoicePdfUrl: text('invoice_pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
