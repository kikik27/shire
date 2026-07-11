# Smart Contract Design

## Contract name

```txt
ShireEscrow
```

## Important principle

```txt
Never let AI trigger onchain settlement directly.
Only backend, user wallet actions, or resolver actions may call the contract.
```

The escrow asset is a stablecoin on Stellar (a Stellar Asset Contract, e.g. USDC), not the
native XLM balance.

## Platform

```txt
Soroban — Stellar's Rust/WASM smart contract platform.
```

## Onchain application storage

```rust
#[contracttype]
pub struct Application {
    pub id: u64,
    pub job_id: u64,
    pub applicant: Address,
    pub company: Address,
    pub applicant_stake: i128,
    pub company_stake: i128,
    pub status: ApplicationStatus,
    pub created_at: u64,
    pub deadline: u64,
    pub dispute_opened: bool,
}

#[contracttype]
pub enum DataKey {
    Application(u64),
}
```

Notes on the Solidity → Soroban type mapping:
- `uint256` amounts → `i128` (Soroban's native token-amount type, matches `TokenClient`).
- `address` → `Address` (Soroban's account/contract address type).
- Timestamps → `u64`, read from `env.ledger().timestamp()` instead of `block.timestamp`.
- `mapping(uint256 => Application)` → persistent storage keyed by `DataKey::Application(id)`.

## Status

```txt
Pending
ApplicantStaked
CompanyStaked
Completed
Expired
Disputed
Resolved
```

## Core functions

```rust
fn create_application(env: Env, applicant: Address, job_id: u64, token: Address, applicant_stake: i128, deadline: u64) -> u64;
fn company_accept_and_stake(env: Env, company: Address, application_id: u64, company_stake: i128);
fn mark_completed(env: Env, application_id: u64);
fn confirm_completed(env: Env, application_id: u64);
fn refund_expired(env: Env, application_id: u64);
fn open_dispute(env: Env, caller: Address, application_id: u64, evidence_uri: String, evidence_hash: BytesN<32>);
fn resolve_dispute(env: Env, resolver: Address, application_id: u64, applicant_payout: i128, company_payout: i128);
```

Access control per entrypoint: each caller (`applicant`, `company`, or `resolver`) must call
`.require_auth()` before the function mutates state — this is the direct Soroban equivalent of
the `msg.sender` checks a Solidity version would use. `resolve_dispute` additionally checks the
authorizing address against a stored resolver address (Soroban has no `onlyResolver` modifier
sugar — this is a manual equality check, not a decorator).

## Token transfer mechanics

There is no separate `approve` step the way ERC20 has. Stake transfers go through a
`TokenClient` against the stablecoin's Stellar Asset Contract (SAC):

```rust
let token_client = token::Client::new(&env, &token);

// Moving funds into escrow (create_application, company_accept_and_stake):
token_client.transfer(&staker, &env.current_contract_address(), &amount);

// Moving funds out of escrow (confirm_completed, refund_expired, resolve_dispute):
token_client.transfer(&env.current_contract_address(), &recipient, &amount);
```

Moving funds *out* requires the contract to authorize itself as the sender of the sub-call to
the token contract (`env.authorize_as_current_contract(...)` with an `InvokerContractAuthEntry`)
— a Soroban-specific detail with no direct Solidity analog, since Solidity contracts can move
their own balance implicitly.

## Events

Published via `env.events().publish((topics...), data)` instead of Solidity's `emit`:

```txt
ApplicationCreated(application_id, job_id, applicant, company, applicant_stake)
CompanyStaked(application_id, company, company_stake)
ApplicationCompleted(application_id)
StakeReleased(application_id, applicant_payout, company_payout)
ApplicationExpired(application_id)
DisputeOpened(application_id, opened_by, evidence_uri, evidence_hash)
DisputeResolved(application_id, applicant_payout, company_payout)
```

Sync implication: reading these back is a ledger-range `getEvents` RPC poll
(`@stellar/stellar-sdk`'s `SorobanRpc.Server`), not an EVM `eth_getLogs`-style
block-range listener. See `sync.md`.
