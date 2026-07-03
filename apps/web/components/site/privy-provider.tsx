"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { celo, celoAlfajores } from "viem/chains";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

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
      {children}
    </PrivyProvider>
  );
}
