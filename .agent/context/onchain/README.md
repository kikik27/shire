# Onchain Context

This folder contains smart contract, staking, sync, and onchain security rules for the
Soroban (Stellar) escrow contract.

## Read in this order
1. `contract-design.md`
2. `staking-flow.md`
3. `sync.md`
4. `security.md`
5. `api.md`

## Rules
- Keep contract behavior explicit and deterministic.
- Treat onchain state as the source of truth for escrow and settlement.
- Keep onchain security constraints visible and easy to scan.
