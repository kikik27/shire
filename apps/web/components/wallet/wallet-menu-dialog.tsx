"use client";

import * as React from "react";
import { Coins, FileSignature, Loader2, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useStellarWallet } from "@/components/site/stellar-wallet-provider";
import { claimTestnetXlm, fetchXlmBalance } from "@/lib/stellar/faucet";
import { truncateAddress } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

/**
 * Wallet popup — opens from the header wallet button like a profile menu.
 * Holds everything Stellar: connect state, XLM faucet, signing demo, and
 * disconnect. Replaces the old standalone /wallet route and the bare dropdown.
 */
export function WalletMenuDialog({
  open,
  onOpenChange,
  accountDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional context label (e.g. role) shown under the address. */
  accountDescription?: string;
}) {
  const { address, isConnected, networkName } = useStellarWallet();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" aria-hidden="true" />
            Stellar wallet
          </DialogTitle>
          <DialogDescription>
            {isConnected
              ? `Connected to ${networkName}`
              : "Connect a Stellar wallet to manage funds and sign on-chain."}
          </DialogDescription>
        </DialogHeader>

        {/* Status row */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {accountDescription ?? "Address"}
          </span>
          {isConnected ? (
            <span className="font-mono text-xs">{truncateAddress(address, 6)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Not connected</span>
          )}
        </div>

        {isConnected ? (
          <Tabs defaultValue="faucet" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="faucet" className="gap-1.5">
                <Coins className="size-3.5" /> Faucet
              </TabsTrigger>
              <TabsTrigger value="signing" className="gap-1.5">
                <FileSignature className="size-3.5" /> Signing
              </TabsTrigger>
            </TabsList>
            <TabsContent value="faucet" className="mt-4">
              <FaucetPanel address={address!} />
            </TabsContent>
            <TabsContent value="signing" className="mt-4">
              <SigningPanel />
            </TabsContent>
          </Tabs>
        ) : (
          <ConnectPanel />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Inline connect button shown when no wallet is connected. */
function ConnectPanel() {
  const { connect, connecting } = useStellarWallet();
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        onClick={() => connect().catch((e) => toast.error("Couldn't connect", { description: e.message }))}
        disabled={connecting}
      >
        {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
        Connect Stellar Wallet
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Freighter, xBull, Albedo, or Lobstr
      </p>
    </div>
  );
}

/** Faucet tab — claim test XLM via Friendbot using the connected address. */
function FaucetPanel({ address }: { address: string }) {
  const { disconnect } = useStellarWallet();
  const [balance, setBalance] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  // Refresh balance when the address changes.
  React.useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void fetchXlmBalance(address).then((bal) => {
      if (!cancelled) setBalance(bal);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function claim() {
    setLoading(true);
    try {
      const result = await claimTestnetXlm(address);
      const fresh = await fetchXlmBalance(address).catch(() => undefined);
      setBalance(fresh);
      if (result.alreadyFunded) {
        toast.info("Account already funded", {
          description: fresh ? `Balance: ${fresh} XLM` : undefined,
        });
      } else {
        toast.success("Test XLM claimed", {
          description: fresh ? `Balance: ${fresh} XLM` : undefined,
        });
      }
    } catch (error) {
      toast.error("Faucet request failed", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Balance</span>
        <span className="font-mono font-medium">{balance ? `${balance} XLM` : "—"}</span>
      </div>
      <Button onClick={claim} disabled={loading} className="w-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
        Claim test XLM
      </Button>
      <p className="text-xs text-muted-foreground">
        Fund your Testnet account from Friendbot. Free, test-only tokens.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive"
        onClick={() => void disconnect().then(() => toast("Wallet disconnected"))}
      >
        <LogOut className="size-4" /> Disconnect
      </Button>
    </div>
  );
}

/** Signing tab — prove message + transaction signing via the connected wallet. */
function SigningPanel() {
  const { address: signAddress, signMessage, signTransaction, disconnect } = useStellarWallet();
  const [mode, setMode] = React.useState<"message" | "transaction" | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  async function doSignMessage() {
    setMode("message");
    setResult(null);
    try {
      const { signedMessage } = await signMessage("Shire proof-of-ownership");
      setResult(signedMessage);
      toast.success("Message signed by the wallet.");
    } catch (error) {
      toast.error("Signing rejected", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setMode(null);
    }
  }

  async function doSignTransaction() {
    setMode("transaction");
    setResult(null);
    if (!signAddress) {
      toast.error("Connect your wallet first.");
      setMode(null);
      return;
    }
    try {
      const xdr = await buildDemoPaymentXdr(signAddress);
      const { signedTxXdr } = await signTransaction(xdr);
      setResult(signedTxXdr);
      toast.success("Transaction signed by the wallet.");
    } catch (error) {
      toast.error("Signing rejected", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setMode(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={doSignMessage} disabled={mode !== null}>
          {mode === "message" ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}
          Sign message
        </Button>
        <Button variant="outline" size="sm" onClick={doSignTransaction} disabled={mode !== null}>
          {mode === "transaction" ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
          Sign transaction
        </Button>
      </div>

      {result ? (
        <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] break-all whitespace-pre-wrap">
          {result}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sign a message or a testnet transaction (XDR). Nothing is submitted.
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive"
        onClick={() => void disconnect().then(() => toast("Wallet disconnected"))}
      >
        <LogOut className="size-4" /> Disconnect
      </Button>
    </div>
  );
}

/**
 * Build an unsigned Stellar payment transaction (1 stroop native payment to the
 * same account) as base64 XDR. Used only to exercise signTransaction — it's
 * never submitted. Dynamically imports stellar-sdk so it stays client-only.
 */
async function buildDemoPaymentXdr(sourceAddress: string): Promise<string> {
  const { TransactionBuilder, Operation, Account, Asset, BASE_FEE } = await import(
    "@stellar/stellar-sdk"
  );
  const account = new Account(sourceAddress, "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: "Test SDF Network ; September 2015",
  })
    .addOperation(
      Operation.payment({
        destination: sourceAddress,
        asset: Asset.native(),
        amount: "0.0000001", // 1 stroop — the smallest unit of XLM.
      }),
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}
