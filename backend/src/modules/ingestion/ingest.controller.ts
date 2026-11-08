import { Request, Response } from 'express';
import { ingestService } from './ingest.service';
import { ApiSuccessEnvelope } from '@/contracts/envelope';

function extractApiKey(req: Request): string | undefined {
  // 1. Header: X-Api-Key
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }

  // 2. Header: Authorization: Bearer <key>
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 3. Header: X-Sentry-Auth / Sentry SDK compatibility
  const sentryAuth = req.headers['x-sentry-auth'];
  if (typeof sentryAuth === 'string') {
    const match = sentryAuth.match(/sentry_key=([a-fA-F0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 4. Query parameter: ?api_key=... or ?ep_key=...
  if (typeof req.query.api_key === 'string' && req.query.api_key.trim()) {
    return req.query.api_key.trim();
  }
  if (typeof req.query.ep_key === 'string' && req.query.ep_key.trim()) {
    return req.query.ep_key.trim();
  }

  return undefined;
}

export class IngestController {
  ingestEvent = async (req: Request, res: Response): Promise<void> => {
    const rawKey = extractApiKey(req);
    const { projectId } = await ingestService.authenticateApiKey(rawKey);

    const result = await ingestService.processEvent(projectId, req.body, req.ip);

    const statusCode = result.status === 'accepted' ? 202 : 200;

    const envelope: ApiSuccessEnvelope<typeof result> = {
      success: true,
      data: result,
      meta: {
        requestId: req.id,
      },
    };

    res.status(statusCode).json(envelope);
  };

  getSdkHealth = async (req: Request, res: Response): Promise<void> => {
    const health = ingestService.getSdkHealth();

    const envelope: ApiSuccessEnvelope<typeof health> = {
      success: true,
      data: health,
      meta: {
        requestId: req.id,
      },
    };

    res.status(200).json(envelope);
  };
}

export const ingestController = new IngestController();

