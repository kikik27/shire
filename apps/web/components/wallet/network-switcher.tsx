"use client";

import { useWallet } from "@/lib/wallet/use-wallet";
import { cn } from "@/lib/utils";

export function NetworkSwitcher({ className }: { className?: string }) {
  const { chainName, isCorrectNetwork } = useWallet();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", isCorrectNetwork ? "bg-success" : "bg-warning")}
        aria-hidden="true"
      />
      {chainName}
    </span>
  );
}
