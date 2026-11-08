import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/infra/db';
import { releases, objectAssets } from '@/db/schema';

export class ReleasesRepository {
  async createRelease(data: {
    projectId: string;
    version: string;
    environment?: string;
    commitSha?: string;
  }) {
    const [created] = await db
      .insert(releases)
      .values({
        projectId: data.projectId,
        version: data.version,
        environment: data.environment || 'production',
        commitSha: data.commitSha || null,
      })
      .returning();

    return created;
  }

  async listReleases(projectId: string, limit: number = 20) {
    return db
      .select()
      .from(releases)
      .where(eq(releases.projectId, projectId))
      .orderBy(desc(releases.createdAt))
      .limit(limit);
  }

  async findByVersion(projectId: string, version: string) {
    const [release] = await db
      .select()
      .from(releases)
      .where(and(eq(releases.projectId, projectId), eq(releases.version, version)))
      .limit(1);

    return release || null;
  }

  async recordSourceMapAsset(data: {
    projectId: string;
    storageKey: string;
    bucketName: string;
    fileSizeBytes?: number;
  }) {
    const [asset] = await db
      .insert(objectAssets)
      .values({
        projectId: data.projectId,
        storageKey: data.storageKey,
        bucketName: data.bucketName,
        assetType: 'sourcemap',
        fileSizeBytes: data.fileSizeBytes || 0,
      })
      .returning();

    return asset;
  }
}

export const releasesRepository = new ReleasesRepository();
