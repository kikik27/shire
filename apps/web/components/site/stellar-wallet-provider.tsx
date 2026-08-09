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

/**
 * Freighter's `signMessage` returns different shapes across extension
 * versions: newer ones return an already-encoded string, older ones return a
 * Buffer-like object. `String(buffer)` (or JSON.stringify-ing it directly)
 * mangles the raw signature bytes instead of encoding them, which makes the
 * server-side verification fail silently. Encode explicitly instead.
 */
function encodeSignature(signedMessage: unknown): string {
  if (typeof signedMessage === "string") return signedMessage;
  if (
    signedMessage &&
    typeof (signedMessage as { toString?: unknown }).toString === "function"
  ) {
    return (signedMessage as { toString: (encoding: string) => string }).toString("base64");
  }
  throw new Error("Unrecognized signature format returned by wallet.");
}

export type StellarWalletState = {
  /** Connected public key (G...) or null. */
  address: string | null;
  isConnected: boolean;
  connecting: boolean;
  /**
   * Whether the server session cookie is valid for this address. Distinct from
   * isConnected: Freighter remembers site permission across refreshes, so a
   * wallet can be "connected" while the session has expired/never existed.
   * Navigation into protected pages must wait on `authenticated`, not
   * `isConnected`, or their API calls 401.
   */
  authenticated: boolean;
  /** Whether the provider finished its mount-time restore + session check. */
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
  const [authenticated, setAuthenticated] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  /**
   * Ask the server whether the current `shire_session` cookie is valid. Freighter
   * persists site permission across refreshes, so a wallet can be "connected"
   * (address known) without a valid session. We must NOT treat a restored
   * address as authenticated — that would let the user walk into protected pages
   * whose API calls 401.
   */
  const checkSession = React.useCallback(async (addr: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/stellar", { method: "GET" });
      if (!res.ok) return false;
      const body = (await res.json().catch(() => ({}))) as {
        authenticated?: unknown;
        address?: unknown;
      };
      return body.authenticated === true && body.address === addr;
    } catch {
      return false;
    }
  }, []);

  // On mount, restore the wallet address if Freighter still permits this site,
  // then validate the server session. Only authenticated if BOTH hold.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      let restoredAddress: string | null = null;
      try {
        const [conn, allowed] = await Promise.all([
          freighterIsConnected(),
          isAllowed(),
        ]);
        if (cancelled) return;

        if (conn.isConnected && allowed.isAllowed) {
          const { address: addr, error } = await getAddress();
          if (!cancelled && !error && addr) {
            restoredAddress = addr;
            window.localStorage.setItem(STORAGE_KEY, addr);
          }
        } else {
          // Fall back to a cached address (will be re-validated below).
          const cached = window.localStorage.getItem(STORAGE_KEY);
          if (cached) restoredAddress = cached;
        }
      } catch {
        // Freighter not installed / unavailable — stay disconnected.
      }

      if (cancelled) return;

      if (restoredAddress) {
        setAddress(restoredAddress);
        // A connected wallet is NOT enough — confirm the session cookie is
        // still valid. If it expired/never existed, the user must sign in again.
        const ok = await checkSession(restoredAddress);
        if (!cancelled) setAuthenticated(ok);
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [checkSession]);

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

      // Sign a timestamped challenge and POST it to the server, which
      // verifies the signature and sets a session cookie. This IS the login
      // step, so the wallet is only considered "connected" once it succeeds
      // — otherwise callers would redirect into pages that require auth
      // without a valid session, surfacing as a later, confusing 401.
      const message = `Shire sign-in @${new Date().toISOString()}`;
      const { signedMessage, error: signError } = await freighterSignMessage(message, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: addr,
      });
      if (signError) {
        throw new Error(signError.message || "Freighter rejected the sign-in request.");
      }
      if (!signedMessage) throw new Error("No signature returned by Freighter.");

      const res = await fetch("/api/auth/stellar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: addr,
          message,
          signature: encodeSignature(signedMessage),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Sign-in failed (${res.status}).`);
      }

      setAddress(addr);
      setAuthenticated(true);
      window.localStorage.setItem(STORAGE_KEY, addr);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = React.useCallback(async () => {
    // Clear the server session (logout) and the cached address.
    setAddress(null);
    setAuthenticated(false);
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
      return { signedMessage: encodeSignature(signedMessage), signerAddress };
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
      authenticated,
      connecting,
      ready,
      networkPassphrase: NETWORK_PASSPHRASE,
      networkName: NETWORK_NAME,
      connect,
      disconnect,
      signMessage,
      signTransaction,
    }),
    [
      address,
      authenticated,
      connecting,
      ready,
      connect,
      disconnect,
      signMessage,
      signTransaction,
    ],
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
