import { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AnalyticsQuery } from '@/contracts/analytics-billing';
import { AppError } from '@/middleware/errors';

export class AnalyticsController {
  getStats = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required to retrieve analytics stats');
    }

    const query = req.query as unknown as AnalyticsQuery;
    const stats = await analyticsService.getDashboardStats(projectId, query);

    const envelope: ApiSuccessEnvelope<typeof stats> = {
      success: true,
      data: stats,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getPerformance = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required to retrieve APM performance metrics');
    }

    const query = req.query as unknown as AnalyticsQuery;
    const performance = await analyticsService.getApmPerformance(projectId, query);

    const envelope: ApiSuccessEnvelope<typeof performance> = {
      success: true,
      data: performance,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getSessions = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required to retrieve session health metrics');
    }

    const query = req.query as unknown as AnalyticsQuery;
    const sessions = await analyticsService.getSessionHealth(projectId, query);

    const envelope: ApiSuccessEnvelope<typeof sessions> = {
      success: true,
      data: sessions,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const analyticsController = new AnalyticsController();
