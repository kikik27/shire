# Agent Workflows

## Parse CV Workflow
1. Receive `userId` and `cvFileId`.
2. Load file metadata.
3. Extract CV text.
4. Run CV Profile Agent.
5. Validate output with Zod.
6. Save `CandidateProfile` as `PENDING_REVIEW`.
7. Save `AgentRun` log.
8. Return profile draft.

## Job Matching Workflow
1. Get `CandidateProfile` where `status = CONFIRMED`.
2. Find `ACTIVE` jobs.
3. Exclude jobs owned by companies where user is member.
4. Exclude jobs already applied to.
5. Run hard filter.
6. Run rule-based score.
7. Run Job Matching Agent.
8. Save recommendation if score >= 70.
9. Notify user if score >= 85.
10. Save `AgentRun` log.

## Talent Matching Workflow
1. Get `ACTIVE` job.
2. Get company owner and member IDs.
3. Find `CandidateProfile` where `status = CONFIRMED`.
4. Exclude candidate profiles owned by company members.
5. Run hard filter.
6. Run rule-based score.
7. Run Talent Matching Agent.
8. Save recommendation if score >= 70.
9. Notify company if score >= 85.
10. Save `AgentRun` log.

## Dispute Summary Workflow
1. Get dispute.
2. Get application.
3. Get evidence.
4. Get onchain events.
5. Run Dispute Summary Agent.
6. Save summary to `Dispute.summary`.
7. Save `AgentRun` log.
8. Notify admin.
# Capability-based execution

Agent jobs use fixed model capability IDs rather than caller-selected model IDs:

- `cv-parse` -> `cv-normalization`
- `job-matching` -> `job-rerank`
- `talent-matching` -> `talent-rerank`
- `dispute-summary` -> `dispute-summary`

Onchain sync never calls an LLM. Each routed job returns attempted models and
normalized usage records. CV normalization and CV embedding are separate
operations; raw CV text is not stored in memory.
