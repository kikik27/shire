# Authentication Flow

The web app has a single sign-in path: "Sign in with Stellar" (connect a
Stellar wallet). Privy (email/social) was removed because it cannot generate a
Stellar wallet.

## Sign in with Stellar (wallet)

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

## Resolver

`resolveAuthenticatedUser` reads the `shire_session` cookie. If present and
valid, it returns the wallet identity. If absent, it throws
`AuthenticatedUserError` (401). This is the single chokepoint every protected
API route uses.

## Route protection

`middleware.ts` gates `/candidate`, `/recruiter`, `/admin`, `/dashboard` on the
presence of the `shire_session` cookie — redirecting to `/connect` when absent.
The cookie's validity is re-checked server-side in each API route.
