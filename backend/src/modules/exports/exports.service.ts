import { exportsRepository } from './exports.repo';
import { generatePresignedDownloadUrl } from '@/infra/objectStorage';
import { auditService } from '@/modules/audit/audit.service';
import { env } from '@/config/env';

export interface ExportParams {
  projectId: string;
  type?: 'events' | 'issues';
  format?: 'json' | 'csv';
  startDate: Date;
  endDate: Date;
  actorId: string;
  orgId: string;
}

export class ExportsService {
  async exportTelemetry(params: ExportParams) {
    const { projectId, type = 'events', format = 'json', startDate, endDate, actorId, orgId } = params;

    let dataRows: unknown[];
    if (type === 'issues') {
      dataRows = await exportsRepository.getIssuesForExport(projectId, startDate, endDate);
    } else {
      dataRows = await exportsRepository.getEventsForExport(projectId, startDate, endDate);
    }

    const storageKey = `exports/${projectId}/${type}_${Date.now()}.${format}`;

    // Generate download URL
    const downloadUrl = await generatePresignedDownloadUrl({
      key: storageKey,
      bucket: env.S3_BUCKET_NAME,
      expiresInSeconds: 3600, // 1 hour
    });

    const fileSizeBytes = JSON.stringify(dataRows).length;

    await exportsRepository.recordExportAsset({
      projectId,
      storageKey,
      bucketName: env.S3_BUCKET_NAME,
      fileSizeBytes,
    });

    await auditService.record({
      organizationId: orgId,
      userId: actorId,
      action: 'export.create',
      resourceType: 'export',
      resourceId: storageKey,
      metadata: { type, format, recordCount: dataRows.length },
    });

    return {
      type,
      format,
      recordCount: dataRows.length,
      storageKey,
      downloadUrl,
      expiresInSeconds: 3600,
    };
  }
}

export const exportsService = new ExportsService();

