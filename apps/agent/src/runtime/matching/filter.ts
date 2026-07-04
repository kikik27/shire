/**
 * Deterministic hard filters. These run BEFORE rule scoring and the rerank
 * model, per .agent/context/agent/matching-pipeline.md:
 *
 * Candidate → Job (job-matching):
 *   - CandidateProfile must be CONFIRMED  (enforced by repository.getCandidateProfile)
 *   - Job must be ACTIVE
 *   - Candidate must not be the job's recruiter (no self-apply)
 *   - Candidate must not have already applied
 *
 * Job → Candidate (talent-matching):
 *   - Job must be ACTIVE
 *   - Candidate must be CONFIRMED  (enforced by repository.listConfirmedCandidates)
 *   - Candidate must not be the job's recruiter (no self-recommendation)
 *
 * Note on anti-self-company: the full Company/CompanyMember model is out of
 * scope this cycle, so for MVP "same company" is approximated by "same
 * recruiter owns the job". This is documented as a limitation.
 */

export type FilterResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function filterCandidateToJob(
  candidateUserId: string,
  job: { id: string; recruiterUserId: string; status: string },
  appliedJobIds: ReadonlySet<string>,
): FilterResult {
  if (job.status !== "ACTIVE") {
    return { allowed: false, reason: "job-not-active" };
  }
  if (job.recruiterUserId === candidateUserId) {
    return { allowed: false, reason: "self-owned-job" };
  }
  if (appliedJobIds.has(job.id)) {
    return { allowed: false, reason: "already-applied" };
  }
  return { allowed: true };
}
