import { Request, Response } from 'express';
import { organizationsService } from './orgs.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { OrganizationDto, OrgSettings } from '@/contracts/organization';
import { AppError } from '@/middleware/errors';

export class OrganizationsController {
  getOrganization = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const org = await organizationsService.getOrganization(orgId);

    const envelope: ApiSuccessEnvelope<OrganizationDto> = {
      success: true,
      data: org,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  updateOrganization = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const updated = await organizationsService.updateOrganization(
      orgId,
      { name: req.body.name },
      req.user!.id
    );

    const envelope: ApiSuccessEnvelope<OrganizationDto> = {
      success: true,
      data: updated,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const settings = await organizationsService.getSettings(orgId);

    const envelope: ApiSuccessEnvelope<OrgSettings> = {
      success: true,
      data: settings,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const settings = await organizationsService.updateSettings(
      orgId,
      req.body,
      req.user!.id
    );

    const envelope: ApiSuccessEnvelope<OrgSettings> = {
      success: true,
      data: settings,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const organizationsController = new OrganizationsController();

