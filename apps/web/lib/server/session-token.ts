import { SignJWT, jwtVerify } from "jose";

/**
 * Pure session-token logic — no `next/headers` dependency, so it stays safe to
 * import from tests and from the pure `resolveAuthenticatedUser` resolver.
 *
 * The cookie-setting helpers (`createSession`/`clearSession`) live in
 * `session.ts` and depend on `next/headers`; they are only used by the API
 * route handler.
 */

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sessionSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET?.trim();
  if (raw) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  return new TextEncoder().encode("shire-dev-session-secret-not-for-production");
}

export type SessionPayload = {
  address: string;
  /** Synthetic stable id used as the app_users.privyUserId key. */
  privyUserId: string;
};

export const SESSION_COOKIE_NAME = "shire_session";

/** Derive the synthetic privyUserId we key Stellar users by. */
export function stellarPrivyUserId(address: string): string {
  return `stellar:${address}`;
}

/** Sign a session token for the given Stellar address. */
export async function signSessionToken(address: string): Promise<string> {
  const privyUserId = stellarPrivyUserId(address);
  return new SignJWT({ address, privyUserId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

/**
 * Verify a session token. Pure — reads only the token string, no cookies.
 * Returns the payload, or null if invalid/expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const address = (payload as { address?: unknown }).address;
    const privyUserId = (payload as { privyUserId?: unknown }).privyUserId;
    if (typeof address !== "string" || typeof privyUserId !== "string") return null;
    return { address, privyUserId };
  } catch {
    return null;
  }
}

/**
 * Read & verify a session from a raw Cookie header value. Pure — works without
 * the `next/headers` cookies() helper so it stays usable inside the pure,
 * injectable `resolveAuthenticatedUser` (which receives a Request).
 */
export async function readSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(cookieHeader);
  const token = match?.[1];
  if (!token) return null;

  return verifySessionToken(token);
}
