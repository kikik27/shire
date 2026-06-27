"use client";

import { useQuery } from "@tanstack/react-query";

import { useAccessToken } from "@/lib/auth/use-access-token";
import type { RecommendationType, RecommendationStatus } from "@shire/shared";

export const RECOMMENDATIONS_REFETCH_INTERVAL_MS = 15 * 60 * 1000;

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
  candidate?: {
    displayName?: string;
    headline?: string;
    skills: string[];
    roleTargets: string[];
    location?: string;
  };
  job?: {
    title: string;
    companyName: string;
    location: string;
    remote: boolean;
    experienceLevel: string;
    skillsRequired: string[];
  };
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
    refetchInterval: RECOMMENDATIONS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
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
    refetchInterval: RECOMMENDATIONS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/recruiter/recommendations", {
        headers: authorizationHeaders(accessToken),
      });
      return readRecommendationsResponse(response);
    },
  });
}
