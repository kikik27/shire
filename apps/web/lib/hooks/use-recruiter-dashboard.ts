"use client";

import { useQuery } from "@tanstack/react-query";

import { useAccessToken } from "@/lib/auth/use-access-token";
import { authorizationHeaders } from "@/lib/hooks/use-jobs";
import { RECRUITER_DASHBOARD_QUERY_KEY } from "@/lib/hooks/query-keys";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

export function useRecruiterDashboard() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: RECRUITER_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/recruiter/dashboard", {
        headers: authorizationHeaders(accessToken),
      });
      if (!response.ok) {
        throw new Error("Recruiter dashboard request failed.");
      }
      return response.json() as Promise<RecruiterDashboard>;
    },
  });
}
