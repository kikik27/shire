import { NextResponse } from "next/server";

import { verifyStellarChallenge, StellarAuthError } from "@/lib/server/stellar-auth";
import {
  createSession,
  clearSession,
  readSession as readSessionFromRequest,
} from "@/lib/server/session";
import { createDatabase } from "@/lib/server/db";
import { createDrizzleProfileRepository } from "@/lib/server/profile-repository";

export const runtime = "nodejs";

/**
 * GET /api/auth/stellar
 *
 * Reports whether the current request carries a valid `shire_session` cookie.
 * Used by the wallet provider on mount to distinguish "wallet is connected"
 * (Freighter remembers permission) from "session is authenticated" (a valid
 * server cookie exists). Without this, a refresh restores the wallet address
 * and lets the user navigate into protected pages whose API calls then 401
 * because no cookie was ever (re-)issued.
 */
export async function GET(request: Request) {
  const session = await readSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { authenticated: false, address: null },
      { status: 401 },
    );
  }
  return NextResponse.json({ authenticated: true, address: session.address });
}

type SignInBody = {
  address?: unknown;
  message?: unknown;
  signature?: unknown;
};

/**
 * POST /api/auth/stellar
 * Body: { address, message, signature }
 *
 * Verifies the wallet's signature over a timestamped challenge, resolves (or
 * creates) the app_users row keyed by `stellar:<address>`, then issues a
 * session cookie. All downstream API routes resolve the user from this cookie
 * via `resolveAuthenticatedUser` — no per-route changes needed.
 */
export async function POST(request: Request) {
  let body: SignInBody;
  try {
    body = (await request.json()) as SignInBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address : "";
  const message = typeof body.message === "string" ? body.message : "";
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!address || !message || !signature) {
    return NextResponse.json(
      { error: "address, message, and signature are required." },
      { status: 400 },
    );
  }

  try {
    const valid = verifyStellarChallenge({ address, message, signature });
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } catch (error) {
    const status = error instanceof StellarAuthError ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature verification failed." },
      { status },
    );
  }

  // Resolve/create the user. resolveUser upserts on privyUserId, so the first
  // sign-in creates a row and subsequent sign-ins reuse it.
  const database = createDatabase();
  const profiles = createDrizzleProfileRepository(database);
  try {
    await profiles.resolveUser(`stellar:${address}`, address);
  } catch {
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }

  try {
    await createSession(address);
  } catch {
    // createSession signs the JWT with SESSION_SECRET; if it is unset/invalid
    // (e.g. not configured in production) jose throws here. Surface a clear
    // 500 instead of crashing the route handler with an opaque error.
    return NextResponse.json(
      { error: "Failed to start session." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, address });
}

/**
 * DELETE /api/auth/stellar
 * Clears the session cookie (logout).
 */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
