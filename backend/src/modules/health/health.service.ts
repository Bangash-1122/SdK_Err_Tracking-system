import { pool } from '@/infra/db';
import { redis } from '@/infra/redis';

export interface LiveStatus {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadyStatus {
  status: 'ready' | 'degraded';
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  latencyMs: {
    database: number;
    redis: number;
  };
  timestamp: string;
}

export interface SystemStatus {
  status: 'ok';
  version: string;
  environment: string;
  uptimeSeconds: number;
  process: {
    pid: number;
    nodeVersion: string;
    memoryUsageMB: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  timestamp: string;
}

export interface CacheDiagnostics {
  redisConnected: boolean;
  pingResponse: string;
  keyspaceStats: Record<string, string>;
  scannedKeyCounts: {
    rateLimitKeys: number;
    lockKeys: number;
    tagKeys: number;
  };
}

export class HealthService {
  getLiveStatus(): LiveStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadyStatus(): Promise<ReadyStatus> {
    const timestamp = new Date().toISOString();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let redisStatus: 'connected' | 'disconnected' = 'disconnected';
    let dbLatencyMs = -1;
    let redisLatencyMs = -1;

    // 1. Check PostgreSQL with 2000ms timeout
    try {
      const dbStart = process.hrtime.bigint();
      const client = await Promise.race([
        pool.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB connection timed out')), 2000)
        ),
      ]);
      await client.query('SELECT 1');
      client.release();
      dbLatencyMs = Number(process.hrtime.bigint() - dbStart) / 1_000_000;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    // 2. Check Redis with 2000ms timeout
    try {
      const redisStart = process.hrtime.bigint();
      const ping = await Promise.race([
        redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timed out')), 2000)
        ),
      ]);
      if (ping === 'PONG') {
        redisLatencyMs = Number(process.hrtime.bigint() - redisStart) / 1_000_000;
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'disconnected';
    }

    const isReady = dbStatus === 'connected' && redisStatus === 'connected';

    return {
      status: isReady ? 'ready' : 'degraded',
      database: dbStatus,
      redis: redisStatus,
      latencyMs: {
        database: Math.round(dbLatencyMs * 100) / 100,
        redis: Math.round(redisLatencyMs * 100) / 100,
      },
      timestamp,
    };
  }

  getSystemStatus(): SystemStatus {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        memoryUsageMB: {
          rss: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
          heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
          heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          external: Math.round((mem.external / 1024 / 1024) * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getCacheDiagnostics(): Promise<CacheDiagnostics> {
    let pingResponse = 'FAIL';
    let redisConnected = false;
    const keyspaceStats: Record<string, string> = {};

    try {
      pingResponse = await redis.ping();
      redisConnected = pingResponse === 'PONG';

      const info = await redis.info('memory');
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line && !line.startsWith('#') && line.includes(':')) {
          const [k, v] = line.split(':');
          if (k && v && (k.includes('used_memory') || k.includes('mem_fragmentation'))) {
            keyspaceStats[k] = v;
          }
        }
      }
    } catch {
      redisConnected = false;
    }

    // Non-blocking scan sample counts
    let rateLimitKeys = 0;
    let lockKeys = 0;
    let tagKeys = 0;

    try {
      if (redisConnected) {
        const [_, foundRateLimit] = await redis.scan('0', 'MATCH', 'ratelimit:*', 'COUNT', 50);
        rateLimitKeys = foundRateLimit.length;

        const [__, foundLock] = await redis.scan('0', 'MATCH', 'lock:*', 'COUNT', 50);
        lockKeys = foundLock.length;

        const [___, foundTag] = await redis.scan('0', 'MATCH', 'tag:*', 'COUNT', 50);
        tagKeys = foundTag.length;
      }
    } catch {}

    return {
      redisConnected,
      pingResponse,
      keyspaceStats,
      scannedKeyCounts: {
        rateLimitKeys,
        lockKeys,
        tagKeys,
      },
    };
  }
}

export const healthService = new HealthService();

