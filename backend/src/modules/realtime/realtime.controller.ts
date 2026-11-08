import { Request, Response } from 'express';
import { redis } from '@/infra/redis';

export class RealtimeController {
  streamIssues = async (req: Request, res: Response): Promise<void> => {
    const orgId = req.tenant?.orgId;
    const projectId = (req.query.projectId as string) || req.tenant?.projectId;

    // Set Server-Sent Events (SSE) HTTP response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering (Nginx)
    });

    // 1. Initial Handshake Event
    const handshake = {
      event: 'connected',
      data: {
        status: 'streaming',
        organizationId: orgId,
        projectId: projectId || 'all',
        connectedAt: new Date().toISOString(),
      },
    };
    res.write(`event: connected\ndata: ${JSON.stringify(handshake.data)}\n\n`);

    // 2. Periodic keep-alive heartbeat comment to prevent client connection timeouts
    const heartbeatInterval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    // 3. Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      res.end();
    });
  };
}

export const realtimeController = new RealtimeController();
