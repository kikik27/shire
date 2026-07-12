# Auth Context

This folder contains authentication, identity, and onboarding rules.

## Read in this order
1. `flow.md`
2. `stellar-wallet.md`
3. `source-priority.md`
4. `mode-and-onboarding.md`
5. `privy.md`
6. `api.md`

## Rules
- Keep wallet identity rules explicit.
- "Sign in with Stellar" is the primary path; Privy (email/social) is secondary.
- Verify a signature over a server-issued challenge before trusting an address.
- Preserve multi-mode behavior.
- Do not collapse the user into a permanent single role.
