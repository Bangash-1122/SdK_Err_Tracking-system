import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/infra/db';
import { projects, projectKeys, projectSettings } from '@/db/schema';
import { ProjectSettings } from '@/contracts/settings';

export class ProjectsRepository {
  async createProjectTransaction(data: {
    organizationId: string;
    name: string;
    slug: string;
    platform: string;
    rawIngestionKey: string;
    hashedKey: string;
    keyPrefix: string;
  }) {
    return db.transaction(async (tx) => {
      // 1. Create Project
      const [newProject] = await tx
        .insert(projects)
        .values({
          organizationId: data.organizationId,
          name: data.name.trim(),
          slug: data.slug,
          platform: data.platform,
        })
        .returning();

      // 2. Create Initial Active Key
      await tx.insert(projectKeys).values({
        projectId: newProject.id,
        keyPrefix: data.keyPrefix,
        hashedKey: data.hashedKey,
        isActive: true,
      });

      // 3. Create Default Project Settings (Sections A-E, G, H, J)
      await tx.insert(projectSettings).values({
        projectId: newProject.id,
        defaultEnvironment: 'production',
        timezone: 'UTC',
        errorSampleRate: '1.0',
        ignoredErrors: [],
        sensitiveDataScrubbingFields: [
          'password',
          'secret',
          'token',
          'authorization',
          'creditCard',
          'cvv',
        ],
        telemetryRetentionDays: 30,
        autoResolveInactiveDays: 14,
        regressionDetectionEnabled: true,
        performanceSampleRate: '1.0',
        slowRequestThresholdMs: 1000,
        version: 1,
      });

      return newProject;
    });
  }

  async findProjectsByOrg(orgId: string) {
    const rows = await db
      .select({
        project: projects,
        key: projectKeys,
      })
      .from(projects)
      .leftJoin(
        projectKeys,
        and(eq(projects.id, projectKeys.projectId), eq(projectKeys.isActive, true))
      )
      .where(eq(projects.organizationId, orgId))
      .orderBy(desc(projects.createdAt));

    // Group rows by project to avoid duplicates if multiple active keys
    const projectMap = new Map<string, { project: typeof projects.$inferSelect; keyPrefix: string }>();

    for (const row of rows) {
      if (!projectMap.has(row.project.id)) {
        projectMap.set(row.project.id, {
          project: row.project,
          keyPrefix: row.key?.keyPrefix || 'ep_unknown',
        });
      }
    }

    return Array.from(projectMap.values());
  }

  async findProjectById(projectId: string) {
    const [row] = await db
      .select({
        project: projects,
        key: projectKeys,
      })
      .from(projects)
      .leftJoin(
        projectKeys,
        and(eq(projects.id, projectKeys.projectId), eq(projectKeys.isActive, true))
      )
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!row) return null;

    return {
      ...row.project,
      apiKeyPrefix: row.key?.keyPrefix || 'ep_unknown',
    };
  }

  async updateProject(
    projectId: string,
    data: { name?: string; platform?: string }
  ) {
    const [updated] = await db
      .update(projects)
      .set({
        ...(data.name && { name: data.name.trim() }),
        ...(data.platform && { platform: data.platform }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return updated || null;
  }

  async findSettings(projectId: string) {
    const [settings] = await db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId))
      .limit(1);

    return settings || null;
  }

  async updateSettingsOptimistic(
    projectId: string,
    update: Partial<ProjectSettings>,
    expectedVersion?: number
  ) {
    const conditions = [eq(projectSettings.projectId, projectId)];
    if (expectedVersion !== undefined) {
      conditions.push(eq(projectSettings.version, expectedVersion));
    }

    const current = await this.findSettings(projectId);
    const nextVersion = (current?.version || 1) + 1;

    const [updated] = await db
      .update(projectSettings)
      .set({
        ...(update.defaultEnvironment !== undefined && { defaultEnvironment: update.defaultEnvironment }),
        ...(update.timezone !== undefined && { timezone: update.timezone }),
        ...(update.errorSampleRate !== undefined && { errorSampleRate: String(update.errorSampleRate) }),
        ...(update.ignoredErrors !== undefined && { ignoredErrors: update.ignoredErrors }),
        ...(update.sensitiveDataScrubbingFields !== undefined && { sensitiveDataScrubbingFields: update.sensitiveDataScrubbingFields }),
        ...(update.telemetryRetentionDays !== undefined && { telemetryRetentionDays: update.telemetryRetentionDays }),
        ...(update.autoResolveInactiveDays !== undefined && { autoResolveInactiveDays: update.autoResolveInactiveDays }),
        ...(update.regressionDetectionEnabled !== undefined && { regressionDetectionEnabled: update.regressionDetectionEnabled }),
        ...(update.performanceSampleRate !== undefined && { performanceSampleRate: String(update.performanceSampleRate) }),
        ...(update.slowRequestThresholdMs !== undefined && { slowRequestThresholdMs: update.slowRequestThresholdMs }),
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    return updated || null;
  }

  async rotateKey(projectId: string, hashedKey: string, keyPrefix: string) {
    return db.transaction(async (tx) => {
      // 1. Insert newly rotated active key
      const [newKey] = await tx
        .insert(projectKeys)
        .values({
          projectId,
          keyPrefix,
          hashedKey,
          isActive: true,
        })
        .returning();

      return newKey;
    });
  }

  async deleteProject(projectId: string) {
    // Cascades automatically to projectKeys, projectSettings, events, issues, etc.
    await db.delete(projects).where(eq(projects.id, projectId));
  }
}

export const projectsRepository = new ProjectsRepository();

