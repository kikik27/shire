"use client";

import { useShireStore } from "@/lib/store";

/**
 * Celo chain identifiers used for wallet display.
 *
 * Web2-first note: real wagmi/viem wiring is deferred to the web3 cycle. Today
 * wallet state is driven by the demo store; these constants only feed display
 * strings (chain name, "correct network" flag).
 */
const CHAINS = [
  { id: 44787, name: "Celo Alfajores", testnet: true },
  { id: 42220, name: "Celo", testnet: false },
] as const;

const DEFAULT_CHAIN = CHAINS[0];

function chainName(id: number): string {
  return CHAINS.find((c) => c.id === id)?.name ?? `Chain ${id}`;
}

/**
 * The app's single wallet interface. Today it is backed by the demo store so every flow
 * is clickable without a deployed contract or funded wallet. To go live, replace the store
 * reads/writes here with wagmi's `useAccount` / `useConnect` / `useSwitchChain` — no call
 * site changes.
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
