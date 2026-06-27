"use client";

import { ArrowRight, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { useLoginDestination } from "@/lib/auth/use-login-destination";
import { AuthShell } from "@/components/layout/auth-shell";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";
import { Button } from "@/components/ui/button";

export default function ConnectPage() {
  const { isConnected } = useAuth();
  const { goToLoginDestination } = useLoginDestination();

  return (
    <AuthShell back={{ href: "/", label: "Back home" }}>
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <UserCircle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Welcome to Shire</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access your Shire account.
        </p>

        <div className="mt-7">
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Signed in</span>
                <span className="text-sm font-medium">Account ready</span>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => goToLoginDestination("push")}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <WalletConnectButton
              size="lg"
              autoNavigateOnConnect
              className="w-full"
            />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        No crypto setup. Use email, Google, or passkey.
      </p>
    </AuthShell>
  );
}
