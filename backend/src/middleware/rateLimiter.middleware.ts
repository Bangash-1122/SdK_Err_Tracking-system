import { Request, Response, NextFunction, RequestHandler } from 'express';
import { redis } from '@/infra/redis';
import { AppError } from './errors';

const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2]) -- tokens per millisecond
local now = tonumber(ARGV[3])
local requested = 1

local data = redis.call("HMGET", key, "tokens", "lastRefill")
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if not tokens then
  tokens = capacity
  lastRefill = now
else
  local elapsed = math.max(0, now - lastRefill)
  tokens = math.min(capacity, tokens + (elapsed * refillRate))
  lastRefill = now
end

if tokens >= requested then
  tokens = tokens - requested
  redis.call("HMSET", key, "tokens", tokens, "lastRefill", lastRefill)
  redis.call("PEXPIRE", key, math.ceil(capacity / refillRate))
  return {1, math.floor(tokens), 0}
else
  local missing = requested - tokens
  local waitMs = math.ceil(missing / refillRate)
  return {0, math.floor(tokens), math.ceil(waitMs / 1000)}
end
`;

export interface RateLimiterOptions {
  limit?: number; // Maximum burst / capacity (default: 60)
  windowSeconds?: number; // Refill window (default: 60s)
}

/**
 * Middleware Step 8: Atomic Redis Token-Bucket Rate Limiter
 * Keyed by Project Key > Organization ID > Client IP
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const { limit = 60, windowSeconds = 60 } = options;
  const refillRate = limit / (windowSeconds * 1000); // tokens per millisecond

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determine priority rate-limit identifier
      const rawApiKey = req.headers['x-api-key'];
      const apiKey = typeof rawApiKey === 'string' ? rawApiKey : Array.isArray(rawApiKey) ? rawApiKey[0] : undefined;
      const orgId = req.tenant?.orgId;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      let key: string;
      if (apiKey) {
        key = `ratelimit:key:${apiKey.substring(0, 16)}`;
      } else if (orgId) {
        key = `ratelimit:org:${orgId}`;
      } else {
        key = `ratelimit:ip:${clientIp}`;
      }

      const now = Date.now();
      const result = (await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        key,
        limit,
        refillRate,
        now
      )) as [number, number, number];

      const [allowed, remainingTokens, retryAfterSeconds] = result;

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remainingTokens).toString());

      if (allowed === 0) {
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        return next(
          new AppError(
            429,
            'RATE_LIMIT_EXCEEDED',
            `Too many requests. Rate limit exceeded, retry after ${retryAfterSeconds} seconds`,
            { retryAfter: retryAfterSeconds }
          )
        );
      }

      next();
    } catch (error) {
      // If Redis has a transient failure, fail-open to avoid taking down healthy traffic
      console.warn('Rate limiter Redis error, failing open:', error);
      next();
    }
  };
}

export const defaultRateLimiter = createRateLimiter();

