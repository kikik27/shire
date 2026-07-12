# Stellar Wallet (Sign in with Stellar)

The on-chain identity layer. Users connect a Stellar wallet (Freighter is the
primary target; xBull/Albedo/Lobstr are supported via the kit's modal in
earlier revisions, now we use `@stellar/freighter-api` directly) and that
connection **is** the sign-in.

Privy (`privy.md`) is a secondary email/social path. The two coexist and both
resolve through `resolveAuthenticatedUser`.

## Libraries

- `@stellar/freighter-api` — function-based window API (no class/Preact bundle).
  `requestAccess()` opens the permission popup; `getAddress()`, `signMessage()`,
  `signTransaction()` read/operate once allowed.
- `@stellar/stellar-sdk` — server-side signature verification
  (`Keypair.fromPublicKey(address).verify(message, signature)`) and XDR
  building for the signing demo.
- `jose` — HMAC-signed session cookie (`HS256`).

> Note: an earlier attempt used `@creit.tech/stellar-wallets-kit`. It was
> removed because its ESM-from-Deno class bundle breaks under Next.js /
> Turbopack with `Class constructor StellarWalletsKit cannot be invoked
> without 'new'`. `@stellar/freighter-api` avoids that entirely.

## Key files

- `components/site/stellar-wallet-provider.tsx` — React context. `connect()`
  calls `requestAccess()`, then auto-signs a challenge and POSTs to
  `/api/auth/stellar`, then sets local wallet state.
- `lib/auth/use-stellar-session.ts` — client hook for the sign-in/sign-out
  flow (used where the provider's auto-flow isn't suitable).
- `app/api/auth/stellar/route.ts` — `POST` verifies the signature, upserts
  the user, sets the session cookie; `DELETE` clears it (logout).
- `lib/server/stellar-auth.ts` — `verifyStellarChallenge`: validates the
  timestamped message (5-min expiry, anti-replay) and the ed25519 signature.
- `lib/server/session-token.ts` — pure JWT sign/verify (no `next/headers`, so
  it's import-safe from tests and the resolver).
- `lib/server/session.ts` — cookie helpers (`createSession`/`clearSession`)
  built on `next/headers`.
- `lib/server/authenticated-user.ts` — reads `shire_session` first, falls back
  to Privy Bearer.

## Identity mapping

Stellar users are keyed by a synthetic `privyUserId = "stellar:<G... address>"`.
`app_users.privyUserId` is `NOT NULL UNIQUE`, so this value is stable across
reconnects — the upsert in `profile-repository.ts` reuses the same row and
profile. The `walletAddress` column (also `UNIQUE`) stores the raw `G...`.

No DB migration is needed for the Stellar path.

## Rules

- Never trust a client-side address claim — always verify a signature over a
  server-issued, timestamped challenge before creating a session.
- The session cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- `SESSION_SECRET` must be set in production (HMAC key for the cookie JWT).
- Freighter manages its own permission; "disconnect" clears our cookie and
  local state but cannot revoke Freighter's site permission.
