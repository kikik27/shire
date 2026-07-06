"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Privy handles email/social login and identity only. Stellar/Soroban wallet
 * connection and staking transactions are handled separately by an external
 * Stellar wallet connector (Stellar Wallets Kit — Freighter, xBull, Albedo,
 * Lobstr) once the escrow contract is deployed. See
 * `apps/web/lib/wallet/use-wallet.ts` and `.agent/context/onchain/`.
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
        },
        // Email/social first so non-crypto users never see a wallet prompt.
        loginMethods: ["email", "google", "passkey"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
