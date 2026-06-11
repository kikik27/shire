"use client";

import { useMemo } from "react";
import { ME_CANDIDATE_ID, ME_RECRUITER_ID, useShireStore } from "@/lib/store";

export function useActiveJobs() {
  const jobs = useShireStore((s) => s.jobs);
  return useMemo(() => jobs.filter((j) => j.status === "ACTIVE"), [jobs]);
}

export function useJob(id: string) {
  const jobs = useShireStore((s) => s.jobs);
  return useMemo(() => jobs.find((j) => j.id === id), [jobs, id]);
}

export function useSavedJobs() {
  const jobs = useShireStore((s) => s.jobs);
  const savedIds = useShireStore((s) => s.savedJobIds);
  return useMemo(() => jobs.filter((j) => savedIds.includes(j.id)), [jobs, savedIds]);
}

export function useCandidateApplications() {
  const apps = useShireStore((s) => s.applications);
  return useMemo(
    () =>
      apps
        .filter((a) => a.candidateId === ME_CANDIDATE_ID)
        .sort((a, b) => b.appliedAt - a.appliedAt),
    [apps],
  );
}

export function useRecruiterJobs() {
  const jobs = useShireStore((s) => s.jobs);
  return useMemo(
    () =>
      jobs
        .filter((j) => j.recruiterId === ME_RECRUITER_ID)
        .sort((a, b) => b.createdAt - a.createdAt),
    [jobs],
  );
}

export function useRecruiterApplicants() {
  const jobs = useShireStore((s) => s.jobs);
  const apps = useShireStore((s) => s.applications);
  return useMemo(() => {
    const myJobIds = new Set(
      jobs.filter((j) => j.recruiterId === ME_RECRUITER_ID).map((j) => j.id),
    );
    return apps
      .filter((a) => myJobIds.has(a.jobId) && a.candidateId !== ME_CANDIDATE_ID)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [jobs, apps]);
}

export function useRecruiterStakes() {
  const stakes = useShireStore((s) => s.stakes);
  return useMemo(
    () => stakes.filter((s) => s.userId === ME_RECRUITER_ID).sort((a, b) => b.createdAt - a.createdAt),
    [stakes],
  );
}

export function useCandidateStakes() {
  const stakes = useShireStore((s) => s.stakes);
  return useMemo(
    () => stakes.filter((s) => s.userId === ME_CANDIDATE_ID).sort((a, b) => b.createdAt - a.createdAt),
    [stakes],
  );
}
