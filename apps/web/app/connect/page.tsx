"use client";

import * as React from "react";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useStellarWallet } from "@/components/site/stellar-wallet-provider";
import { useLoginDestination } from "@/lib/auth/use-login-destination";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";

/**
 * Sign-in page. The only login method is "Connect Stellar Wallet" — connecting
 * a Freighter wallet also signs in (signs a challenge → server sets a session
 * cookie). Email/social login was removed because Privy cannot generate a
 * Stellar wallet.
 */
export default function ConnectPage() {
  const { isConnected: walletConnected, connecting: walletConnecting, connect: connectWallet, address } =
    useStellarWallet();
  const { goToLoginDestination } = useLoginDestination();

  async function onConnectWallet() {
    try {
      await connectWallet();
    } catch (error) {
      toast.error("Couldn't connect wallet", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }

  // As soon as the wallet connects (sign-in completes), land the user on their
  // dashboard (or onboarding if they have no profile yet).
  React.useEffect(() => {
    if (!walletConnected) return;
    return goToLoginDestination("push");
  }, [walletConnected, goToLoginDestination]);

  return (
    <AuthShell back={{ href: "/", label: "Back home" }}>
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Welcome to Shire</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect your Stellar wallet to sign in and access on-chain escrow.
        </p>

        <div className="mt-7 space-y-3">
          {walletConnected ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Wallet connected</span>
                <span className="font-mono text-xs">
                  {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""}
                </span>
              </div>
              <Button size="lg" className="w-full" onClick={() => goToLoginDestination("push")}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={onConnectWallet}
              disabled={walletConnecting}
            >
              {walletConnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Connecting…
                </>
              ) : (
                <>
                  <Wallet className="size-4" /> Connect Stellar Wallet
                </>
              )}
            </Button>
          )}

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Don&apos;t have a wallet? Install the{" "}
            <a
              href="https://freighter.app"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Freighter
            </a>{" "}
            extension and set it to Testnet.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
