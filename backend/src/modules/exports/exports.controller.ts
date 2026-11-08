import { Request, Response } from 'express';
import { exportsService } from './exports.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class ExportsController {
  exportTelemetry = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.body.projectId as string) || req.tenant?.projectId;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();

    const result = await exportsService.exportTelemetry({
      projectId,
      type: req.body.type || 'events',
      format: req.body.format || 'json',
      startDate,
      endDate,
      actorId: req.user!.id,
      orgId,
    });

    const envelope: ApiSuccessEnvelope<typeof result> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(202).json(envelope);
  };
}

export const exportsController = new ExportsController();

