# `apps/agent`

Background orchestration service for Shire.

## Structure
- `src/mastra/agents/` contains domain agents
- `src/mastra/workflows/` contains workflow definitions
- `src/mastra/tools/` contains reusable orchestration tools
- `src/jobs/` contains runnable background job entrypoints
- `src/server.ts` is the local runtime entrypoint
- `src/env.ts` centralizes runtime environment access

## Capability model configuration

Daily model configuration is intentionally small:

```env
SHIRE_TEXT_PROVIDER=tokenrouter
SHIRE_TEXT_MODEL=MiniMax-M3
SHIRE_TEXT_BASE_URL=https://api.tokenrouter.com/v1
SHIRE_TEXT_API_KEY=...

SHIRE_EMBEDDING_PROVIDER=openai
SHIRE_EMBEDDING_MODEL=text-embedding-3-small
SHIRE_EMBEDDING_BASE_URL=https://api.openai.com/v1
SHIRE_EMBEDDING_API_KEY=...
SHIRE_EMBEDDING_ENABLED=true
```

All chat capabilities use `SHIRE_TEXT_MODEL` unless an advanced capability
override is configured. Comma-separated fallback chains are still supported:

- `SHIRE_MODEL_PRODUCT_QNA`: public product assistant on the landing page
- `SHIRE_MODEL_ROLE_AWARE_CHAT`: authenticated candidate/recruiter chat
- `SHIRE_MODEL_CV_NORMALIZATION`: CV parsing and profile normalization
- `SHIRE_MODEL_KNOWLEDGE_SYNTHESIS`: internal knowledge synthesis
- `SHIRE_MODEL_JOB_RERANK`: candidate-to-job reranking
- `SHIRE_MODEL_TALENT_RERANK`: talent-to-job reranking
- `SHIRE_MODEL_RECOMMENDATION_EXPLANATION`: recommendation explanations
- `SHIRE_MODEL_WORKFLOW_SUMMARY`: short workflow summaries
- `SHIRE_MODEL_DISPUTE_SUMMARY`: dispute evidence summaries
- `SHIRE_MODEL_SECURITY_GUARD`: LLM-backed security guard checks

Embedding-specific overrides are also optional:

- `SHIRE_EMBEDDING_MODEL_MEMORY`
- `SHIRE_EMBEDDING_MODEL_PRODUCT_KNOWLEDGE`
- `SHIRE_EMBEDDING_MODEL_REPOSITORY_KNOWLEDGE`
- `SHIRE_EMBEDDING_BASE_URL_MEMORY`
- `SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE`
- `SHIRE_EMBEDDING_BASE_URL_REPOSITORY_KNOWLEDGE`
- `SHIRE_EMBEDDING_ENABLED`: enable semantic memory and vector retrieval
- `SHIRE_WORKING_MEMORY_ENABLED`: enable tool-based persistent working memory

`SHIRE_TEXT_API_KEY` defaults to `TOKENROUTER_API_KEY` when unset.
`SHIRE_EMBEDDING_API_KEY` defaults to `OPENAI_API_KEY` or `OPENROUTER_API_KEY`
when unset. TokenRouter is kept for text generation because its model list does
not expose embedding channels for `qwen/qwen3-embedding-8b`. Working memory
remains disabled by default; recent conversation history remains enabled.
Semantic recall is enabled only when `SHIRE_EMBEDDING_ENABLED=true` with a
provider/model that supports embeddings.

Memory and repository knowledge use libSQL URLs. Local development defaults to
`file:` databases under `.data`; production should use remote libSQL/Turso URLs
so deployments do not lose memory or vector sync state:

```env
SHIRE_AGENT_MEMORY_URL=libsql://shire-agent-memory-labsmula.aws-ap-northeast-1.turso.io
SHIRE_AGENT_MEMORY_AUTH_TOKEN=...
SHIRE_AGENT_KNOWLEDGE_URL=libsql://shire-agent-knowledge.example.turso.io
SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN=...
SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL=libsql://shire-agent-knowledge.example.turso.io
SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN=...
```

If `SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL` is omitted, it defaults to
`SHIRE_AGENT_KNOWLEDGE_URL`; if the manifest token is omitted, it defaults to
`SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN`. Retrieval defaults to five results and an
8,000-character context budget; configure these with
`SHIRE_AGENT_KNOWLEDGE_INDEX`, `SHIRE_RAG_TOP_K`, and
`SHIRE_RAG_MAX_CHARACTERS`.

## Runtime policy

All chat capabilities default to the configured text model. Override individual
capability env values with comma-separated fallback chains only when a
capability needs a different model.

CV extraction produces a Zod-validated draft. Embedding is a separate
TokenRouter request resolved by Mastra over canonical profile search text. Raw
CV text and full evidence files are excluded from memory.

## Background worker

The service starts the HTTP listener and BullMQ worker in the same process.
Redis persists queued jobs, retry state, and results across service restarts.
Production must configure `REDIS_URL`; the in-memory fallback is only suitable
for local development and deterministic tests.

Start the service:

```bash
npm run dev --workspace=@shire/agent
```

Submit a deterministic job:

```http
POST http://localhost:3010/jobs
Content-Type: application/json

{
  "name": "onchain-sync",
  "payload": {
    "chain": "Celo"
  }
}
```

Submit an LLM-backed CV job:

```http
POST http://localhost:3010/jobs
Content-Type: application/json

{
  "name": "cv-parse",
  "payload": {
    "candidateId": "candidate-001",
    "rawCv": "Maya Okafor. Senior frontend engineer with TypeScript and React experience."
  }
}
```

Both requests return `202` with a `jobId`. Poll:

```http
GET http://localhost:3010/jobs/{jobId}
```

The status transitions through `queued`, `active`, then `completed` or
`failed`. `onchain-sync` returns `llmInvoked: false`; `cv-parse` returns
`llmInvoked: true`, model usage, and embedding dimensions after successful
provider calls.

Run the CV CLI path directly:

```bash
npm run job:cv-parse --workspace=@shire/agent
```

This command now uses the real CV processor. It requires a valid
`SHIRE_TEXT_API_KEY` or `TOKENROUTER_API_KEY` and fails instead of reporting
fixture usage when the LLM or embedding provider is unavailable.

The live worker test is opt-in:

```powershell
npm run test:live:llm --workspace=@shire/agent
```

Keep `SHIRE_LIVE_LLM_TESTS=false` in normal unit-test runs. A `401` indicates a
missing or invalid provider key; `402` or `429` indicates provider credit or
rate limiting; structured-output failures indicate the selected model could not
produce the candidate schema.

## Durable CV document processing

The long-running service uses BullMQ with external Redis:

```env
REDIS_URL=rediss://user:password@redis.example.com:6379
SHIRE_AGENT_SERVICE_TOKEN=replace-with-a-long-random-secret
SHIRE_JOB_QUEUE_NAME=shire-agent-jobs
SHIRE_JOB_ATTEMPTS=3
SHIRE_JOB_BACKOFF_MS=5000
SHIRE_CV_MAX_FILE_BYTES=5242880
```

Start the HTTP listener and worker:

```powershell
npm run dev --workspace=@shire/agent
```

Do not start a separate worker command. `job:cv-parse` remains a one-shot CLI
command for direct testing, so it exits after printing the result.

Upload a PDF or DOCX CV with Postman:

```http
POST http://localhost:3010/jobs/cv-document
Authorization: Bearer <SHIRE_AGENT_SERVICE_TOKEN>
Content-Type: multipart/form-data
```

Form fields:

- `candidateId`: candidate identifier resolved by the web backend
- `file`: one PDF or DOCX file, maximum 5 MiB

Poll the returned job:

```http
GET http://localhost:3010/jobs/{jobId}?candidateId={candidateId}
Authorization: Bearer <SHIRE_AGENT_SERVICE_TOKEN>
```

Temporary provider failures such as HTTP `429`, `5xx`, timeouts, and connection
errors run at most three times with exponential backoff starting at five
seconds. Invalid documents and permanent validation failures do not retry.

Verify the real external Redis retry path:

```powershell
npm run test:live-queue --workspace=@shire/agent
```

The integration test is skipped when `REDIS_URL` is not configured.

## Matching reconciliation

The recommendation scheduler scans canonical candidate/job pairs every 15
minutes. A pair is eligible only when the candidate profile is confirmed, the
job is active, and the candidate is not the job owner. The current profile,
job, and application state form the deterministic input fingerprint.

Each pair uses a deterministic fingerprint and queue generation. Postgres
enforces one evaluation per candidate/job and one recommendation per
candidate/job/type. BullMQ uses the same pair identity for queue deduplication.
An unchanged completed pair therefore produces no new work on the next scan.
Retryable failures re-enter only after the configured BullMQ backoff cooldown.

Shared Postgres is configured with `SHIRE_AGENT_DATABASE_URL`, falling back to
`DATABASE_URL`. The web workspace owns schema migrations; the agent owns
matching evaluation, recommendation, and agent run writes.

Browsers use the web proxy instead of calling the agent directly:

```http
POST /api/candidates/me/cv
GET /api/candidates/me/cv/jobs/{jobId}
```

The web server derives `candidateId` from verified Privy identity in production
or `me_candidate` in demo mode, then authenticates to the agent with the shared
server-only service token.

Run `npm run job:knowledge-sync --workspace=@shire/agent` to index the approved
repository manifest. Job results expose routing metadata plus normalized model,
provider, token, latency, retry, and escalation fields.

## Product knowledge

The role-aware chat assistant uses curated product documents:

- `.agent/knowledge/product/shire-general.md`
- `.agent/knowledge/product/shire-candidate.md`
- `.agent/knowledge/product/shire-recruiter.md`

Synchronize the vector index after changing these files:

```bash
npm run job:knowledge-sync --workspace=@shire/agent
```

Candidate chat retrieves `general + candidate` chunks. Recruiter chat retrieves
`general + recruiter` chunks. The prompt-injection and out-of-scope guard runs
before retrieval.

When the vector index is available, product retrieval uses the configured
`product-knowledge` embedding provider. If the index is missing, chat falls
back to deterministic role-filtered retrieval from the curated local Markdown
files. If retrieval still fails, chat continues without product chunks and the
agent must not invent unavailable product behavior.

Knowledge sync stores a content-hash manifest next to the vector index. With a
remote manifest URL, the manifest is stored in the `shire_knowledge_manifest`
libSQL table, letting repeated deploys skip unchanged documents and delete
vectors for documents removed from the approved source registry. `/health` and
`/ready` expose storage diagnostics by scheme, persistence, and auth presence
only; URLs and tokens are intentionally omitted.

Conversation memory and product knowledge are separate stores. Memory keeps
thread history and optional semantic recall. Knowledge keeps approved document
chunks, vectors, and sync state. Embeddings run for enabled semantic memory,
knowledge sync, and semantic search; deterministic social or resource-only
requests can skip retrieval.

## Verification

Default tests never require live providers:

```bash
npm run test --workspace=@shire/agent
npm run build --workspace=@shire/agent
```

Live model and Redis checks are explicit:

```bash
npm run test:live:llm --workspace=@shire/agent
npm run test:live-queue --workspace=@shire/agent
```

The web currently records platform escrow in Postgres. Those records are
operational state, not proof of Celo settlement. On-chain submission and
reconciliation must complete before the product can claim settled funds.
