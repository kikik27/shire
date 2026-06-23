export interface RateLimiter {
  consume(input: {
    key: string;
    limit: number;
    windowMs: number;
    now?: number;
  }): Promise<{
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  }>;
}

export interface InMemoryRateLimiter {
  consume(input: {
    key: string;
    limit: number;
    windowMs: number;
    now?: number;
  }): Promise<{
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  }>;
}

export function createInMemoryRateLimiter(): InMemoryRateLimiter {
  const entries = new Map<
    string,
    { count: number; resetAt: number }
  >();

  return {
    async consume(input) {
      const { key, limit, windowMs, now = Date.now() } = input;

      // Zero or negative limit always blocks
      if (limit <= 0) {
        const entry = entries.get(key);
        const resetAt = entry?.resetAt ?? (now + windowMs);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((resetAt - now) / 1000),
        };
      }

      const entry = entries.get(key);
      if (entry === undefined || now >= entry.resetAt) {
        entries.set(key, {
          count: 1,
          resetAt: now + windowMs,
        });
        return {
          allowed: true,
          remaining: limit - 1,
          retryAfterSeconds: 0,
        };
      }

      if (entry.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
        };
      }

      entry.count += 1;
      return {
        allowed: true,
        remaining: limit - entry.count,
        retryAfterSeconds: 0,
      };
    },
  };
}
