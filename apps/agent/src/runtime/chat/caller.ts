import type { RateLimiter } from "../auth/rate-limit";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIpAddress(ip: string): string {
  // Normalize IPv6 mapped IPv4 addresses
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}

export function resolveChatCallerKey(body: unknown, ip: string | undefined): string {
  const viewerId = extractViewerId(body);
  if (viewerId) {
    return `viewer:${viewerId}`;
  }

  if (ip) {
    return `ip:${normalizeIpAddress(ip)}`;
  }

  return `unknown:${crypto.randomUUID()}`;
}

function extractViewerId(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  // Check scope.viewerId first
  if (isRecord(body.scope) && typeof body.scope.viewerId === "string") {
    return body.scope.viewerId;
  }

  // Check scope.userId as fallback
  if (isRecord(body.scope) && typeof body.scope.userId === "string") {
    return body.scope.userId;
  }

  return undefined;
}

export interface ChatCallerDependencies {
  rateLimiter: RateLimiter;
  ip?: string;
  now?: () => number;
}

export async function enforceChatRateLimit(
  body: unknown,
  dependencies: ChatCallerDependencies,
  limit: number,
  windowMs: number,
): Promise<
  | { allowed: true; callerKey: string }
  | { allowed: false; callerKey: string; retryAfterSeconds: number }
> {
  const { rateLimiter, ip: clientIp, now = Date.now } = dependencies;
  const callerKey = resolveChatCallerKey(body, clientIp);

  const result = await rateLimiter.consume({
    key: callerKey,
    limit,
    windowMs,
    now: now(),
  });

  if (!result.allowed) {
    return {
      allowed: false,
      callerKey,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    callerKey,
  };
}
