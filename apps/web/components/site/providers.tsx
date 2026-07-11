"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/site/theme-provider";
import { PrivyAuthProvider } from "@/components/site/privy-provider";
import { StellarWalletProvider } from "@/components/site/stellar-wallet-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <PrivyAuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <StellarWalletProvider>
            <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
            <Toaster position="top-center" richColors />
          </StellarWalletProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </PrivyAuthProvider>
  );
}
