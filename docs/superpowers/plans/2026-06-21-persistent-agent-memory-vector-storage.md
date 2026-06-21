# Persistent Agent Memory Vector Storage Follow-Up Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move agent memory and vector retrieval storage from deployment-local files to production-safe, externally persisted storage.

**Architecture:** Keep the current Mastra `LibSQLStore` and `LibSQLVector` path for compatibility, but add env support for remote libSQL/Turso URLs and auth tokens. Memory, knowledge vectors, and knowledge sync manifests remain separate concerns so user memory can persist independently from rebuildable product/repository knowledge.

**Tech Stack:** TypeScript, Mastra Memory, `@mastra/libsql`, remote libSQL/Turso, Node test runner.

---

## Scope

This is a follow-up after capability model routing. Do not mix this work into
the model-routing branch unless explicitly requested.

In scope:

- remote libSQL/Turso auth token env support.
- separate memory and knowledge storage configuration.
- persistent knowledge sync manifest storage or a manifest table.
- runtime diagnostics for memory/vector storage mode.
- docs for local file storage versus production remote storage.

Out of scope for the first pass:

- replacing Mastra `LibSQLStore` with Postgres.
- migrating all vectors to pgvector.
- building a memory inspection UI.

## Proposed Env Contract

```env
SHIRE_AGENT_MEMORY_URL=libsql://shire-agent-memory.turso.io
SHIRE_AGENT_MEMORY_AUTH_TOKEN=...

SHIRE_AGENT_KNOWLEDGE_URL=libsql://shire-agent-knowledge.turso.io
SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN=...
SHIRE_AGENT_KNOWLEDGE_INDEX=shire_context

SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL=libsql://shire-agent-knowledge.turso.io
SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN=...
```

Local development can keep:

```env
SHIRE_AGENT_MEMORY_URL=file:./.data/shire-agent-memory.db
SHIRE_AGENT_KNOWLEDGE_URL=file:./.data/shire-agent-knowledge.db
```

## Task 1: Parse Persistent Storage Env

**Files:**
- Modify: `apps/agent/src/env.ts`
- Modify: `apps/agent/test/env.test.ts`
- Modify: `apps/agent/.env.example`

- [x] Add env parsing for `SHIRE_AGENT_MEMORY_AUTH_TOKEN`,
  `SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN`,
  `SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL`, and
  `SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN`.
- [x] Default manifest URL to `SHIRE_AGENT_KNOWLEDGE_URL`.
- [x] Keep local `file:` defaults for development.
- [x] Test that remote URLs preserve auth tokens and local file URLs work
  without auth tokens.

## Task 2: Pass Auth Tokens To LibSQL Store And Vector

**Files:**
- Modify: `apps/agent/src/runtime/memory.ts`
- Modify: `apps/agent/src/runtime/knowledge.ts`
- Test: `apps/agent/test/memory.test.ts`
- Test: `apps/agent/test/knowledge.test.ts`

- [x] Add small factory helpers for `LibSQLStore` and `LibSQLVector`
  configuration.
- [x] Pass auth tokens only when present.
- [x] Keep local directory creation only for `file:` URLs.
- [x] Test local config and remote config without opening real network
  connections.

## Task 3: Persist Knowledge Sync Manifest Remotely

**Files:**
- Modify: `apps/agent/src/runtime/knowledge.ts`
- Test: `apps/agent/test/knowledge.test.ts`

- [x] Replace local sidecar manifest-only behavior with a manifest adapter.
- [x] For local `file:` URLs, current JSON sidecar may remain as a dev fallback.
- [x] For remote libSQL, store source path and content hash in a table.
- [x] Ensure changed docs re-index, unchanged docs skip, and removed docs delete
  vectors.

## Task 4: Add Storage Diagnostics

**Files:**
- Modify: `apps/agent/src/server.ts`
- Modify: `apps/agent/test/runtime.test.ts`
- Modify: `apps/agent/README.md`

- [x] Expose storage mode in `/health` and `/ready` without revealing tokens.
- [x] Report whether memory and knowledge URLs are `file`, `libsql`, or another
  supported scheme.
- [x] Document production guidance: remote storage required for deployed
  environments with ephemeral filesystems.

## Task 5: Verification

- [x] Run `npm.cmd run test --workspace=@shire/agent`.
- [x] Run `npm.cmd run typecheck --workspace=@shire/agent`.
- [x] Run `npm.cmd run build --workspace=@shire/agent`.
- [x] Confirm no auth token value is logged or returned by HTTP endpoints.
