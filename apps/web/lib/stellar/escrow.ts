"use client";

/**
 * Client-side bindings for the ShireEscrow Soroban contract.
 *
 * Uses `@stellar/stellar-sdk`'s `contract.Client`, which fetches the
 * contract's spec from chain and generates one method per Rust entrypoint
 * (`create_application`, `get_application`, ...). Each write call returns an
 * `AssembledTransaction` that this module signs via the connected wallet's
 * `signTransaction` (matches Freighter's signature, see
 * `components/site/stellar-wallet-provider.tsx`) and submits, polling until
 * the network confirms it.
 *
 * `@stellar/stellar-sdk` is dynamically imported so it stays out of the main
 * bundle — same pattern as the demo payment builder in
 * `components/wallet/wallet-menu-dialog.tsx`.
 */

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const CONTRACT_ID = process.env.NEXT_PUBLIC_SHIRE_ESCROW_CONTRACT_ID;

type SignTransactionFn = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

/**
 * `contract.Client` attaches one method per Rust entrypoint to each instance
 * at runtime (`this[method] = ...` inside its constructor) — the exported
 * `Client` class declares none of them statically, so TypeScript can't check
 * `client.create_application(...)` against the real contract shape. This is
 * a hand-written contract for exactly the calls this module makes; the
 * `Client.from(...)` result is cast to it once, right after construction.
 */
type RustResult<T> = {
  isOk(): boolean;
  isErr(): boolean;
  unwrap(): T;
  unwrapErr(): { message: string };
};

type SentTx<T> = {
  result: RustResult<T>;
  sendTransactionResponse?: { hash: string };
  getTransactionResponse?: { txHash: string };
};

type AssembledTx<T> = {
  signAndSend(opts: { signTransaction: SignTransactionFn }): Promise<SentTx<T>>;
};

type EscrowClient = {
  create_application(
    args: {
      applicant: string;
      job_id: bigint;
      token: string;
      applicant_stake: bigint;
      deadline: bigint;
    },
    opts?: { publicKey?: string },
  ): Promise<AssembledTx<bigint>>;
  get_application(
    args: { application_id: bigint },
    opts?: { publicKey?: string },
  ): Promise<{ result: RustResult<Record<string, unknown>> }>;
};

async function loadSdk() {
  return import("@stellar/stellar-sdk");
}

/**
 * The contract's `job_id` is an opaque u64 with no server-side registry — it
 * only needs to be a stable, collision-resistant mapping from our Postgres
 * `uuid` job id. FNV-1a 64-bit gives that deterministically without a schema
 * migration on `jobs`.
 */
export function jobIdToU64(jobId: string): bigint {
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = (1n << 64n) - 1n;
  let hash = FNV_OFFSET;
  for (let i = 0; i < jobId.length; i++) {
    hash ^= BigInt(jobId.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/** Convert a decimal XLM amount (e.g. 250) to stroops (i128) for the contract. */
export function xlmToStroops(amount: number): bigint {
  return BigInt(Math.round(amount * 10_000_000));
}

export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

let nativeContractIdPromise: Promise<string> | null = null;

/** The native XLM Stellar Asset Contract id on the configured network. */
async function nativeTokenContractId(): Promise<string> {
  if (!nativeContractIdPromise) {
    nativeContractIdPromise = loadSdk().then(({ Asset }) =>
      Asset.native().contractId(NETWORK_PASSPHRASE),
    );
  }
  return nativeContractIdPromise;
}

let clientPromise: Promise<EscrowClient> | null = null;

/** Cached ShireEscrow contract client (fetches the onchain spec once). */
async function getEscrowClient(): Promise<EscrowClient> {
  if (!CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_SHIRE_ESCROW_CONTRACT_ID is not configured.");
  }
  if (!clientPromise) {
    clientPromise = loadSdk().then(async ({ contract }) => {
      const client = await contract.Client.from({
        contractId: CONTRACT_ID,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      return client as unknown as EscrowClient;
    });
  }
  return clientPromise;
}

export class EscrowError extends Error {}

export type CreateApplicationResult = {
  hash: string;
  onchainApplicationId: bigint;
};

/**
 * Candidate creates the application onchain and stakes `applicantStake`
 * (stroops) of native XLM into escrow. Requires the wallet's signTransaction
 * (Freighter will prompt the user to approve).
 */
export async function createApplicationOnchain(params: {
  applicantAddress: string;
  jobId: string;
  applicantStakeStroops: bigint;
  deadlineUnixSeconds: bigint;
  signTransaction: SignTransactionFn;
}): Promise<CreateApplicationResult> {
  const client = await getEscrowClient();
  const token = await nativeTokenContractId();

  const tx = await client.create_application(
    {
      applicant: params.applicantAddress,
      job_id: jobIdToU64(params.jobId),
      token,
      applicant_stake: params.applicantStakeStroops,
      deadline: params.deadlineUnixSeconds,
    },
    { publicKey: params.applicantAddress },
  );

  const sent = await tx.signAndSend({
    signTransaction: params.signTransaction,
  });

  if (sent.result.isErr()) {
    throw new EscrowError(sent.result.unwrapErr().message || "create_application failed onchain.");
  }

  return {
    hash: sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash ?? "",
    onchainApplicationId: sent.result.unwrap(),
  };
}

export type OnchainApplicationStatus =
  | "Pending"
  | "ApplicantStaked"
  | "CompanyStaked"
  | "Completed"
  | "Expired"
  | "Disputed"
  | "Resolved"
  | "Unknown";

export type OnchainApplication = {
  id: bigint;
  jobId: bigint;
  applicant: string;
  company: string | null;
  token: string;
  applicantStake: bigint;
  companyStake: bigint;
  status: OnchainApplicationStatus;
  deadline: bigint;
  disputeOpened: boolean;
  companyMarkedCompleted: boolean;
};

function parseStatus(raw: unknown): OnchainApplicationStatus {
  const KNOWN: OnchainApplicationStatus[] = [
    "Pending",
    "ApplicantStaked",
    "CompanyStaked",
    "Completed",
    "Expired",
    "Disputed",
    "Resolved",
  ];
  const tag =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "tag" in raw
        ? String((raw as { tag: unknown }).tag)
        : undefined;
  return (KNOWN.find((status) => status === tag) ?? "Unknown") as OnchainApplicationStatus;
}

/**
 * Read-only status lookup — no wallet required (simulates with Soroban's
 * well-known "impossible account" as the invoker, per the SDK's `NULL_ACCOUNT`).
 */
export async function getApplicationOnchain(
  onchainApplicationId: bigint,
): Promise<OnchainApplication | null> {
  const client = await getEscrowClient();
  const { contract } = await loadSdk();
  try {
    const tx = await client.get_application(
      { application_id: onchainApplicationId },
      { publicKey: contract.NULL_ACCOUNT },
    );
    if (tx.result.isErr()) return null;
    const app = tx.result.unwrap() as Record<string, unknown>;
    return {
      id: app.id as bigint,
      jobId: app.job_id as bigint,
      applicant: app.applicant as string,
      company: (app.company as string | null | undefined) ?? null,
      token: app.token as string,
      applicantStake: app.applicant_stake as bigint,
      companyStake: app.company_stake as bigint,
      status: parseStatus(app.status),
      deadline: app.deadline as bigint,
      disputeOpened: Boolean(app.dispute_opened),
      companyMarkedCompleted: Boolean(app.company_marked_completed),
    };
  } catch {
    return null;
  }
}

export function stellarExpertTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function stellarExpertContractUrl(): string {
  return `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID ?? ""}`;
}
