# Auth Source Priority

When the user logs in, the system should map identity like this:

```txt
Primary identity:
privyUserId, if available

Secondary identity:
walletAddress

Optional:
email
```

Rule:

```txt
If `privyUserId` exists, use it as the primary identity.
If the user later logs in through Privy with the same wallet, merge records by `walletAddress`.
```
