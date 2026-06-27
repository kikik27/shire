"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { PRIVY_ENABLED, useAuth } from "@/lib/auth/use-auth";
import { useLoginDestination } from "@/lib/auth/use-login-destination";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletAddressBadge } from "@/components/wallet/wallet-address-badge";
import { NetworkSwitcher } from "@/components/wallet/network-switcher";

export function WalletConnectButton({
  size = "default",
  autoNavigateOnConnect = false,
  accountLabel = "Account",
  accountDescription = "Signed in",
  className,
}: {
  size?: "sm" | "default" | "lg";
  /** Navigate to the resolved login destination (dashboard or onboarding) once connected. */
  autoNavigateOnConnect?: boolean;
  accountLabel?: string;
  accountDescription?: string;
  className?: string;
}) {
  const router = useRouter();
  const { address, isConnected, connecting, connect, disconnect } = useAuth();
  const { goToLoginDestination } = useLoginDestination();

  // When Privy connects, land the user on their role dashboard (or onboarding
  // if they have no profile yet) instead of always forcing onboarding.
  useEffect(() => {
    if (!PRIVY_ENABLED || !autoNavigateOnConnect || !isConnected) return;
    const cancel = goToLoginDestination("push");
    return cancel;
  }, [isConnected, autoNavigateOnConnect, goToLoginDestination]);

  async function onConnect() {
    await connect();
    if (!PRIVY_ENABLED) {
      toast.success("Signed in", { description: "Your account is ready." });
      if (autoNavigateOnConnect) goToLoginDestination("push");
    }
  }

  if (!isConnected) {
    return (
      <Button size={size} onClick={onConnect} disabled={connecting} className={className}>
        {connecting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <UserCircle className="size-4" />
            Sign in
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="max-w-[220px] justify-start gap-2">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          <span className="truncate">{accountLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate">{accountLabel}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {accountDescription}
          </span>
        </DropdownMenuLabel>
        <div className="flex flex-col gap-2 px-2 py-1.5">
          {address ? <WalletAddressBadge address={address} /> : null}
          <NetworkSwitcher />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            disconnect();
            toast("Signed out");
            router.push("/");
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
