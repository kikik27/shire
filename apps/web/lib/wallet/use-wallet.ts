"use client";

import { useStellarWallet } from "@/components/site/stellar-wallet-provider";

/**
 * The app's single on-chain wallet interface.
 *
 * Backed by @creit.tech/stellar-wallets-kit (Freighter + others) via the
 * StellarWalletProvider. Exposes connect/disconnect plus message and
 * transaction signing. Privy still handles email/social identity separately
 * (see lib/auth/use-auth.ts); this hook is the Stellar wallet layer.
 */
export function useWallet() {
  const stellar = useStellarWallet();

  return {
    address: stellar.address,
    isConnected: stellar.isConnected,
    connecting: stellar.connecting || !stellar.ready,
    networkPassphrase: stellar.networkPassphrase,
    networkName: stellar.networkName,
    isCorrectNetwork: stellar.networkPassphrase === "Test SDF Network ; September 2015",
    connect: stellar.connect,
    disconnect: stellar.disconnect,
    /** Sign an arbitrary string and return the wallet's signature. */
    signMessage: stellar.signMessage,
    /** Sign a base64 Transaction XDR and return the signed XDR. */
    signTransaction: stellar.signTransaction,
  };
}
