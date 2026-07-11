# Authentication Flow

The web app has two parallel sign-in paths. The **primary** path is "Sign in
with Stellar" (connect a Stellar wallet); the **secondary** path is Privy
(email/social). Both resolve to the same internal identity keyed on
`privyUserId`.

## Primary: Sign in with Stellar (wallet)

```txt
User opens Shire web
   ↓
Connects a Stellar wallet (Freighter via @stellar/freighter-api)
   ↓
Client signs a timestamped challenge ("Shire sign-in @<iso>")
   ↓
POST /api/auth/stellar { address, message, signature }
   ↓
Server verifies the ed25519 signature (stellar-sdk Keypair.verify)
   ↓
Upsert app_users by privyUserId = "stellar:<address>"
   ↓
Set httpOnly session cookie (jose HS256, 7 days)
   ↓
resolveAuthenticatedUser reads the cookie → returns { mode: "stellar", ... }
   ↓
If onboarding is incomplete → redirect to `/onboarding`
   ↓
If onboarding is complete → redirect to the role dashboard
```

See `stellar-wallet.md` for the wallet/session details.

## Secondary: Privy (email/social)

```txt
User clicks "Continue with email"
   ↓
Privy login (email / Google / passkey)
   ↓
Client gets a Privy access token (JWT), sent as Authorization: Bearer
   ↓
resolveAuthenticatedUser falls back to Privy verification (@privy-io/node)
   ↓
Find or create User by `privyUserId` (+ optional `walletAddress`)
   ↓
Redirect by onboarding state (same as above)
```

## Resolver priority

`resolveAuthenticatedUser` checks, in order:
1. `shire_session` cookie (Stellar wallet sign-in) — wins if present and valid.
2. Privy `Authorization: Bearer` token — used when the Privy path was taken.
3. Demo mode (`privyUserId = "demo-user"`) — only when Privy is unconfigured
   and no wallet session exists, and never in production.

This single chokepoint means every protected API route works for both paths
without per-route changes.
