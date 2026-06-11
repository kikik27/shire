import type { Address } from "viem";
import { shireRegistryAbi, shireStakeVaultAbi } from "@/lib/contracts/abis";

/**
 * Deployed addresses come from env (set after the Alfajores deploy). Empty by default —
 * the app runs in demo mode until these are populated.
 */
export const contractAddresses = {
  registry: (process.env.NEXT_PUBLIC_SHIRE_REGISTRY_ADDRESS ?? "") as Address | "",
  stakeVault: (process.env.NEXT_PUBLIC_SHIRE_STAKE_VAULT_ADDRESS ?? "") as Address | "",
  cUSD: (process.env.NEXT_PUBLIC_CUSD_ADDRESS ??
    "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1") as Address, // Alfajores cUSD
} as const;

export const shireContracts = {
  registry: { address: contractAddresses.registry, abi: shireRegistryAbi },
  stakeVault: { address: contractAddresses.stakeVault, abi: shireStakeVaultAbi },
} as const;

/** Whether real contracts are wired (vs. demo store). */
export const contractsReady = Boolean(
  contractAddresses.registry && contractAddresses.stakeVault,
);

export { shireRegistryAbi, shireStakeVaultAbi };
