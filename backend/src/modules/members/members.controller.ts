import { Request, Response } from 'express';
import { membersService } from './members.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class MembersController {
  listMembers = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const members = await membersService.listMembers(orgId);

    const envelope: ApiSuccessEnvelope<typeof members> = {
      success: true,
      data: members,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  inviteMember = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    if (!orgId) {
      throw AppError.badRequest('Organization ID is required');
    }

    const member = await membersService.inviteMember(
      orgId,
      req.body,
      req.user!.id
    );

    const envelope: ApiSuccessEnvelope<typeof member> = {
      success: true,
      data: member,
      meta: {
        requestId: req.id,
      },
    };

    res.status(201).json(envelope);
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    const { memberId } = req.params;
    if (!orgId || !memberId) {
      throw AppError.badRequest('Organization ID and Member ID are required');
    }

    const updated = await membersService.updateMemberRole(
      orgId,
      memberId,
      req.body.role,
      req.user!.id
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

  removeMember = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.tenant?.orgId;
    const { memberId } = req.params;
    if (!orgId || !memberId) {
      throw AppError.badRequest('Organization ID and Member ID are required');
    }

    await membersService.removeMember(orgId, memberId, req.user!.id);

    const envelope: ApiSuccessEnvelope<{ message: string }> = {
      success: true,
      data: { message: 'Member successfully removed' },
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const membersController = new MembersController();

