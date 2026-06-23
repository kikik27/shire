import { parseAutonomyMode } from "./runtime/server/autonomy";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const agentRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const localEnvPath = resolve(agentRoot, ".env");

function loadLocalEnvFallback() {
  if (!existsSync(localEnvPath)) {
    return;
  }

  const content = readFileSync(localEnvPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (process.env[key] !== undefined) {
      continue;
    }

    const rawValue = line.slice(separatorIndex + 1).trim();
    process.env[key] = rawValue
      .replace(/^['"]/, "")
      .replace(/['"]$/, "");
  }
}

loadLocalEnvFallback();

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === undefined || normalized === "") {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Unsupported boolean flag: ${value}`);
}

function parseModelChain(value: string | undefined, defaults: readonly string[]) {
  const models = value
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return models?.length ? models : [...defaults];
}

function parseRequiredModelChain(
  value: string | undefined,
  defaults: readonly string[],
) {
  return parseModelChain(value, defaults);
}

function parseUnitInterval(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Expected a unit interval between 0 and 1, received: ${value}`);
  }

  return parsed;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }

  return parsed;
}

function parseSecurityGuardMode(value: string | undefined) {
  const normalized = value?.trim();

  if (normalized === undefined || normalized === "") {
    return "suspicious-only" as const;
  }

  if (normalized === "suspicious-only") {
    return normalized;
  }

  throw new Error(`Unsupported security guard mode: ${value}`);
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function createEnv(input: NodeJS.ProcessEnv = process.env) {
  const nodeEnv = input.NODE_ENV ?? "development";
  const agentMemoryUrl =
    input.SHIRE_AGENT_MEMORY_URL?.trim() || "file:./.data/shire-agent-memory.db";
  const agentKnowledgeUrl =
    input.SHIRE_AGENT_KNOWLEDGE_URL?.trim() ||
    "file:./.data/shire-agent-knowledge.db";
  const agentKnowledgeAuthToken =
    input.SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN?.trim() || undefined;
  const defaultChatModels = parseRequiredModelChain(
    input.SHIRE_TEXT_MODEL ?? input.SHIRE_MODEL_DEFAULT,
    ["MiniMax-M3"],
  );
  const textBaseUrl =
    input.SHIRE_TEXT_BASE_URL?.trim() || "https://api.tokenrouter.com/v1";
  const defaultEmbeddingModel =
    input.SHIRE_EMBEDDING_MODEL?.trim() ||
    input.SHIRE_EMBEDDING_MODEL_DEFAULT?.trim() ||
    "text-embedding-3-small";
  const defaultEmbeddingBaseUrl = normalizeBaseUrl(
    input.SHIRE_EMBEDDING_BASE_URL?.trim() ||
      input.SHIRE_EMBEDDING_BASE_URL_DEFAULT?.trim() ||
      "https://api.openai.com/v1",
  );

  return {
    nodeEnv,
    port: Number(input.PORT ?? 3010),
    redisUrl: input.REDIS_URL?.trim() || undefined,
    // The agent reads candidate/job profiles and writes recommendations to the
    // same Postgres the web app owns. Defaulting to DATABASE_URL keeps a single
    // config knob in standard deployments; SHIRE_AGENT_DATABASE_URL lets the
    // agent use a separate connection/pooler when needed.
    agentDatabaseUrl:
      input.SHIRE_AGENT_DATABASE_URL?.trim() ||
      input.DATABASE_URL?.trim() ||
      undefined,
    agentServiceToken: input.SHIRE_AGENT_SERVICE_TOKEN?.trim() || undefined,
    jobQueueName: input.SHIRE_JOB_QUEUE_NAME?.trim() || "shire-agent-jobs",
    jobAttempts: parsePositiveInteger(input.SHIRE_JOB_ATTEMPTS, 3),
    jobBackoffMs: parsePositiveInteger(input.SHIRE_JOB_BACKOFF_MS, 5_000),
    cvMaxFileBytes: parsePositiveInteger(
      input.SHIRE_CV_MAX_FILE_BYTES,
      5 * 1024 * 1024,
    ),
    autonomyMode: parseAutonomyMode(input.SHIRE_AUTONOMY_MODE),
    logLevel: input.SHIRE_LOG_LEVEL?.trim() || (nodeEnv === "development" ? "debug" : "info"),
    prettyLogs: parseBoolean(input.SHIRE_PRETTY_LOGS, nodeEnv !== "production"),
    textModelProvider:
      input.SHIRE_TEXT_PROVIDER?.trim() || "tokenrouter",
    textModelBaseUrl: normalizeBaseUrl(textBaseUrl),
    textModelApiKey:
      input.SHIRE_TEXT_API_KEY?.trim() ||
      input.TOKENROUTER_API_KEY?.trim() ||
      input.OPENAI_API_KEY?.trim() ||
      undefined,
    chatModelChains: {
      default: defaultChatModels,
      productQna: parseModelChain(input.SHIRE_MODEL_PRODUCT_QNA, defaultChatModels),
      roleAwareChat: parseModelChain(
        input.SHIRE_MODEL_ROLE_AWARE_CHAT,
        defaultChatModels,
      ),
      cvNormalization: parseModelChain(
        input.SHIRE_MODEL_CV_NORMALIZATION,
        defaultChatModels,
      ),
      knowledgeSynthesis: parseModelChain(
        input.SHIRE_MODEL_KNOWLEDGE_SYNTHESIS,
        defaultChatModels,
      ),
      jobRerank: parseModelChain(input.SHIRE_MODEL_JOB_RERANK, defaultChatModels),
      talentRerank: parseModelChain(
        input.SHIRE_MODEL_TALENT_RERANK,
        defaultChatModels,
      ),
      recommendationExplanation: parseModelChain(
        input.SHIRE_MODEL_RECOMMENDATION_EXPLANATION,
        defaultChatModels,
      ),
      workflowSummary: parseModelChain(
        input.SHIRE_MODEL_WORKFLOW_SUMMARY,
        defaultChatModels,
      ),
      disputeSummary: parseModelChain(
        input.SHIRE_MODEL_DISPUTE_SUMMARY,
        defaultChatModels,
      ),
      securityGuard: parseModelChain(
        input.SHIRE_MODEL_SECURITY_GUARD,
        defaultChatModels,
      ),
    },
    embeddingModels: {
      default: defaultEmbeddingModel,
      memory:
        input.SHIRE_EMBEDDING_MODEL_MEMORY?.trim() || defaultEmbeddingModel,
      productKnowledge:
        input.SHIRE_EMBEDDING_MODEL_PRODUCT_KNOWLEDGE?.trim() ||
        defaultEmbeddingModel,
      repositoryKnowledge:
        input.SHIRE_EMBEDDING_MODEL_REPOSITORY_KNOWLEDGE?.trim() ||
        defaultEmbeddingModel,
    },
    embeddingBaseUrls: {
      default: defaultEmbeddingBaseUrl,
      memory: normalizeBaseUrl(
        input.SHIRE_EMBEDDING_BASE_URL_MEMORY?.trim() ||
          defaultEmbeddingBaseUrl,
      ),
      productKnowledge: normalizeBaseUrl(
        input.SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE?.trim() ||
          defaultEmbeddingBaseUrl,
      ),
      repositoryKnowledge: normalizeBaseUrl(
        input.SHIRE_EMBEDDING_BASE_URL_REPOSITORY_KNOWLEDGE?.trim() ||
          defaultEmbeddingBaseUrl,
      ),
    },
    embeddingProvider:
      input.SHIRE_EMBEDDING_PROVIDER?.trim() || "openai",
    embeddingApiKey:
      input.SHIRE_EMBEDDING_API_KEY?.trim() ||
      input.OPENAI_API_KEY?.trim() ||
      input.OPENROUTER_API_KEY?.trim() ||
      undefined,
    embeddingEnabled: parseBoolean(
      input.SHIRE_EMBEDDING_ENABLED,
      Boolean(
        input.SHIRE_EMBEDDING_API_KEY?.trim() ||
          input.OPENAI_API_KEY?.trim() ||
          input.OPENROUTER_API_KEY?.trim(),
      ),
    ),
    workingMemoryEnabled: parseBoolean(
      input.SHIRE_WORKING_MEMORY_ENABLED,
      false,
    ),
    workerEnabled: parseBoolean(input.SHIRE_WORKER_ENABLED, true),
    recommendationSchedulerEnabled: parseBoolean(
      input.SHIRE_RECOMMENDATION_SCHEDULER_ENABLED,
      true,
    ),
    recommendationSchedulerIntervalMs: parsePositiveInteger(
      input.SHIRE_RECOMMENDATION_SCHEDULER_INTERVAL_MS,
      15 * 60 * 1000,
    ),
    liveLlmTestsEnabled: parseBoolean(
      input.SHIRE_LIVE_LLM_TESTS,
      false,
    ),
    chatMaxBodyBytes: parsePositiveInteger(input.SHIRE_CHAT_MAX_BODY_BYTES, 65_536),
    chatMaxMessages: parsePositiveInteger(input.SHIRE_CHAT_MAX_MESSAGES, 50),
    chatMaxMessageCharacters: parsePositiveInteger(
      input.SHIRE_CHAT_MAX_MESSAGE_CHARACTERS,
      8_000,
    ),
    chatRateLimitRequests: parsePositiveInteger(
      input.SHIRE_CHAT_RATE_LIMIT_REQUESTS,
      30,
    ),
    chatRateLimitWindowSeconds: parsePositiveInteger(
      input.SHIRE_CHAT_RATE_LIMIT_WINDOW_SECONDS,
      60,
    ),
    securityGuardEnabled: parseBoolean(input.SHIRE_SECURITY_GUARD_ENABLED, true),
    securityGuardMode: parseSecurityGuardMode(input.SHIRE_SECURITY_GUARD_MODE),
    securityGuardModels: parseModelChain(
      input.SHIRE_SECURITY_GUARD_MODELS,
      defaultChatModels,
    ),
    securityGuardThreshold: parseUnitInterval(
      input.SHIRE_SECURITY_GUARD_THRESHOLD,
      0.85,
    ),
    outputMaxCharacters: parsePositiveInteger(
      input.SHIRE_OUTPUT_MAX_CHARACTERS,
      12_000,
    ),
    agentMemoryUrl,
    agentMemoryAuthToken:
      input.SHIRE_AGENT_MEMORY_AUTH_TOKEN?.trim() || undefined,
    agentKnowledgeUrl,
    agentKnowledgeAuthToken,
    agentKnowledgeManifestUrl:
      input.SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL?.trim() || agentKnowledgeUrl,
    agentKnowledgeManifestAuthToken:
      input.SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN?.trim() ||
      agentKnowledgeAuthToken,
    agentKnowledgeIndex:
      input.SHIRE_AGENT_KNOWLEDGE_INDEX?.trim() || "shire_context",
    ragTopK: parsePositiveInteger(input.SHIRE_RAG_TOP_K, 5),
    ragMaxCharacters: parsePositiveInteger(
      input.SHIRE_RAG_MAX_CHARACTERS,
      8_000,
    ),
  } as const;
}

export const env = createEnv();
