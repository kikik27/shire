"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlatformStakeType } from "@shire/shared";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { authorizationHeaders } from "@/lib/hooks/use-jobs";
import type { PlatformStake } from "@/lib/types";
import type { TokenSymbol } from "@/lib/types";

export const STAKES_QUERY_KEY = ["stakes"] as const;

async function readStakeResponse(response: Response) {
  if (!response.ok) {
    throw new Error("Platform escrow request failed.");
  }
  return response.json() as Promise<{
    stake?: PlatformStake;
    stakes?: PlatformStake[];
  }>;
}

export function usePlatformStakes() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: [...STAKES_QUERY_KEY, "owner"],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const body = await readStakeResponse(
        await fetch("/api/stakes", {
          headers: authorizationHeaders(accessToken),
        }),
      );
      return body.stakes ?? [];
    },
  });
}

export function useCreatePlatformStake() {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: PlatformStakeType;
      amount: number;
      token: TokenSymbol;
      idempotencyKey: string;
      jobId?: string;
      applicationId?: string;
      reason?: string;
    }) => {
      const accessToken = await getAccessToken();
      const body = await readStakeResponse(
        await fetch("/api/stakes", {
          method: "POST",
          headers: {
            ...authorizationHeaders(accessToken),
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );
      if (!body.stake) {
        throw new Error("Platform escrow response was invalid.");
      }
      return body.stake;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAKES_QUERY_KEY });
    },
  });
}
