import { relations } from 'drizzle-orm';
import { users, sessions, passwordResetTokens } from './identity';
import { organizations, orgMembers, orgSettings } from './tenancy';
import { projects, projectKeys, projectSettings } from './projects';
import { releases, issues, events, userSessions } from './telemetry';
import { alertRules, integrations, notifications } from './automation';
import { subscriptions, usageRecords, invoices } from './billing';
import { outbox, webhookInbox, deliveryAttempts, objectAssets, exportJobs, auditLogs } from './operations';

// Re-export all schema tables and enums
export * from './identity';
export * from './tenancy';
export * from './projects';
export * from './telemetry';
export * from './automation';
export * from './billing';
export * from './operations';

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orgMembers: many(orgMembers),
  passwordResetTokens: many(passwordResetTokens),
  exportJobs: many(exportJobs),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  activeOrg: one(organizations, {
    fields: [sessions.activeOrgId],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(orgMembers),
  settings: one(orgSettings, {
    fields: [organizations.id],
    references: [orgSettings.orgId],
  }),
  projects: many(projects),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
  integrations: many(integrations),
  auditLogs: many(auditLogs),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const orgSettingsRelations = relations(orgSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgSettings.orgId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  keys: many(projectKeys),
  settings: one(projectSettings, {
    fields: [projects.id],
    references: [projectSettings.projectId],
  }),
  releases: many(releases),
  issues: many(issues),
  events: many(events),
  userSessions: many(userSessions),
  alertRules: many(alertRules),
  objectAssets: many(objectAssets),
}));

export const projectKeysRelations = relations(projectKeys, ({ one }) => ({
  project: one(projects, {
    fields: [projectKeys.projectId],
    references: [projects.id],
  }),
}));

export const projectSettingsRelations = relations(projectSettings, ({ one }) => ({
  project: one(projects, {
    fields: [projectSettings.projectId],
    references: [projects.id],
  }),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  project: one(projects, {
    fields: [events.projectId],
    references: [projects.id],
  }),
  issue: one(issues, {
    fields: [events.issueId],
    references: [issues.id],
  }),
}));

export const releasesRelations = relations(releases, ({ one }) => ({
  project: one(projects, {
    fields: [releases.projectId],
    references: [projects.id],
  }),
}));

export const alertRulesRelations = relations(alertRules, ({ one, many }) => ({
  project: one(projects, {
    fields: [alertRules.projectId],
    references: [projects.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  alertRule: one(alertRules, {
    fields: [notifications.alertRuleId],
    references: [alertRules.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
}));
