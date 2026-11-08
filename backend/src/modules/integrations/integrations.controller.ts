import { Request, Response } from 'express';
import { integrationsService } from './integrations.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class IntegrationsController {
  createIntegration = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization context is required');
    }

    const { type, ...config } = req.body;
    if (!type) {
      throw AppError.badRequest('Integration type is required');
    }

    const integration = await integrationsService.createIntegration(
      orgId,
      type,
      config,
      req.user!.id
    );

    const envelope: ApiSuccessEnvelope<typeof integration> = {
      success: true,
      data: integration,
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  listIntegrations = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization context is required');
    }

    const items = await integrationsService.listIntegrations(orgId);

    const envelope: ApiSuccessEnvelope<typeof items> = {
      success: true,
      data: items,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  testDelivery = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const orgId = req.tenant?.orgId;
    if (!id || !orgId) {
      throw AppError.badRequest('Integration ID and organization context are required');
    }

    const result = await integrationsService.testDelivery(id, req.user!.id, orgId);

    const envelope: ApiSuccessEnvelope<typeof result> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  deleteIntegration = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const orgId = req.tenant?.orgId;
    if (!id || !orgId) {
      throw AppError.badRequest('Integration ID and organization context are required');
    }

    await integrationsService.deleteIntegration(id, req.user!.id, orgId);

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: { message: 'Integration successfully deleted' },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const integrationsController = new IntegrationsController();
