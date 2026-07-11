/**
 * Stellar testnet faucet (Friendbot) helpers.
 *
 * Friendbot funds Stellar Testnet accounts with test XLM via a single GET:
 *   https://horizon-testnet.stellar.org/friendbot?addr=<publicKey>
 * No authentication is required. Already-funded accounts return an error
 * payload rather than duplicate funds — we treat that as "already funded".
 */

const FRIENDBOT_URL =
  process.env.NEXT_PUBLIC_STELLAR_FRIENDBOT_URL ??
  "https://horizon-testnet.stellar.org/friendbot";
const HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export type FaucetResult = {
  /** Transaction hash of the create-account/payment, when returned by Friendbot. */
  hash?: string;
  /** Native XLM balance for the account after funding, when available. */
  balance?: string;
  /** True when the account was already funded (Friendbot refused). */
  alreadyFunded: boolean;
};

/** Fund a Stellar Testnet account with test XLM via Friendbot. */
export async function claimTestnetXlm(address: string): Promise<FaucetResult> {
  if (!address) throw new Error("A Stellar address is required.");

  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);

  // Friendbot returns 200 + the funding transaction on success. Some already-
  // funded responses still come back as 400 with a body describing the state.
  if (!res.ok) {
    let detail = `Friendbot returned ${res.status}`;
    try {
      const body = await res.json();
      const message = (body as { detail?: unknown }).detail;
      if (typeof message === "string") {
        detail = message.includes("already") ? "Account already funded." : message;
      }
    } catch {
      /* keep default detail */
    }
    // A 400 mentioning the account existing is not a hard failure for the user.
    if (res.status === 400 && detail.toLowerCase().includes("already")) {
      const balance = await fetchXlmBalance(address).catch(() => undefined);
      return { alreadyFunded: true, balance };
    }
    throw new Error(detail);
  }

  // Best-effort: read the tx hash and the updated balance. Failure here is fine
  // — the funding itself succeeded once we reach this branch.
  let hash: string | undefined;
  try {
    const body = await res.json();
    hash = (body as { hash?: string }).hash;
  } catch {
    /* shape varies; ignore */
  }

  const balance = await fetchXlmBalance(address).catch(() => undefined);
  return { hash, balance, alreadyFunded: false };
}

/** Fetch the native XLM balance for an account from Horizon, if it exists. */
export async function fetchXlmBalance(address: string): Promise<string | undefined> {
  const res = await fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
  if (!res.ok) return undefined;
  const body = (await res.json()) as { balances?: Array<{ asset_type: string; balance: string }> };
  const native = body.balances?.find((b) => b.asset_type === "native");
  return native?.balance;
}
