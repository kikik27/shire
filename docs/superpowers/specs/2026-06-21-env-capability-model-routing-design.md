# Env Capability Model Routing Design

## Goal

Make Shire agent model selection explicit, env-driven, and easy to change per
agent capability. Remove the current `cheap`, `balanced`, and `heavy` tier
concept because runtime owners should map each capability directly to the model
chain they want.

## Current State

Text generation currently resolves a workload to a tier, then resolves that
tier to `SHIRE_MODEL_CHEAP`, `SHIRE_MODEL_BALANCED`, or
`SHIRE_MODEL_HEAVY`. Embeddings use one global `SHIRE_EMBEDDING_MODEL` and
`SHIRE_EMBEDDING_BASE_URL`.

Product knowledge already supports vector retrieval:

- `knowledge-sync` chunks curated Markdown knowledge.
- each chunk is embedded and stored in the LibSQL vector index.
- runtime queries embed the user question and perform semantic search.
- product retrieval falls back to deterministic local keyword search when the
  vector index is unavailable.

The missing piece is provider/model routing by capability. Memory embeddings,
product knowledge embeddings, repository knowledge embeddings, and each text
agent should be independently configurable.

## Configuration Model

Use direct env variables per capability:

```env
SHIRE_MODEL_DEFAULT=openrouter/nex-agi/nex-n2-pro:free,openrouter/openai/gpt-oss-20b:free
SHIRE_MODEL_PRODUCT_QNA=openrouter/nex-agi/nex-n2-pro:free
SHIRE_MODEL_ROLE_AWARE_CHAT=openrouter/nex-agi/nex-n2-pro:free
SHIRE_MODEL_CV_NORMALIZATION=openrouter/openai/gpt-oss-20b:free
SHIRE_MODEL_JOB_RERANK=openrouter/nex-agi/nex-n2-pro:free
SHIRE_MODEL_TALENT_RERANK=openrouter/nex-agi/nex-n2-pro:free
SHIRE_MODEL_RECOMMENDATION_EXPLANATION=openrouter/nex-agi/nex-n2-pro:free
SHIRE_MODEL_WORKFLOW_SUMMARY=openrouter/nex-agi/nex-n2-pro:free
SHIRE_MODEL_DISPUTE_SUMMARY=openrouter/openai/gpt-oss-20b:free
SHIRE_MODEL_SECURITY_GUARD=openrouter/nex-agi/nex-n2-pro:free

SHIRE_EMBEDDING_MODEL_DEFAULT=qwen/qwen3-embedding-8b
SHIRE_EMBEDDING_MODEL_MEMORY=qwen/qwen3-embedding-8b
SHIRE_EMBEDDING_MODEL_PRODUCT_KNOWLEDGE=qwen/qwen3-embedding-8b
SHIRE_EMBEDDING_MODEL_REPOSITORY_KNOWLEDGE=qwen/qwen3-embedding-8b

SHIRE_EMBEDDING_BASE_URL_DEFAULT=https://openrouter.ai/api/v1
SHIRE_EMBEDDING_BASE_URL_MEMORY=https://openrouter.ai/api/v1
SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE=https://openrouter.ai/api/v1
SHIRE_EMBEDDING_BASE_URL_REPOSITORY_KNOWLEDGE=https://openrouter.ai/api/v1
```

Rules:

- every chat capability resolves to its own env chain first.
- missing capability env falls back to `SHIRE_MODEL_DEFAULT`.
- embedding capabilities resolve model and base URL separately.
- missing embedding env falls back to the corresponding default env.
- old tier env names are removed from code and documentation.

## Runtime API

Replace tier-based helpers with capability-based helpers:

```ts
type ChatModelCapability =
  | "product-qna"
  | "role-aware-chat"
  | "cv-normalization"
  | "job-rerank"
  | "talent-rerank"
  | "recommendation-explanation"
  | "workflow-summary"
  | "dispute-summary"
  | "security-guard";

type EmbeddingCapability =
  | "memory"
  | "product-knowledge"
  | "repository-knowledge";
```

The model router exposes:

- `resolveModelChain({ capability })`
- `resolveRuntimeAgentModelId({ capability })`
- `dynamicAgentModel({ requestContext })`

`dynamicAgentModel` reads `requestContext.get("model-capability")`.
Workload names may remain where they represent task semantics, but they no
longer map to tiers.

The embedding module exposes:

- `createEmbeddingModelFor(capability)`
- `embedTextFor(capability, value)`
- `embedTextsFor(capability, values)`

Existing `embedText` and `embedTexts` can remain as wrappers for
`repository-knowledge` or be removed if all call sites are migrated in one
change.

## Product Knowledge Flow

Product Q&A should use one embedding capability consistently:

- indexing product docs: `product-knowledge`
- embedding product user queries: `product-knowledge`
- answering product Q&A: `product-qna`

This avoids vector-space mismatch. If product documents are embedded with one
model and queries are embedded with another incompatible model, semantic search
quality can degrade or fail.

Repository RAG should use `repository-knowledge`. Agent memory semantic recall
should use `memory`.

## Error Handling

Startup env parsing should fail fast when:

- a required default model chain is empty.
- an embedding capability resolves to an empty model ID.
- a base URL cannot be normalized.

Runtime retrieval should keep the existing safe fallback behavior:

- if product vector retrieval is unavailable, use local role-filtered keyword
  search.
- if retrieval fails completely, continue without retrieved context and require
  the agent to say unavailable rather than invent product behavior.

## Testing

Add focused tests for:

- env parsing of capability model chains.
- fallback from missing capability env to `SHIRE_MODEL_DEFAULT`.
- removal of `cheap`, `balanced`, and `heavy` tier routing.
- product knowledge indexing uses `product-knowledge` embedding.
- product knowledge query uses `product-knowledge` embedding.
- memory config uses `memory` embedding.
- product Q&A generation sets `model-capability` to `product-qna`.

## Migration Notes

Deployments must replace:

- `SHIRE_MODEL_CHEAP`
- `SHIRE_MODEL_BALANCED`
- `SHIRE_MODEL_HEAVY`
- `SHIRE_EMBEDDING_MODEL`
- `SHIRE_EMBEDDING_BASE_URL`

with capability env values. During implementation, documentation and
`.env.example` should be updated in the same change so runtime operators have a
single source of truth.
