"use client";

import { useShireStore } from "@/lib/store";
import { DEFAULT_CHAIN, chainName } from "@/lib/wallet/config";

/**
 * The app's single wallet interface. Today it is backed by the demo store so every flow
 * is clickable without a deployed contract or funded wallet. To go live, replace the store
 * reads/writes here with wagmi's `useAccount` / `useConnect` / `useSwitchChain` against
 * `wagmiConfig` — no call site changes.
 */
export function useWallet() {
  const address = useShireStore((s) => s.address);
  const chainId = useShireStore((s) => s.chainId);
  const connecting = useShireStore((s) => s.connecting);
  const connect = useShireStore((s) => s.connect);
  const disconnect = useShireStore((s) => s.disconnect);

  return {
    address,
    isConnected: Boolean(address),
    connecting,
    chainId,
    chainName: chainName(chainId),
    isCorrectNetwork: chainId === DEFAULT_CHAIN.id,
    connect,
    disconnect,
  };
}
