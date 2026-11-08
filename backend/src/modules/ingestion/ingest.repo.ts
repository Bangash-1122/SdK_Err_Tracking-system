import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import {
  projects,
  projectKeys,
  projectSettings,
  issues,
  events,
  outbox,
} from '@/db/schema';
import { IngestEventPayload } from '@/contracts/event';
import { hashSha256 } from '@/infra/crypto';

export interface IngestTransactionParams {
  projectId: string;
  fingerprint: string;
  title: string;
  type: string;
  severity: string;
  payload: IngestEventPayload;
  regressionDetectionEnabled: boolean;
}

export interface IngestTransactionResult {
  eventId: string;
  issueId: string;
  isNewIssue: boolean;
  isRegression: boolean;
}

export class IngestRepository {
  async validateProjectKey(rawKey: string): Promise<{ projectId: string; keyPrefix: string } | null> {
    const hashedKey = hashSha256(rawKey);

    const [keyRecord] = await db
      .select({
        projectId: projectKeys.projectId,
        keyPrefix: projectKeys.keyPrefix,
      })
      .from(projectKeys)
      .where(and(eq(projectKeys.hashedKey, hashedKey), eq(projectKeys.isActive, true)))
      .limit(1);

    return keyRecord || null;
  }

  async getProjectSettings(projectId: string) {
    const [settings] = await db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId))
      .limit(1);

    return settings || null;
  }

  async recordIngestTransaction(
    params: IngestTransactionParams
  ): Promise<IngestTransactionResult> {
    return db.transaction(async (tx) => {
      const now = new Date();
      let issueId: string;
      let isNewIssue = false;
      let isRegression = false;

      // 1. Lock and lookup existing issue by (projectId, fingerprint)
      const [existingIssue] = await tx
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.projectId, params.projectId),
            eq(issues.fingerprint, params.fingerprint)
          )
        )
        .for('update')
        .limit(1);

      if (existingIssue) {
        issueId = existingIssue.id;

        // Check for regression (previously resolved issue receiving new event)
        if (existingIssue.status === 'resolved' && params.regressionDetectionEnabled) {
          isRegression = true;
        }

        const newStatus = isRegression ? 'unresolved' : existingIssue.status;

        // Determine if this event introduces a new distinct user
        const isDistinctUser = Boolean(params.payload.user?.id || params.payload.user?.email);

        await tx
          .update(issues)
          .set({
            count: sql`${issues.count} + 1`,
            userCount: isDistinctUser ? sql`${issues.userCount} + 1` : issues.userCount,
            lastSeen: now,
            status: newStatus,
            version: sql`${issues.version} + 1`,
            updatedAt: now,
          })
          .where(eq(issues.id, issueId));
      } else {
        isNewIssue = true;
        const [createdIssue] = await tx
          .insert(issues)
          .values({
            projectId: params.projectId,
            fingerprint: params.fingerprint,
            title: params.title.substring(0, 500),
            type: params.type.substring(0, 255),
            severity: params.severity,
            status: 'unresolved',
            count: 1,
            userCount: 1,
            firstSeen: now,
            lastSeen: now,
            version: 1,
          })
          .returning();

        issueId = createdIssue.id;
      }

      // 2. Insert event record into events table
      const eventTimestamp = params.payload.timestamp
        ? new Date(params.payload.timestamp)
        : now;

      const [createdEvent] = await tx
        .insert(events)
        .values({
          projectId: params.projectId,
          issueId,
          stacktrace: params.payload.exception?.stacktrace || null,
          breadcrumbs: params.payload.breadcrumbs || [],
          tags: params.payload.tags || {},
          extra: params.payload.extra || null,
          user: params.payload.user || null,
          request: params.payload.request || null,
          sdk: params.payload.sdk || null,
          environment: params.payload.environment || 'production',
          release: params.payload.release || null,
          timestamp: eventTimestamp,
        })
        .returning();

      // 3. Atomically increment project event count
      await tx
        .update(projects)
        .set({
          eventCount: sql`${projects.eventCount} + 1`,
          updatedAt: now,
        })
        .where(eq(projects.id, params.projectId));

      // 4. Insert transactional outbox record for async alert/notification pipelines
      const topic = isRegression
        ? 'issue.regression'
        : isNewIssue
        ? 'issue.new'
        : 'event.ingested';

      await tx.insert(outbox).values({
        dedupeKey: `evt_${createdEvent.id}`,
        topic,
        payload: {
          projectId: params.projectId,
          issueId,
          eventId: createdEvent.id,
          isNewIssue,
          isRegression,
          fingerprint: params.fingerprint,
          title: params.title,
          severity: params.severity,
          environment: params.payload.environment || 'production',
          release: params.payload.release || null,
          timestamp: eventTimestamp.toISOString(),
        },
        status: 'pending',
      });

      return {
        eventId: createdEvent.id,
        issueId,
        isNewIssue,
        isRegression,
      };
    });
  }
}

export const ingestRepository = new IngestRepository();
