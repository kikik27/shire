"use client";

import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WalletAddressBadge({
  address,
  className,
  explorer = true,
}: {
  address: string;
  className?: string;
  explorer?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={copied ? "Address copied" : "Copy wallet address"}
      >
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        {truncateAddress(address)}
        {copied ? (
          <Check className="size-3 text-success" aria-hidden="true" />
        ) : (
          <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
      {explorer && (
        <a
          href={`https://alfajores.celoscan.io/address/${address}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View on Celo explorer"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </span>
  );
}
