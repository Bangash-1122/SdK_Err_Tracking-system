import { eq, and, desc, lt, ilike, or, inArray, sql } from 'drizzle-orm';
import { db } from '@/infra/db';
import { issues, events } from '@/db/schema';
import { IssueStatus, IssueSeverity } from '@/contracts/issue';

export interface ListIssuesOptions {
  projectId: string;
  status?: IssueStatus;
  severity?: IssueSeverity;
  search?: string;
  cursor?: string; // encoded composite cursor: "timestamp_id"
  limit?: number;
}

export class IssuesRepository {
  async listIssues(options: ListIssuesOptions) {
    const { projectId, status, severity, search, cursor, limit = 20 } = options;

    const conditions = [eq(issues.projectId, projectId)];

    if (status) {
      conditions.push(eq(issues.status, status));
    }

    if (severity) {
      conditions.push(eq(issues.severity, severity));
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(issues.title, pattern),
          ilike(issues.type, pattern),
          ilike(issues.fingerprint, pattern)
        )!
      );
    }

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorTimeStr, cursorId] = decoded.split('_');
        if (cursorTimeStr && cursorId) {
          const cursorDate = new Date(cursorTimeStr);
          conditions.push(
            or(
              lt(issues.lastSeen, cursorDate),
              and(eq(issues.lastSeen, cursorDate), lt(issues.id, cursorId))
            )!
          );
        }
      } catch {
        // Ignore invalid cursor format
      }
    }

    const items = await db
      .select()
      .from(issues)
      .where(and(...conditions))
      .orderBy(desc(issues.lastSeen), desc(issues.id))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop()!;
      const rawCursor = `${nextItem.lastSeen.toISOString()}_${nextItem.id}`;
      nextCursor = Buffer.from(rawCursor, 'utf8').toString('base64');
    }

    return { items, nextCursor };
  }

  async searchIssues(projectId: string, query: string, limit: number = 20) {
    const pattern = `%${query.trim()}%`;

    const results = await db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          or(
            ilike(issues.title, pattern),
            ilike(issues.type, pattern),
            ilike(issues.fingerprint, pattern)
          )
        )
      )
      .orderBy(desc(issues.lastSeen))
      .limit(limit);

    return results;
  }

  async findIssueById(issueId: string, projectId?: string) {
    const conditions = [eq(issues.id, issueId)];
    if (projectId) {
      conditions.push(eq(issues.projectId, projectId));
    }

    const [issue] = await db
      .select()
      .from(issues)
      .where(and(...conditions))
      .limit(1);

    return issue || null;
  }

  async findIssueWithLatestEvent(issueId: string, projectId?: string) {
    const issue = await this.findIssueById(issueId, projectId);
    if (!issue) return null;

    const [latestEvent] = await db
      .select()
      .from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(desc(events.timestamp))
      .limit(1);

    return {
      issue,
      latestEvent: latestEvent || null,
    };
  }

  async updateStatusOptimistic(
    issueId: string,
    status: IssueStatus,
    expectedVersion?: number,
    projectId?: string
  ) {
    const conditions = [eq(issues.id, issueId)];
    if (expectedVersion !== undefined) {
      conditions.push(eq(issues.version, expectedVersion));
    }
    if (projectId) {
      conditions.push(eq(issues.projectId, projectId));
    }

    const [updated] = await db
      .update(issues)
      .set({
        status,
        version: sql`${issues.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    return updated || null;
  }

  async bulkUpdateStatus(
    issueIds: string[],
    status: IssueStatus,
    projectId: string
  ) {
    const updated = await db
      .update(issues)
      .set({
        status,
        version: sql`${issues.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(inArray(issues.id, issueIds), eq(issues.projectId, projectId)))
      .returning();

    return updated;
  }
}

export const issuesRepository = new IssuesRepository();
