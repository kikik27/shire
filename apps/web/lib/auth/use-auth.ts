"use client";

/**
 * Auth state hook.
 *
 * Auth is now "Sign in with Stellar" only (see lib/server/session.ts and the
 * StellarWalletProvider). There is no email/social identity layer anymore.
 * This hook returns a disconnected stub: callers that still destructure it
 * (e.g. the connect page's fallback) simply never report an identity
 * connection, because the wallet layer (useStellarWallet) is the real signal.
 */
export type AuthState = {
  address: string | null;
  isConnected: boolean;
  connecting: boolean;
  connect: () => void | Promise<void>;
  disconnect: () => void;
};

export function useAuth(): AuthState {
  return {
    address: null,
    isConnected: false,
    connecting: false,
    connect: () => undefined,
    disconnect: () => undefined,
  };
}
