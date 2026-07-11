"use client";

import * as React from "react";
import { useStellarWallet } from "@/components/site/stellar-wallet-provider";

/**
 * Client-side "Sign in with Stellar" flow.
 *
 * Asks Freighter to sign a timestamped challenge, posts it to the server which
 * verifies the signature and sets a session cookie. After a successful sign-in
 * the app is reloaded so the new cookie is visible to server components / API
 * routes on the next request.
 *
 * This pairs with `lib/server/stellar-auth.ts` and `app/api/auth/stellar`.
 */

const SIGN_IN_PREFIX = "Shire sign-in @";

function buildSignInMessage(): string {
  return `${SIGN_IN_PREFIX}${new Date().toISOString()}`;
}

export function useStellarSession() {
  const { address, signMessage } = useStellarWallet();
  const [pending, setPending] = React.useState(false);

  const signInWithStellar = React.useCallback(async (): Promise<boolean> => {
    if (!address) {
      throw new Error("Connect your Stellar wallet before signing in.");
    }
    setPending(true);
    try {
      const message = buildSignInMessage();
      const { signedMessage } = await signMessage(message);
      const res = await fetch("/api/auth/stellar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, message, signature: signedMessage }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Sign-in failed (${res.status}).`);
      }
      return true;
    } finally {
      setPending(false);
    }
  }, [address, signMessage]);

  const signOutStellar = React.useCallback(async (): Promise<void> => {
    await fetch("/api/auth/stellar", { method: "DELETE" });
  }, []);

  return { signInWithStellar, signOutStellar, pending };
}
