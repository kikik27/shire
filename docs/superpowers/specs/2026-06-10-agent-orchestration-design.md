# Shire Agent Orchestration Design

## Summary
Build `apps/agent` as the orchestration layer for Shire. The workspace should coordinate CV parsing, job matching, talent matching, dispute summaries, and onchain sync jobs through a clean Mastra-based structure. The design must stay lean, use explicit boundaries, and avoid speculative logic.

## Goals
- Provide a single orchestration runtime for Shire agent workflows.
- Keep each domain isolated behind clear files and exports.
- Make the agent behave as an orchestrator that routes to the right workflow, tool, or job.
- Keep outputs structured, auditable, and deterministic where possible.
- Preserve the rule that current library and CLI documentation should be checked through Context7 before relying on framework-specific behavior.

## Non-Goals
- Implement production database access.
- Implement real Stellar transaction signing or escrow settlement logic yet.
- Add UI code or web app behavior here.
- Add extra agent domains beyond the five current workflow families.
- Introduce shared packages back into the repo.

## Current Workspace Shape
The agent workspace will keep this layout:
- `src/mastra/agents/`
- `src/mastra/workflows/`
- `src/mastra/tools/`
- `src/jobs/`
- `src/server.ts`
- `src/env.ts`

The root monorepo remains lean with:
- `apps/web`
- `apps/agent`
- `contracts`

## Proposed Architecture

### Orchestration boundary
`apps/agent` is the only place that coordinates Shire agent behavior. It is the runtime for:
- agent definitions
- workflow definitions
- reusable tools
- runnable job entrypoints
- local server bootstrap

The Mastra entrypoint lives in `src/mastra/index.ts` and exports one `Mastra` instance plus named exports for all agents, workflows, and tools.

### Domain agents
Each agent owns one narrow concern:
- `cv-profile.agent.ts` normalizes raw CV content into structured candidate profiles.
- `job-matching.agent.ts` matches a candidate against a job description.
- `talent-matching.agent.ts` matches talent against company needs.
- `dispute-summary.agent.ts` summarizes a dispute from evidence and context.

Each agent:
- uses `openai/gpt-4.1-mini`
- has explicit instructions that favor the smallest appropriate skill, tool, or MCP
- must prefer Context7 first when current docs for a library, SDK, or CLI are relevant
- returns concise, structured, execution-oriented output

### Workflows
Workflows provide deterministic, testable transformations:
- `parse-cv.workflow.ts` turns raw CV text into a compact profile summary and keywords.
- `job-matching.workflow.ts` turns candidate and job text into a match summary and score.
- `talent-matching.workflow.ts` turns company need and talent profile text into a match summary and score.
- `dispute-summary.workflow.ts` turns issue and evidence text into a summary and recommended action.

Workflows should avoid hidden side effects. They should be easy to unit test with fixed sample input and expected output.

### Tools
The tools layer is a thin context access layer:
- `user.tools.ts`
- `candidate.tools.ts`
- `company.tools.ts`
- `job.tools.ts`
- `matching.tools.ts`
- `evidence.tools.ts`

These tools are intentionally small. In the first implementation pass they return deterministic stub context. Later, they will be replaced with real data fetchers, but their shape should remain stable.

### Jobs and runtime
`src/jobs/` contains callable entrypoints for each background action:
- `run-cv-parse.ts`
- `run-job-matching.ts`
- `run-talent-matching.ts`
- `run-onchain-sync.ts`
- `run-dispute-summary.ts`

`src/server.ts` is the local runtime entrypoint and can dispatch a specific job by CLI argument. If no job is passed, it starts the agent runtime and prints the available job list.

`src/env.ts` centralizes environment access so runtime code does not read `process.env` inline everywhere.

## Data Flow
1. A CLI command or future scheduler invokes `src/server.ts`.
2. The server resolves the requested job name.
3. The job runner selects the relevant workflow and agent identifiers.
4. The workflow performs the deterministic transformation for the request.
5. The agent is available when orchestration needs reasoning, tool selection, or routing.
6. The output is returned as structured JSON so the next system can consume it without parsing prose.

The onchain sync job is intentionally separate from matching. It should prepare chain-facing actions without mixing them into candidate or job scoring.

## Error Handling
- Use explicit validation for all workflow inputs with `zod`.
- Fail fast when a required field is missing.
- Do not infer business-critical values that are not present.
- Keep errors actionable and tied to the failing job or workflow.
- Prefer returning structured failure objects for jobs when a human-readable CLI message is not enough.

## Testing Strategy
Start with fast, local checks:
- `npm run typecheck --workspace=@shire/agent`
- `npm run build --workspace=@shire/agent`

Add tests for:
- workflow input/output behavior with sample fixtures
- job dispatch routing
- Mastra exports from `src/mastra/index.ts`
- environment parsing in `src/env.ts`

The first test target should be deterministic workflow behavior, because that gives the highest confidence with the least setup.

## Rollout Plan
1. Keep the current lean workspace shape.
2. Implement deterministic workflow logic for each domain.
3. Replace stub tools with actual context readers only when a real data source exists.
4. Add onchain sync integration after matching flows are stable.
5. Expand tests as each workflow becomes real.

## Success Criteria
- `apps/agent` compiles and builds cleanly.
- The Mastra entrypoint exports all agents, workflows, and tools in one place.
- Each job runner maps to exactly one domain concern.
- The agent acts as an orchestrator, not a generic chat wrapper.
- The repo stays lean with no extra shared package layer.
