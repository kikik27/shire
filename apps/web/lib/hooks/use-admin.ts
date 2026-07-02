"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DisputeStatus, PlatformStakeStatus } from "@shire/shared";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { authorizationHeaders } from "@/lib/hooks/use-jobs";
import type { AdminOverview } from "@/lib/server/admin-repository";
import type { PersistedJob } from "@/lib/server/jobs-repository";
import type { PlatformDispute, PlatformStake } from "@/lib/types";

const ADMIN_QUERY_KEY = ["admin"] as const;

async function adminRequest<T>(
  url: string,
  accessToken: string | undefined,
  init?: RequestInit,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authorizationHeaders(accessToken),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Admin request failed with status ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

function useAdminQuery<T>(segment: string, url: string) {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: [...ADMIN_QUERY_KEY, segment],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return adminRequest<T>(url, accessToken);
    },
  });
}

function useAdminMutation<TInput, TOutput>(url: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => {
      const accessToken = await getAccessToken();
      return adminRequest<TOutput>(url, accessToken, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEY });
    },
  });
}

export function useAdminOverview() {
  return useAdminQuery<AdminOverview>("overview", "/api/admin/overview");
}

export function useAdminJobs() {
  return useAdminQuery<{ jobs: PersistedJob[] }>("jobs", "/api/admin/jobs");
}

export function useModerateJob() {
  return useAdminMutation<
    { id: string; action: "approve" | "flag" | "close" },
    { job: PersistedJob }
  >("/api/admin/jobs");
}

export function useAdminStakes() {
  return useAdminQuery<{ stakes: PlatformStake[] }>(
    "stakes",
    "/api/admin/stakes",
  );
}

export function useTransitionStake() {
  return useAdminMutation<
    {
      id: string;
      status: Exclude<PlatformStakeStatus, "LOCKED">;
      reason?: string;
    },
    { stake: PlatformStake }
  >("/api/admin/stakes");
}

export function useAdminDisputes() {
  return useAdminQuery<{ disputes: PlatformDispute[] }>(
    "disputes",
    "/api/admin/disputes",
  );
}

export function useResolveDispute() {
  return useAdminMutation<
    {
      id: string;
      status: Extract<DisputeStatus, "RESOLVED" | "REJECTED">;
      decision: string;
      stakeStatus?: Extract<PlatformStakeStatus, "REFUNDED" | "SLASHED">;
    },
    { dispute: PlatformDispute }
  >("/api/admin/disputes");
}
