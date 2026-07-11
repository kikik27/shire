import { NextResponse } from "next/server";

import { verifyStellarChallenge, StellarAuthError } from "@/lib/server/stellar-auth";
import { createSession, clearSession } from "@/lib/server/session";
import { createDatabase } from "@/lib/server/db";
import { createDrizzleProfileRepository } from "@/lib/server/profile-repository";

export const runtime = "nodejs";

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

  await createSession(address);
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
