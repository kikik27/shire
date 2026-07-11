"use client";

import * as React from "react";
import { ArrowRight, Loader2, Mail, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useStellarWallet } from "@/components/site/stellar-wallet-provider";
import { PRIVY_ENABLED, useAuth } from "@/lib/auth/use-auth";
import { useLoginDestination } from "@/lib/auth/use-login-destination";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";

/**
 * Sign-in page. The primary flow is "Connect Stellar Wallet" — connecting a
 * wallet also signs in (signs a challenge → server sets a session cookie).
 * Email/social login via Privy is offered as a secondary option.
 *
 * A user is considered signed in once EITHER path completes: the Stellar
 * wallet is connected, OR Privy reports an authenticated session. Either way we
 * resolve the landing destination and navigate there.
 */
export default function ConnectPage() {
  const { isConnected: walletConnected, connecting: walletConnecting, connect: connectWallet, address } =
    useStellarWallet();
  const {
    isConnected: identityConnected,
    connecting: identityConnecting,
    connect: privyLogin,
  } = useAuth();
  const { goToLoginDestination } = useLoginDestination();

  // "Signed in" = wallet session OR Privy session. This drives the Continue CTA.
  const signedIn = walletConnected || identityConnected;

  async function onConnectWallet() {
    try {
      await connectWallet();
    } catch (error) {
      toast.error("Couldn't connect wallet", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }

  // As soon as either identity path resolves to connected, land the user on
  // their dashboard (or onboarding if they have no profile yet).
  React.useEffect(() => {
    if (!signedIn) return;
    return goToLoginDestination("push");
  }, [signedIn, goToLoginDestination]);

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
          {signedIn ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">
                  {walletConnected ? "Wallet connected" : "Signed in"}
                </span>
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

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {PRIVY_ENABLED ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => void privyLogin()}
              disabled={identityConnecting}
            >
              {identityConnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Continue with email
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Email login is not configured.</p>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
