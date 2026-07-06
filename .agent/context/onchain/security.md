# Onchain Security

```txt
- Validate `Address.require_auth()` on every state-changing entrypoint, and confirm the
  authorizing address matches the expected role for that application (applicant/company/resolver).
- Validate each status transition.
- Validate that the payout does not exceed the escrowed amount.
- Only the resolver may settle disputes (explicit stored-address equality check, not a modifier).
- Follow checks-effects-interactions when calling the token contract (update status before
  calling `TokenClient::transfer`) as defensive practice. Soroban's execution model has no
  fallback/receive functions and no implicit external calls mid-function, so classic
  reentrancy is far less of a risk than in Solidity — this is good practice, not a mandatory
  guard the way `ReentrancyGuard` was.
```
