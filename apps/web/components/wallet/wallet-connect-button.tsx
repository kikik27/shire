"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PRIVY_ENABLED, useAuth } from "@/lib/auth/use-auth";
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
import { truncateAddress } from "@/lib/format";

export function WalletConnectButton({
  size = "default",
  redirectTo,
}: {
  size?: "sm" | "default" | "lg";
  redirectTo?: string;
}) {
  const router = useRouter();
  const { address, isConnected, connecting, connect, disconnect } = useAuth();

  // With Privy, login resolves through its own modal — redirect once auth lands.
  useEffect(() => {
    if (PRIVY_ENABLED && redirectTo && isConnected) router.push(redirectTo);
  }, [isConnected, redirectTo, router]);

  async function onConnect() {
    await connect();
    // The demo store resolves synchronously here; Privy shows its own confirmation UI.
    if (!PRIVY_ENABLED) {
      toast.success("Wallet connected", { description: "MiniPay (Celo Alfajores)" });
      if (redirectTo) router.push(redirectTo);
    }
  }

  if (!isConnected) {
    return (
      <Button size={size} onClick={onConnect} disabled={connecting}>
        {connecting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {PRIVY_ENABLED ? "Signing in…" : "Connecting…"}
          </>
        ) : (
          <>
            <Wallet className="size-4" />
            {PRIVY_ENABLED ? "Sign in" : "Connect wallet"}
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="font-mono">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {truncateAddress(address)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Wallet</DropdownMenuLabel>
        <div className="flex flex-col gap-2 px-2 py-1.5">
          <WalletAddressBadge address={address!} />
          <NetworkSwitcher />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            disconnect();
            toast("Wallet disconnected");
            router.push("/");
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
