import { Redis } from 'ioredis';
import { env } from '@/config/env';

// Shared application Redis client
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

// Dedicated connection factory for BullMQ workers and queues
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export interface CacheWrapOptions {
  jitterPercent?: number; // default 10%
  lockTimeoutMs?: number; // default 5000ms
  tag?: string;
}

/**
 * Cache-aside helper with TTL jitter to prevent stampedes and distributed lock
 */
export async function cacheWrap<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  options: CacheWrapOptions = {}
): Promise<T> {
  const { jitterPercent = 0.1, lockTimeoutMs = 5000, tag } = options;

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn(`Redis cache get error for key ${key}:`, err);
  }

  // Stampede lock to prevent dog-piling
  const lockKey = `lock:${key}`;
  const lockToken = Math.random().toString(36).substring(2);
  let hasLock = false;

  try {
    const lockAcquired = await redis.set(lockKey, lockToken, 'PX', lockTimeoutMs, 'NX');
    hasLock = lockAcquired === 'OK';
  } catch {
    hasLock = false;
  }

  if (!hasLock) {
    // Wait briefly and retry reading from cache
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch {}
  }

  const result = await fetcher();

  try {
    // Calculate jitter (+/- jitterPercent)
    const jitterMultiplier = 1 + (Math.random() * 2 * jitterPercent - jitterPercent);
    const finalTtl = Math.max(1, Math.round(ttlSeconds * jitterMultiplier));

    const pipeline = redis.pipeline();
    pipeline.set(key, JSON.stringify(result), 'EX', finalTtl);

    if (tag) {
      pipeline.sadd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, finalTtl + 60);
    }

    if (hasLock) {
      // Release lock atomically with Lua
      pipeline.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        lockKey,
        lockToken
      );
    }

    await pipeline.exec();
  } catch (err) {
    console.warn(`Redis cache set error for key ${key}:`, err);
  }

  return result;
}

/**
 * Invalidate all cache entries associated with a tag
 */
export async function invalidateByTag(tag: string): Promise<number> {
  try {
    const tagKey = `tag:${tag}`;
    const keys = await redis.smembers(tagKey);
    if (keys.length === 0) return 0;

    const pipeline = redis.pipeline();
    pipeline.del(...keys);
    pipeline.del(tagKey);
    await pipeline.exec();
    return keys.length;
  } catch (err) {
    console.error(`Error invalidating cache tag ${tag}:`, err);
    return 0;
  }
}

/**
 * Invalidate keys matching a pattern using non-blocking SCAN
 */
export async function invalidateByPrefix(prefix: string): Promise<number> {
  let cursor = '0';
  let totalDeleted = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error(`Error scanning prefix ${prefix}:`, err);
  }

  return totalDeleted;
}
