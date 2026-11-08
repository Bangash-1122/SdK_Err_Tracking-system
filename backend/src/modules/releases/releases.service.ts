import { releasesRepository } from './releases.repo';
import { CreateReleaseBody, PresignSourceMapBody } from '@/contracts/releases-alerts';
import { generatePresignedUploadUrl } from '@/infra/objectStorage';
import { auditService } from '@/modules/audit/audit.service';
import { env } from '@/config/env';

export class ReleasesService {
  async createRelease(
    projectId: string,
    body: CreateReleaseBody,
    actorId: string,
    orgId: string
  ) {
    const existing = await releasesRepository.findByVersion(projectId, body.version);
    if (existing) {
      return existing;
    }

    const release = await releasesRepository.createRelease({
      projectId,
      version: body.version,
      commitSha: body.ref,
    });

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'release.create',
      resourceType: 'release',
      resourceId: release.id,
      metadata: { version: body.version, ref: body.ref },
    });

    return release;
  }

  async listReleases(projectId: string, limit: number = 20) {
    return releasesRepository.listReleases(projectId, limit);
  }

  async presignSourceMap(
    projectId: string,
    body: PresignSourceMapBody,
    actorId: string,
    orgId: string
  ) {
    const storageKey = `sourcemaps/${projectId}/${body.release}/${body.filename}`;

    const uploadUrl = await generatePresignedUploadUrl({
      key: storageKey,
      contentType: body.contentType || 'application/json',
      expiresInSeconds: 900, // 15 mins
    });

    await releasesRepository.recordSourceMapAsset({
      projectId,
      storageKey,
      bucketName: env.S3_BUCKET_NAME,
    });

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'release.sourcemap_presign',
      resourceType: 'object_asset',
      resourceId: storageKey,
      metadata: { release: body.release, filename: body.filename },
    });

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds: 900,
    };
  }
}

export const releasesService = new ReleasesService();

