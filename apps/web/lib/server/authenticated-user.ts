import { readSessionFromRequest } from "./session-token";

/**
 * Identity resolution for protected routes.
 *
 * Auth is a single path now: the "Sign in with Stellar" cookie session. A user
 * connects a Freighter wallet, signs a timestamped challenge, the server
 * verifies the ed25519 signature, and issues an `shire_session` cookie. This
 * resolver reads that cookie and returns the resolved identity. No cookie, no
 * identity — callers throw/handle the 401.
 *
 * (The previous Privy JWT Bearer path was removed: Privy cannot generate a
 * Stellar wallet, so it could not serve as the on-chain identity layer.)
 */

export class AuthenticatedUserError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthenticatedUserError";
  }
}

/**
 * Kept for backwards compatibility with routes/tests that branch on it. With
 * the Privy path removed, resolver configuration can no longer be "partial" —
 * it is never thrown, but the class is retained so existing catch blocks and
 * tests stay valid without a wide rewrite.
 */
export class AuthenticatedUserConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticatedUserConfigurationError";
  }
}

export type AuthenticatedUser = {
  mode: "stellar";
  /** Stable user key. For Stellar sign-in this is `stellar:<address>`. */
  privyUserId: string;
  /** The connected Stellar public key (G...). */
  walletAddress: string;
};

export async function resolveAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser> {
  const session = await readSessionFromRequest(request);
  if (session) {
    return {
      mode: "stellar",
      privyUserId: session.privyUserId,
      walletAddress: session.address,
    };
  }
  throw new AuthenticatedUserError("Authentication is required.");
}
