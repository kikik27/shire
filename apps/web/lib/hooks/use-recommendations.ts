"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccessToken } from "@/lib/auth/use-access-token";
import type { RecommendationType, RecommendationStatus } from "@shire/shared";

export type Recommendation = {
  id: string;
  type: RecommendationType;
  candidateUserId: string;
  recruiterUserId?: string;
  jobId?: string;
  matchScore: number;
  confidence?: number;
  reasons: string[];
  missingRequirements: string[];
  riskFlags: string[];
  recommendedAction: string;
  status: RecommendationStatus;
  createdAt: number;
  updatedAt: number;
};

function authorizationHeaders(accessToken?: string) {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function readRecommendationsResponse(
  response: Response,
): Promise<Recommendation[]> {
  if (!response.ok) {
    throw new Error("Recommendations request failed.");
  }
  const body = (await response.json()) as { recommendations?: Recommendation[] };
  if (body.recommendations) {
    return body.recommendations;
  }
  throw new Error("Recommendations response was invalid.");
}

export function useCandidateRecommendations() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: ["recommendations", "candidate"],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/candidate/recommendations", {
        headers: authorizationHeaders(accessToken),
      });
      return readRecommendationsResponse(response);
    },
  });
}

export function useRecruiterRecommendations() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: ["recommendations", "recruiter"],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/recruiter/recommendations", {
        headers: authorizationHeaders(accessToken),
      });
      return readRecommendationsResponse(response);
    },
  });
}

/** Enqueue a job-matching run for the authenticated candidate. */
export function useRefreshCandidateRecommendations() {
  const queryClient = useQueryClient();
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch(
        "/api/candidate/recommendations/refresh",
        {
          method: "POST",
          headers: authorizationHeaders(accessToken),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to enqueue matching job.");
      }
      return (await response.json()) as { jobId: string; status: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["recommendations"],
      });
    },
  });
}

/** Enqueue a talent-matching run for a recruiter's job. */
export function useRefreshRecruiterRecommendations() {
  const queryClient = useQueryClient();
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const accessToken = await getAccessToken();
      const response = await fetch(
        `/api/recruiter/jobs/${jobId}/recommendations/refresh`,
        {
          method: "POST",
          headers: authorizationHeaders(accessToken),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to enqueue matching job.");
      }
      return (await response.json()) as { jobId: string; status: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["recommendations"],
      });
    },
  });
}
