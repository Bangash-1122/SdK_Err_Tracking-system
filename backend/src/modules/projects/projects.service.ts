import { projectsRepository } from './projects.repo';
import {
  CreateProjectBody,
  ProjectDto,
  RotateKeyResponse,
} from '@/contracts/project';
import { ProjectSettings } from '@/contracts/settings';
import { generateRandomHex64, hashSha256 } from '@/infra/crypto';
import { auditService } from '@/modules/audit/audit.service';
import { AppError } from '@/middleware/errors';

export class ProjectsService {
  async createProject(
    orgId: string,
    body: CreateProjectBody,
    actorId: string
  ): Promise<{ project: ProjectDto; rawIngestionKey: string }> {
    const rawIngestionKey = generateRandomHex64();
    const hashedKey = hashSha256(rawIngestionKey);
    const keyPrefix = `ep_${rawIngestionKey.substring(0, 8)}`;

    const baseSlug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'project';
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    const project = await projectsRepository.createProjectTransaction({
      organizationId: orgId,
      name: body.name,
      slug: uniqueSlug,
      platform: body.platform || 'javascript',
      rawIngestionKey,
      hashedKey,
      keyPrefix,
    });

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'project.create',
      resourceType: 'project',
      resourceId: project.id,
      metadata: { name: project.name, platform: project.platform, keyPrefix },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        organizationId: project.organizationId,
        platform: project.platform,
        apiKeyPrefix: keyPrefix,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      rawIngestionKey,
    };
  }

  async listProjects(orgId: string): Promise<ProjectDto[]> {
    const items = await projectsRepository.findProjectsByOrg(orgId);
    return items.map(({ project, keyPrefix }) => ({
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      platform: project.platform,
      apiKeyPrefix: keyPrefix,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  }

  async getProject(projectId: string): Promise<ProjectDto> {
    const project = await projectsRepository.findProjectById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    return {
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      platform: project.platform,
      apiKeyPrefix: project.apiKeyPrefix,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async updateProject(
    projectId: string,
    data: { name?: string; platform?: string },
    actorId: string,
    orgId: string
  ): Promise<ProjectDto> {
    const updated = await projectsRepository.updateProject(projectId, data);
    if (!updated) {
      throw AppError.notFound('Project not found');
    }

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'project.update',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { ...data },
    });

    return this.getProject(projectId);
  }

  async rotateKey(
    projectId: string,
    actorId: string,
    orgId: string
  ): Promise<RotateKeyResponse> {
    const project = await projectsRepository.findProjectById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    // Generate SHA-256 hashed 64-char hex key
    const rawIngestionKey = generateRandomHex64();
    const hashedKey = hashSha256(rawIngestionKey);
    const keyPrefix = `ep_${rawIngestionKey.substring(0, 8)}`;

    await projectsRepository.rotateKey(projectId, hashedKey, keyPrefix);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'project.key_rotate',
      resourceType: 'project_key',
      resourceId: keyPrefix,
      metadata: { projectId, keyPrefix },
    });

    return {
      apiKeyPrefix: keyPrefix,
      rawIngestionKey,
    };
  }

  async deleteProject(
    projectId: string,
    actorId: string,
    orgId: string
  ): Promise<void> {
    const project = await projectsRepository.findProjectById(projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    await projectsRepository.deleteProject(projectId);

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'project.delete',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { name: project.name },
    });
  }

  async getSettings(projectId: string): Promise<ProjectSettings & { version: number }> {
    const settings = await projectsRepository.findSettings(projectId);
    if (!settings) {
      throw AppError.notFound('Project settings not found');
    }

    return {
      defaultEnvironment: settings.defaultEnvironment,
      timezone: settings.timezone,
      errorSampleRate: Number(settings.errorSampleRate),
      ignoredErrors: settings.ignoredErrors as string[],
      sensitiveDataScrubbingFields: settings.sensitiveDataScrubbingFields as string[],
      telemetryRetentionDays: settings.telemetryRetentionDays,
      autoResolveInactiveDays: settings.autoResolveInactiveDays,
      regressionDetectionEnabled: settings.regressionDetectionEnabled,
      performanceSampleRate: Number(settings.performanceSampleRate),
      slowRequestThresholdMs: settings.slowRequestThresholdMs,
      version: settings.version,
    };
  }

  async updateSettings(
    projectId: string,
    update: Partial<ProjectSettings>,
    expectedVersion: number | undefined,
    actorId: string,
    orgId: string
  ): Promise<ProjectSettings & { version: number }> {
    const existing = await projectsRepository.findSettings(projectId);
    if (!existing) {
      throw AppError.notFound('Project settings not found');
    }

    const updated = await projectsRepository.updateSettingsOptimistic(
      projectId,
      update,
      expectedVersion
    );

    if (!updated) {
      throw AppError.conflict(
        'Project settings conflict: Settings were modified by another request. Please reload and try again.'
      );
    }

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'project.settings_update',
      resourceType: 'project_settings',
      resourceId: projectId,
      metadata: { ...update, version: updated.version },
    });

    return {
      defaultEnvironment: updated.defaultEnvironment,
      timezone: updated.timezone,
      errorSampleRate: Number(updated.errorSampleRate),
      ignoredErrors: updated.ignoredErrors as string[],
      sensitiveDataScrubbingFields: updated.sensitiveDataScrubbingFields as string[],
      telemetryRetentionDays: updated.telemetryRetentionDays,
      autoResolveInactiveDays: updated.autoResolveInactiveDays,
      regressionDetectionEnabled: updated.regressionDetectionEnabled,
      performanceSampleRate: Number(updated.performanceSampleRate),
      slowRequestThresholdMs: updated.slowRequestThresholdMs,
      version: updated.version,
    };
  }
}

export const projectsService = new ProjectsService();

