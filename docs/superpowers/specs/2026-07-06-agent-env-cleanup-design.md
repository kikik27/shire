# Agent Environment Cleanup Design

## Goal

Make `apps/agent` use one canonical environment variable per setting, remove
inert configuration, and keep the local `.env` limited to deployment-specific
values that change runtime behavior.

## Scope

Change only the agent environment contract and directly related tests and
documentation:

- `apps/agent/.env`
- `apps/agent/.env.example`
- `apps/agent/src/env.ts`
- `apps/agent/src/runtime/models/embeddings.ts`
- agent environment/model tests
- `apps/agent/README.md`

No provider, storage, queue, security, or API behavior will be added.

## Canonical configuration

Each setting has one accepted variable:

- Text credentials use `SHIRE_TEXT_API_KEY`.
- Embedding credentials use `SHIRE_EMBEDDING_API_KEY`.
- The agent database uses `SHIRE_AGENT_DATABASE_URL`.
- The default text model uses `SHIRE_TEXT_MODEL`.
- The default embedding model and endpoint use
  `SHIRE_EMBEDDING_MODEL` and `SHIRE_EMBEDDING_BASE_URL`.

Remove these aliases and direct fallbacks:

- `TOKENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `DATABASE_URL`
- `SHIRE_MODEL_DEFAULT`
- `SHIRE_EMBEDDING_MODEL_DEFAULT`
- `SHIRE_EMBEDDING_BASE_URL_DEFAULT`

Provider-specific names may still appear in output-leak detection because those
patterns protect against disclosing common credential names; they are not
accepted configuration.

## Dead configuration

Remove values parsed by `createEnv()` but never read by production runtime:

- `SHIRE_SECURITY_GUARD_ENABLED`
- `SHIRE_SECURITY_GUARD_MODE`
- `SHIRE_SECURITY_GUARD_MODELS`
- the `liveLlmTestsEnabled` return property

`SHIRE_LIVE_LLM_TESTS` remains a direct opt-in switch owned by the live test,
not part of the production `createEnv()` contract. It will not be listed in the
normal runtime `.env` files.

Keep `SHIRE_SECURITY_GUARD_THRESHOLD`; the LLM guard reads it when deciding
whether a high-risk verdict is confident enough to block.

## Model capability overrides

Keep environment overrides only for capabilities with production model calls:

- `SHIRE_MODEL_PRODUCT_QNA`
- `SHIRE_MODEL_CV_NORMALIZATION`
- `SHIRE_MODEL_JOB_RERANK`
- `SHIRE_MODEL_TALENT_RERANK`
- `SHIRE_MODEL_SECURITY_GUARD`

Remove environment overrides that have no production caller setting their
capability:

- `SHIRE_MODEL_ROLE_AWARE_CHAT`
- `SHIRE_MODEL_KNOWLEDGE_SYNTHESIS`
- `SHIRE_MODEL_RECOMMENDATION_EXPLANATION`
- `SHIRE_MODEL_WORKFLOW_SUMMARY`
- `SHIRE_MODEL_DISPUTE_SUMMARY`

The internal capability types and policies remain available. Capabilities
without a dedicated environment override resolve to `SHIRE_TEXT_MODEL`.

## File behavior

### `.env`

Retain only secrets, remote connection details, and values that differ from
code defaults. Remove explicit default values because omitting them produces
the same runtime behavior. If a manifest URL or token equals its knowledge
storage counterpart, omit it and use the existing derived default.

### `.env.example`

Show the canonical provider credentials and representative deployment
connections. Supported tuning knobs that already have safe code defaults may
be documented as commented options. Do not include aliases or dead settings.

### `env.ts`

Continue to validate active booleans, positive integers, and thresholds.
Remove dead parsers, return properties, aliases, and redundant wrapper
functions. Preserve defaults for active runtime settings.

### Embedding runtime

`createEmbeddingModel()` must use the canonical `env.embeddingApiKey` only.
It must not read provider-specific variables directly from `process.env`.

## Testing

Use test-driven changes:

1. Add assertions that removed aliases no longer configure text, embedding, or
   database settings.
2. Add assertions that dead security properties are absent and active security
   threshold parsing remains valid.
3. Update model routing assertions so non-overridden capabilities use the
   default model chain.
4. Run the focused environment and model tests.
5. Run the complete agent test suite, typecheck, build, and a static audit that
   every active `.env` key is read by production or the explicitly documented
   live-test path.

## Compatibility

This is an intentional breaking configuration change. Deployments using legacy
aliases must migrate to the canonical `SHIRE_*` variables before upgrading.
Missing active variables continue to use the existing safe defaults.
