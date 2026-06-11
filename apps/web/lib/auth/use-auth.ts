"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useShireStore } from "@/lib/store";

/** True when a Privy app id is configured. Read once at module load — stable per build. */
export const PRIVY_ENABLED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export type AuthState = {
  address: string | null;
  isConnected: boolean;
  connecting: boolean;
  connect: () => void | Promise<void>;
  disconnect: () => void;
};

/** Demo fallback: drives identity from the client-side store. */
function useDemoAuth(): AuthState {
  const address = useShireStore((s) => s.address);
  const connecting = useShireStore((s) => s.connecting);
  const connect = useShireStore((s) => s.connect);
  const disconnect = useShireStore((s) => s.disconnect);
  return { address, isConnected: Boolean(address), connecting, connect, disconnect };
}

/** Real auth via Privy (email / social / passkey / wallet + embedded wallets). */
function usePrivyAuth(): AuthState {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const storeDisconnect = useShireStore((s) => s.disconnect);
  const address = user?.wallet?.address ?? null;

  return {
    address: authenticated ? address : null,
    isConnected: authenticated && Boolean(address),
    connecting: !ready,
    connect: () => login(),
    disconnect: () => {
      logout();
      storeDisconnect();
    },
  };
}

/**
 * Single auth entry point for the app. `PRIVY_ENABLED` is a build-time constant, so the
 * branch never changes between renders and the conditional hook is safe.
 */
export function useAuth(): AuthState {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- PRIVY_ENABLED is constant per build.
  return PRIVY_ENABLED ? usePrivyAuth() : useDemoAuth();
}
