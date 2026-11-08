import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { AppError } from '@/middleware/errors';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AuditLogEntryDto } from '@/contracts/analytics-billing';

export class AuditController {
  listAuditLogs = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      throw AppError.forbidden('Organization context is required to view audit logs');
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const { items, nextCursor } = await auditService.listAuditLogs(orgId, {
      limit,
      cursor,
    });

    const dtoArray: AuditLogEntryDto[] = items.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      userId: item.userId,
      action: item.action,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      ipAddress: item.ipAddress,
      metadata: (item.metadata as Record<string, unknown>) || {},
      createdAt: item.createdAt,
    }));

    const envelope: ApiSuccessEnvelope<AuditLogEntryDto[]> = {
      success: true,
      data: dtoArray,
      meta: {
        requestId: req.id,
        nextCursor,
      },
    };

    res.status(200).json(envelope);
  };
}

export const auditController = new AuditController();

