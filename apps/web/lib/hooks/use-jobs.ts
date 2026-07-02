"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccessToken } from "@/lib/auth/use-access-token";
import type { JobDraftValues } from "@/lib/schemas";
import { StakeStatus, type Job } from "@/lib/types";

export type ApiJob = Omit<
  Job,
  "recruiterId" | "stakeStatus"
> & {
  recruiterUserId: string;
};

export function authorizationHeaders(accessToken?: string) {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export function apiJobToJob(job: ApiJob): Job {
  return {
    id: job.id,
    recruiterId: job.recruiterUserId,
    title: job.title,
    description: job.description,
    companyName: job.companyName,
    location: job.location,
    remote: job.remote,
    salaryRange: job.salaryRange,
    jobType: job.jobType,
    experienceLevel: job.experienceLevel,
    skillsRequired: job.skillsRequired,
    status: job.status,
    stakeAmount: job.stakeAmount,
    stakeToken: job.stakeToken,
    stakeStatus: job.status === "ACTIVE" ? StakeStatus.Locked : StakeStatus.Cancelled,
    candidateStakeRequired: job.candidateStakeRequired,
    candidateStakeAmount: job.candidateStakeAmount,
    riskLevel: job.riskLevel,
    riskScore: job.riskScore,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
  };
}

async function readJobsResponse(response: Response) {
  if (!response.ok) {
    throw new Error("Jobs request failed.");
  }
  const body = (await response.json()) as { jobs?: ApiJob[]; job?: ApiJob };
  if (body.jobs) {
    return body.jobs.map(apiJobToJob);
  }
  if (body.job) {
    return apiJobToJob(body.job);
  }
  throw new Error("Jobs response was invalid.");
}

export function useRecruiterApiJobs() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: ["jobs", "recruiter"],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/recruiter/jobs", {
        headers: authorizationHeaders(accessToken),
      });
      return (await readJobsResponse(response)) as Job[];
    },
  });
}

export function useCandidateApiJobs() {
  const getAccessToken = useAccessToken();
  return useQuery({
    queryKey: ["jobs", "candidate"],
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/candidate/jobs", {
        headers: authorizationHeaders(accessToken),
      });
      return (await readJobsResponse(response)) as Job[];
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async (draft: JobDraftValues) => {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/recruiter/jobs", {
        method: "POST",
        headers: {
          ...authorizationHeaders(accessToken),
          "content-type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      return (await readJobsResponse(response)) as Job;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function usePublishJob() {
  const queryClient = useQueryClient();
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          ...authorizationHeaders(accessToken),
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      return (await readJobsResponse(response)) as Job;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
