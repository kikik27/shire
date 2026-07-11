"use client";

import * as React from "react";
import { ChevronDown, Loader2, Wallet } from "lucide-react";
import { useStellarWallet } from "@/components/site/stellar-wallet-provider";
import { truncateAddress } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { WalletMenuDialog } from "@/components/wallet/wallet-menu-dialog";

/**
 * Header wallet button. When disconnected it connects a Stellar wallet; when
 * connected it opens a popup (WalletMenuDialog) with faucet, signing, and
 * disconnect — like a profile menu.
 */
export function WalletConnectButton({
  size = "default",
  accountLabel = "Stellar wallet",
  accountDescription = "Testnet",
  className,
}: {
  size?: "sm" | "default" | "lg";
  /** Label shown on the connected account chip. */
  accountLabel?: string;
  accountDescription?: string;
  className?: string;
}) {
  const { address, isConnected, connecting, connect, ready } = useStellarWallet();
  const [menuOpen, setMenuOpen] = React.useState(false);

  async function onConnect() {
    try {
      await connect();
    } catch {
      /* surfaced inside the kit modal; open the popup for retries */
      setMenuOpen(true);
    }
  }

  if (!isConnected) {
    return (
      <>
        <Button
          size={size}
          onClick={onConnect}
          disabled={connecting || !ready}
          className={className}
        >
          {connecting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <Wallet className="size-4" /> Connect Stellar Wallet
            </>
          )}
        </Button>
        <WalletMenuDialog
          open={menuOpen}
          onOpenChange={setMenuOpen}
          accountDescription={accountDescription}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setMenuOpen(true)}
        className={`max-w-[220px] justify-start gap-2 ${className ?? ""}`}
      >
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        <span className="truncate">{address ? truncateAddress(address, 4) : accountLabel}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </Button>
      <WalletMenuDialog
        open={menuOpen}
        onOpenChange={setMenuOpen}
        accountDescription={accountDescription}
      />
    </>
  );
}
