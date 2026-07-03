"use client";

import { usePrivy } from "@privy-io/react-auth";

/** True when a Privy app id is configured. Read once at module load, stable per build. */
export const PRIVY_ENABLED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export type AuthState = {
  address: string | null;
  isConnected: boolean;
  connecting: boolean;
  connect: () => void | Promise<void>;
  disconnect: () => void;
};

function useUnavailableAuth(): AuthState {
  return {
    address: null,
    isConnected: false,
    connecting: false,
    connect: () => undefined,
    disconnect: () => undefined,
  };
}

function usePrivyAuth(): AuthState {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const address = user?.wallet?.address ?? null;

  return {
    address: authenticated ? address : null,
    isConnected: authenticated && Boolean(address),
    connecting: !ready,
    connect: () => login(),
    disconnect: () => logout(),
  };
}

/**
 * Single auth entry point for the app. `PRIVY_ENABLED` is a build-time constant, so the
 * branch never changes between renders and the conditional hook is safe.
 */
export function useAuth(): AuthState {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- PRIVY_ENABLED is constant per build.
  return PRIVY_ENABLED ? usePrivyAuth() : useUnavailableAuth();
}
