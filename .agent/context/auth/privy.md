# Privy Notes (REMOVED)

> **Deprecated (2026-07):** Privy was removed from the auth flow. Privy cannot
> generate a Stellar wallet (it only supports EVM/Solana), so it could not serve
> as the on-chain identity layer. Auth is now "Sign in with Stellar" only — see
> `flow.md` and `stellar-wallet.md`. This file is kept for history.

The notes below describe the old behavior and no longer apply.

## Old rules (deprecated)
- Use Privy for the web app login and session flow.
- The backend should read the Privy session, not trust client-side claims.
- `privyUserId` is the preferred web identity when available.

> Note: the DB column `app_users.privyUserId` is **kept** (not renamed) — it now
> stores `stellar:<address>` strings. Renaming it would require a migration for
> no functional benefit.
