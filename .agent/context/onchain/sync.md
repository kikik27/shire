# Onchain Sync

## Event sync job

It can live in:

```txt
apps/agent/src/jobs/run-onchain-sync.ts
```

Or for MVP:

```txt
apps/web/app/api/onchain/sync/route.ts
```

## Sync mechanism

Poll Soroban RPC's `getEvents` by ledger range (via `@stellar/stellar-sdk`'s
`SorobanRpc.Server`), analogous to how an EVM sync job would poll `eth_getLogs` by block range.
Track a `lastSyncedLedger` cursor (the Soroban equivalent of "last synced block").

## Sync rules

```txt
ApplicationCreated:
- Create or update Application
- Set status APPLICANT_STAKED
- Save applicantStakeTx

CompanyStaked:
- Set status COMPANY_STAKED
- Save companyStakeTx

ApplicationCompleted:
- Set status COMPLETED

ApplicationExpired:
- Set status EXPIRED

DisputeOpened:
- Set status DISPUTED

DisputeResolved:
- Set status RESOLVED
```

## Duplicate protection

Use this table:

```txt
OnchainEvent
```

With this unique key:

```txt
txHash + eventName
```
