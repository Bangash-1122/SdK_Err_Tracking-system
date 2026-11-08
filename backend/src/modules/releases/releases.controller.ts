import { Request, Response } from 'express';
import { releasesService } from './releases.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class ReleasesController {
  createRelease = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.body.projectId as string) || req.tenant?.projectId;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const release = await releasesService.createRelease(
      projectId,
      req.body,
      req.user!.id,
      orgId
    );

    const envelope: ApiSuccessEnvelope<typeof release> = {
      success: true,
      data: release,
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  listReleases = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required');
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const items = await releasesService.listReleases(projectId, limit);

    const envelope: ApiSuccessEnvelope<typeof items> = {
      success: true,
      data: items,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  presignSourceMap = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.body.projectId as string) || req.tenant?.projectId;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const result = await releasesService.presignSourceMap(
      projectId,
      req.body,
      req.user!.id,
      orgId
    );

    const envelope: ApiSuccessEnvelope<typeof result> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const releasesController = new ReleasesController();
