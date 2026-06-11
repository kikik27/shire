"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/site/theme-provider";
import { PrivyAuthProvider } from "@/components/site/privy-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useShireStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    useShireStore.persist.rehydrate();
  }, []);

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
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </QueryClientProvider>
    </PrivyAuthProvider>
  );
}
