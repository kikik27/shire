import { cookies } from "next/headers";

import {
  signSessionToken,
  SESSION_COOKIE_NAME,
  readSessionFromRequest as readSession,
  stellarPrivyUserId,
  type SessionPayload,
} from "./session-token";

export {
  SESSION_COOKIE_NAME,
  readSession,
  stellarPrivyUserId,
  type SessionPayload,
};

/**
 * Cookie-aware session helpers used by the auth API route handler. The pure
 * token logic lives in session-token.ts (no next/headers) so it stays import-
 * safe from tests and the resolver.
 */

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Sign and set the session cookie for the given Stellar address. */
export async function createSession(address: string): Promise<void> {
  const token = await signSessionToken(address);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Remove the session cookie (logout). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
