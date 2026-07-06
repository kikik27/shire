"use client";

import { useAuth } from "@/lib/auth/use-auth";

/**
 * Stellar network identifiers used for wallet display.
 *
 * Web2-first note: real Stellar Wallets Kit wiring is deferred to the web3 cycle. Today
 * wallet state is driven by the demo store; these constants only feed display
 * strings (network name, "correct network" flag). Stellar has no numeric chain ID —
 * networks are identified by a passphrase.
 */
const NETWORKS = [
  { passphrase: "Test SDF Network ; September 2015", name: "Stellar Testnet", testnet: true },
  { passphrase: "Public Global Stellar Network ; September 2015", name: "Stellar", testnet: false },
] as const;

const DEFAULT_NETWORK = NETWORKS[0];

function networkName(passphrase: string): string {
  return NETWORKS.find((n) => n.passphrase === passphrase)?.name ?? "Unknown network";
}

/**
 * The app's single wallet interface. Today it is backed by the demo store so every flow
 * is clickable without a deployed contract or funded wallet. To go live, replace the store
 * reads/writes here with Stellar Wallets Kit's connect/sign APIs (`@creit.tech/stellar-wallets-kit`
 * + `@stellar/stellar-sdk`). No call site changes.
 */
export function useWallet() {
  const auth = useAuth();
  const networkPassphrase = DEFAULT_NETWORK.passphrase;

  return {
    address: auth.address,
    isConnected: auth.isConnected,
    connecting: auth.connecting,
    networkPassphrase,
    networkName: networkName(networkPassphrase),
    isCorrectNetwork: networkPassphrase === DEFAULT_NETWORK.passphrase,
    connect: auth.connect,
    disconnect: auth.disconnect,
  };
}
