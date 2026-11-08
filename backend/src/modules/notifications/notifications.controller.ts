import { Request, Response } from 'express';
import { notificationsService } from './notifications.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';
import { AppError } from '@/middleware/errors';

export class NotificationsController {
  listNotifications = async (req: Request, res: Response): Promise<void> => {
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Project ID context is required');
    }

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const items = await notificationsService.listNotifications(projectId, limit);

    const envelope: ApiSuccessEnvelope<typeof items> = {
      success: true,
      data: items,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) {
      throw AppError.badRequest('Notification ID is required');
    }

    const updated = await notificationsService.markAsRead(id);

    const envelope: ApiSuccessEnvelope<typeof updated> = {
      success: true,
      data: updated,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const notificationsController = new NotificationsController();
