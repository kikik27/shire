"use client";

import { type ReactNode, useEffect } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { celo, celoAlfajores } from "viem/chains";
import { useShireStore } from "@/lib/store";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Mirrors Privy auth state into the demo store so every existing selector and flow
 * (`useWallet`, registry, stakes) keeps working unchanged — Privy just becomes the
 * real source of the connected address.
 */
function PrivySync() {
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address ?? null;

  useEffect(() => {
    if (!ready) return;
    useShireStore.setState({ address: authenticated ? address : null });
  }, [ready, authenticated, address]);

  return null;
}

/**
 * Env-guarded Privy provider. With `NEXT_PUBLIC_PRIVY_APP_ID` set, users sign in with
 * email / Google / passkey / wallet and Privy creates an embedded wallet for anyone who
 * doesn't have one — no seed phrases, no web3 knowledge required. Without the key, the app
 * falls back to the client-side demo store so it still builds and runs.
 */
export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#3b5bfd",
          walletChainType: "ethereum-only",
        },
        // Email/social first so non-crypto users never see a wallet prompt.
        loginMethods: ["email", "google", "passkey", "wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: celoAlfajores,
        supportedChains: [celoAlfajores, celo],
      }}
    >
      <PrivySync />
      {children}
    </PrivyProvider>
  );
}
