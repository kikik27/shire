"use client";

import * as React from "react";
import {
  isConnected as freighterIsConnected,
  isAllowed,
  getAddress,
  requestAccess,
  signMessage as freighterSignMessage,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";

/**
 * Stellar wallet integration via @stellar/freighter-api.
 *
 * Freighter exposes a simple function-based API on `window` — no classes, no
 * modal/Preact bundle — so it works cleanly under Next/Turbopack with no
 * transpilation hacks. `requestAccess()` opens Freighter's permission popup;
 * `getAddress()` reads the authorized address; signMessage/signTransaction do
 * the signing.
 *
 * This provider IS the app's identity layer: connecting a wallet signs in
 * (challenge → server-verified session cookie). There is no separate
 * email/social login.
 */

const STORAGE_KEY = "shire.stellar.address";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const NETWORK_NAME = "Stellar Testnet";

export type StellarWalletState = {
  /** Connected public key (G...) or null. */
  address: string | null;
  isConnected: boolean;
  connecting: boolean;
  /** Whether the kit finished initializing on the client. */
  ready: boolean;
  networkPassphrase: string;
  networkName: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<{ signedMessage: string }>;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
};

const StellarWalletContext = React.createContext<StellarWalletState | null>(null);

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = React.useState<string | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // On mount, check whether Freighter already authorised this site and restore
  // the address. Freighter persists permission, so a refresh keeps the wallet.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [conn, allowed] = await Promise.all([
          freighterIsConnected(),
          isAllowed(),
        ]);
        if (cancelled) return;

        if (conn.isConnected && allowed.isAllowed) {
          const { address: addr, error } = await getAddress();
          if (!cancelled && !error && addr) {
            setAddress(addr);
            window.localStorage.setItem(STORAGE_KEY, addr);
          }
        } else {
          // Fall back to a cached address (will be re-validated on connect).
          const cached = window.localStorage.getItem(STORAGE_KEY);
          if (!cancelled && cached) setAddress(cached);
        }
      } catch {
        // Freighter not installed / unavailable — stay disconnected.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = React.useCallback(async () => {
    setConnecting(true);
    try {
      // requestAccess opens Freighter's permission popup and returns the
      // authorised public key once the user approves.
      const { address: addr, error } = await requestAccess();
      if (error) {
        throw new Error(error.message || "Freighter denied access.");
      }
      if (!addr) throw new Error("No address returned by Freighter.");
      setAddress(addr);
      window.localStorage.setItem(STORAGE_KEY, addr);

      // Auto sign-in: sign a timestamped challenge and POST it to the server,
      // which verifies the signature and sets a session cookie. This makes
      // "connect wallet" also the login step. Failure here doesn't block the
      // wallet connection itself — the user can retry via the menu.
      try {
        const message = `Shire sign-in @${new Date().toISOString()}`;
        const { signedMessage } = await freighterSignMessage(message, {
          networkPassphrase: NETWORK_PASSPHRASE,
          address: addr,
        });
        await fetch("/api/auth/stellar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: addr, message, signature: signedMessage }),
        });
      } catch {
        // Sign-in challenge rejected by the user or failed — the wallet stays
        // connected; signing in can be retried from the wallet menu.
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = React.useCallback(async () => {
    // Clear the server session (logout) and the cached address.
    setAddress(null);
    window.localStorage.removeItem(STORAGE_KEY);
    try {
      await fetch("/api/auth/stellar", { method: "DELETE" });
    } catch {
      /* best effort */
    }
  }, []);

  const signMessage = React.useCallback(
    async (message: string) => {
      const current = address;
      if (!current) throw new Error("Connect your Stellar wallet before signing.");
      const { signedMessage, signerAddress, error } = await freighterSignMessage(message, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: current,
      });
      if (error) throw new Error(error.message || "Freighter rejected the message.");
      if (!signedMessage) throw new Error("No signature returned by Freighter.");
      return { signedMessage: String(signedMessage), signerAddress };
    },
    [address],
  );

  const signTransaction = React.useCallback(
    async (xdr: string) => {
      const current = address;
      if (!current) throw new Error("Connect your Stellar wallet before signing.");
      const { signedTxXdr, signerAddress, error } = await freighterSignTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: current,
      });
      if (error) throw new Error(error.message || "Freighter rejected the transaction.");
      if (!signedTxXdr) throw new Error("No signed transaction returned by Freighter.");
      return { signedTxXdr, signerAddress };
    },
    [address],
  );

  const value = React.useMemo<StellarWalletState>(
    () => ({
      address,
      isConnected: Boolean(address),
      connecting,
      ready,
      networkPassphrase: NETWORK_PASSPHRASE,
      networkName: NETWORK_NAME,
      connect,
      disconnect,
      signMessage,
      signTransaction,
    }),
    [address, connecting, ready, connect, disconnect, signMessage, signTransaction],
  );

  return (
    <StellarWalletContext.Provider value={value}>{children}</StellarWalletContext.Provider>
  );
}

/** Access the Stellar wallet layer. Must be used inside <StellarWalletProvider>. */
export function useStellarWallet(): StellarWalletState {
  const ctx = React.useContext(StellarWalletContext);
  if (!ctx) throw new Error("useStellarWallet must be used within <StellarWalletProvider>.");
  return ctx;
}
