"use client";

import { useQuery } from "@tanstack/react-query";

import { useAccessToken } from "@/lib/auth/use-access-token";
import {
  apiJobToJob,
  authorizationHeaders,
  type ApiJob,
} from "@/lib/hooks/use-jobs";
import { CANDIDATE_DASHBOARD_QUERY_KEY } from "@/lib/hooks/query-keys";
import type { CandidateJobMatch, Job } from "@/lib/types";
import type {
  CandidateDashboard,
} from "@/lib/server/candidate-dashboard-repository";

export const CANDIDATE_DASHBOARD_REFETCH_INTERVAL_MS = 15 * 60 * 1000;

export type CandidateJobDetail = {
  job: Job;
  match: CandidateJobMatch | null;
};

async function readJson<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export function useCandidateDashboard() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: CANDIDATE_DASHBOARD_QUERY_KEY,
    refetchInterval: CANDIDATE_DASHBOARD_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/candidate/dashboard", {
        headers: authorizationHeaders(accessToken),
      });
      return readJson<CandidateDashboard>(
        response,
        "Candidate dashboard request failed.",
      );
    },
  });
}

export function useCandidateJob(jobId: string) {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: ["jobs", "candidate", "detail", jobId],
    queryFn: async (): Promise<CandidateJobDetail | null> => {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/candidate/jobs/${jobId}`, {
        headers: authorizationHeaders(accessToken),
      });
      if (response.status === 404) {
        return null;
      }
      const body = await readJson<{ job: ApiJob; match: CandidateJobMatch | null }>(
        response,
        "Candidate job request failed.",
      );
      return {
        job: apiJobToJob(body.job),
        match: body.match,
      };
    },
  });
}
