"use client";

import { useStellarWallet } from "@/components/site/stellar-wallet-provider";

/**
 * The app's single wallet interface — and its only identity layer.
 *
 * Backed by @stellar/freighter-api via the StellarWalletProvider. Connecting a
 * wallet also signs in (challenge → session cookie). Exposes connect/disconnect
 * plus message and transaction signing.
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
