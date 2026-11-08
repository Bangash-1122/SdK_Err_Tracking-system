import { Request, Response } from 'express';
import { alertsService } from './alerts.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class AlertsController {
  createAlertRule = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.body.projectId as string) || req.tenant?.projectId;
    const orgId = req.tenant?.orgId;
    if (!projectId || !orgId) {
      throw AppError.badRequest('Project ID and organization context are required');
    }

    const rule = await alertsService.createAlertRule(
      projectId,
      req.body,
      req.user!.id,
      orgId
    );

    const envelope: ApiSuccessEnvelope<typeof rule> = {
      success: true,
      data: rule,
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  listAlertRules = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required');
    }

    const rules = await alertsService.listAlertRules(projectId);

    const envelope: ApiSuccessEnvelope<typeof rules> = {
      success: true,
      data: rules,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getAlertRule = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) {
      throw AppError.badRequest('Alert rule ID is required');
    }

    const rule = await alertsService.getAlertRule(id);

    const envelope: ApiSuccessEnvelope<typeof rule> = {
      success: true,
      data: rule,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  updateAlertRule = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const orgId = req.tenant?.orgId;
    if (!id || !orgId) {
      throw AppError.badRequest('Alert rule ID and organization context are required');
    }

    const updated = await alertsService.updateAlertRule(
      id,
      req.body,
      req.user!.id,
      orgId
    );

    const envelope: ApiSuccessEnvelope<typeof updated> = {
      success: true,
      data: updated,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  deleteAlertRule = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const orgId = req.tenant?.orgId;
    if (!id || !orgId) {
      throw AppError.badRequest('Alert rule ID and organization context are required');
    }

    await alertsService.deleteAlertRule(id, req.user!.id, orgId);

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: { message: 'Alert rule successfully deleted' },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const alertsController = new AlertsController();
