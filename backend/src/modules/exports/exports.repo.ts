import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/infra/db';
import { events, issues, objectAssets } from '@/db/schema';

export class ExportsRepository {
  async getEventsForExport(projectId: string, startDate: Date, endDate: Date, limit: number = 5000) {
    return db
      .select({
        id: events.id,
        issueId: events.issueId,
        environment: events.environment,
        release: events.release,
        timestamp: events.timestamp,
        tags: events.tags,
      })
      .from(events)
      .where(
        and(
          eq(events.projectId, projectId),
          gte(events.timestamp, startDate),
          lte(events.timestamp, endDate)
        )
      )
      .orderBy(desc(events.timestamp))
      .limit(limit);
  }

  async getIssuesForExport(projectId: string, startDate: Date, endDate: Date, limit: number = 1000) {
    return db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          gte(issues.createdAt, startDate),
          lte(issues.createdAt, endDate)
        )
      )
      .orderBy(desc(issues.lastSeen))
      .limit(limit);
  }

  async recordExportAsset(data: {
    projectId: string;
    storageKey: string;
    bucketName: string;
    fileSizeBytes: number;
  }) {
    const [asset] = await db
      .insert(objectAssets)
      .values({
        projectId: data.projectId,
        storageKey: data.storageKey,
        bucketName: data.bucketName,
        assetType: 'export',
        fileSizeBytes: data.fileSizeBytes,
      })
      .returning();

    return asset;
  }
}

export const exportsRepository = new ExportsRepository();
