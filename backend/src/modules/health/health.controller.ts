import { Request, Response } from 'express';
import { healthService } from './health.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';

export class HealthController {
  getLive = (_req: Request, res: Response): void => {
    const data = healthService.getLiveStatus();
    const envelope: ApiSuccessEnvelope<typeof data> = {
      success: true,
      data,
      meta: {
        requestId: _req.id,
      },
    };
    res.status(200).json(envelope);
  };

  getReady = async (req: Request, res: Response): Promise<void> => {
    const data = await healthService.getReadyStatus();
    const statusCode = data.status === 'ready' ? 200 : 503;
    const envelope: ApiSuccessEnvelope<typeof data> = {
      success: true,
      data,
      meta: {
        requestId: req.id,
      },
    };
    res.status(statusCode).json(envelope);
  };

  getSystemStatus = (req: Request, res: Response): void => {
    const data = healthService.getSystemStatus();
    const envelope: ApiSuccessEnvelope<typeof data> = {
      success: true,
      data,
      meta: {
        requestId: req.id,
      },
    };
    res.status(200).json(envelope);
  };

  getCacheDiagnostics = async (req: Request, res: Response): Promise<void> => {
    const data = await healthService.getCacheDiagnostics();
    const envelope: ApiSuccessEnvelope<typeof data> = {
      success: true,
      data,
      meta: {
        requestId: req.id,
      },
    };
    res.status(200).json(envelope);
  };
}

export const healthController = new HealthController();

