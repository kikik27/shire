import { createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Real wagmi/viem config for Celo + Alfajores.
 *
 * The MiniPay Mini App injects an EIP-1193 provider on `window.ethereum`, so the
 * `injected()` connector covers both MiniPay and browser wallets. This config is the
 * integration target: today the app drives wallet state through the demo store
 * (`useWallet`), and the swap is to point those calls at wagmi's hooks + this config.
 */
export const wagmiConfig = createConfig({
  chains: [celoAlfajores, celo],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [celoAlfajores.id]: http("https://alfajores-forno.celo-testnet.org"),
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: true,
});

export const DEFAULT_CHAIN = celoAlfajores;

export const SUPPORTED_CHAINS = [
  { id: celoAlfajores.id, name: "Celo Alfajores", testnet: true },
  { id: celo.id, name: "Celo", testnet: false },
] as const;

export function chainName(id: number): string {
  return SUPPORTED_CHAINS.find((c) => c.id === id)?.name ?? `Chain ${id}`;
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
