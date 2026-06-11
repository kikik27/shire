"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { AuthShell } from "@/components/layout/auth-shell";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";
import { WalletAddressBadge } from "@/components/wallet/wallet-address-badge";
import { Button } from "@/components/ui/button";

const benefits = [
  { icon: ShieldCheck, text: "Stake-backed jobs — no fake recruiters or spam" },
  { icon: Sparkles, text: "AI match & risk scores on every role" },
  { icon: Wallet, text: "Email or Google sign-in — we create a secure wallet for you" },
];

export default function ConnectPage() {
  const { isConnected, address } = useAuth();

  return (
    <AuthShell back={{ href: "/", label: "Back home" }}>
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to Shire</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          New to crypto? No problem. Sign in with email or Google and we&apos;ll set up a secure
          wallet for you — no seed phrases. Already have a wallet? Connect it instead.
        </p>

        <ul className="mt-6 space-y-3">
          {benefits.map((b) => (
            <li key={b.text} className="flex items-start gap-3 text-sm">
              <b.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-foreground/90">{b.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7">
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Connected</span>
                {address && <WalletAddressBadge address={address} explorer={false} />}
              </div>
              <Button asChild size="lg" className="w-full">
                <Link href="/onboarding">
                  Continue
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <WalletConnectButton size="lg" redirectTo="/onboarding" />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Registry and stakes are simulated client-side in this preview.
      </p>
    </AuthShell>
  );
}
