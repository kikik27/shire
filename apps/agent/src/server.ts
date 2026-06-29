import { env } from "./env";
import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import express from "express";
import { logger } from "./runtime/logger";
import { jobRegistry, resolveJobName } from "./runtime/server/job-registry";
import { getStorageDiagnostics, probeStorageReadiness } from "./runtime/storage/diagnostics";
import { createRuntimeJobServices } from "./runtime/server/job-services";
import { AgentWorker } from "./runtime/jobs/agent-worker";
import { createInMemoryRateLimiter } from "./runtime/auth/rate-limit";
import { RUNTIME_HTTP_ROUTES } from "./constants/agent";
import type { RuntimeHttpServerDependencies } from "./types/runtime";

import {
  mountChatAuth,
  mountChatLogging,
  mountChatGuard,
} from "./routes/chat.middleware";
import { mountJobsRoutes } from "./routes/jobs.route";
import { mountProductQnaRoute } from "./routes/product-qna.route";
import { mountHealthRoutes, type ReadinessResult } from "./routes/health.route";

const runtimeLogger = logger.child({ component: "runtime" });

export function getRuntimeBootstrapOutput() {
  return {
    status: "runtime-ready",
    nodeEnv: env.nodeEnv,
    port: env.port,
    jobs: Object.keys(jobRegistry),
    storage: getStorageDiagnostics(),
  } as const;
}

/**
 * Probes runtime dependencies for the /ready route. Local file: stores are
 * always ready; remote libSQL stores are pinged with SELECT 1.
 *
 * Redis is intentionally not probed here: it is optional (the runtime falls
 * back to an in-memory queue when REDIS_URL is unset, and BullMQ owns its own
 * connection with its own retry/backoff). Failing /ready on a Redis hiccup
 * would needlessly flip the service down even though it can still serve chat
 * and jobs. The durable job runtime reports its own health in logs.
 */
async function checkRuntimeReadiness(): Promise<ReadinessResult> {
  return probeStorageReadiness();
}

export async function createRuntimeHttpServer(
  dependencies: RuntimeHttpServerDependencies = {},
): Promise<Server> {
  const app = express();
  app.use(express.json());

  const jobServices = createRuntimeJobServices({
    jobQueue: dependencies.jobQueue,
    durableJobRuntime: dependencies.durableJobRuntime,
    processJob: dependencies.processJob,
  });
  await jobServices.start();
  const injectedWorker =
    !env.workerEnabled &&
    dependencies.jobQueue &&
    dependencies.processJob &&
    !dependencies.durableJobRuntime
      ? new AgentWorker({
          queue: dependencies.jobQueue,
          process: dependencies.processJob,
        })
      : undefined;
  injectedWorker?.start();

  // --- Shared dependencies ---
  const serviceToken = dependencies.serviceToken ?? env.agentServiceToken;
  const rateLimiter = dependencies.rateLimiter ?? createInMemoryRateLimiter();
  const bootstrap = getRuntimeBootstrapOutput();

  // --- Non-Mastra routes ---
  mountJobsRoutes(app, {
    serviceToken,
    jobQueue: jobServices.jobQueue,
    durableJobRuntime: jobServices.durableJobRuntime,
    extractCvDocument: dependencies.extractCvDocument,
  });

  mountProductQnaRoute(app, {
    serviceToken,
    rateLimiter,
    now: dependencies.now,
    answerProductQuestion: dependencies.answerProductQuestion,
    timeoutMs: dependencies.productQnaTimeoutMs,
  });

  mountHealthRoutes(app, {
    bootstrap,
    checkReady: dependencies.checkReady ?? checkRuntimeReadiness,
  });

  // --- Chat middleware chain (order matters: auth -> logging -> guard) ---
  mountChatAuth(app, serviceToken);
  mountChatLogging(app);
  mountChatGuard(app, {
    serviceToken,
    rateLimiter,
    now: dependencies.now,
    securityIndicatorClassifier: dependencies.securityIndicatorClassifier,
    securityGuard: dependencies.securityGuard,
    confirmSecurityRisk: dependencies.confirmSecurityRisk,
    searchProductKnowledge: dependencies.searchProductKnowledge,
  });

  // --- Agent runtime owns /chat/:agentId, /api/* ---
  if (dependencies.mountAgentChat) {
    await dependencies.mountAgentChat(app);
  } else {
    const [{ MastraServer }, { mastra }] = await Promise.all([
      import("@mastra/express"),
      import("./mastra"),
    ]);
    const server = new MastraServer({ app, mastra });
    await server.init();
  }

  runtimeLogger.info(
    {
      routes: RUNTIME_HTTP_ROUTES,
    },
    "runtime http routes ready",
  );
  runtimeLogger.info(
    {
      textProvider: env.textModelProvider,
      textBaseUrl: env.textModelBaseUrl,
      defaultTextModel: env.chatModelChains.default[0],
      textApiKeyConfigured: Boolean(env.textModelApiKey),
      embeddingProvider: env.embeddingProvider,
      embeddingEnabled: env.embeddingEnabled,
      memoryUrlScheme: bootstrap.storage.memory.scheme,
      knowledgeUrlScheme: bootstrap.storage.knowledge.scheme,
    },
    "runtime model configuration loaded",
  );
  if (!env.textModelApiKey) {
    runtimeLogger.warn(
      {
        textProvider: env.textModelProvider,
        textBaseUrl: env.textModelBaseUrl,
      },
      "text model API key is not configured; chat model calls will fail",
    );
  }

  app.use((request, response) => {
    response.status(404).json({
      status: "not-found",
      path: request.url ?? "/",
    });
  });

  const httpServer = createServer(app);
  httpServer.on("close", () => {
    void injectedWorker?.close();
    jobServices.close();
  });
  return httpServer;
}

export async function runServer(argv: readonly string[] = process.argv.slice(2)) {
  const { mastra } = await import("./mastra");
  const jobName = resolveJobName(argv[0]);

  runtimeLogger.info(
    {
      argv,
      jobName,
      nodeEnv: env.nodeEnv,
      port: env.port,
      autonomyMode: env.autonomyMode,
    },
    "agent runtime received input",
  );

  if (jobName) {
    runtimeLogger.info({ jobName }, "dispatching job");

    try {
      const result = await jobRegistry[jobName]();

      if ("agent" in result && "workflow" in result) {
        runtimeLogger.info(
          {
            jobName,
            agent: result.agent,
            workflow: result.workflow,
          },
          "job completed",
        );
      } else if ("status" in result && "chain" in result) {
        runtimeLogger.info(
          {
            jobName,
            status: result.status,
            chain: result.chain,
          },
          "job completed",
        );
      } else {
        runtimeLogger.info(
          {
            jobName,
            indexedDocuments: result.indexedDocuments,
            indexedChunks: result.indexedChunks,
            indexName: result.indexName,
          },
          "job completed",
        );
      }

      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      runtimeLogger.error({ err: error, jobName }, "job failed");
      throw error;
    }
  }

  void mastra;

  const bootstrapOutput = getRuntimeBootstrapOutput();
  runtimeLogger.info(
    {
      jobs: bootstrapOutput.jobs,
      nodeEnv: bootstrapOutput.nodeEnv,
      port: bootstrapOutput.port,
    },
    "Shire agent runtime ready",
  );
  console.log(JSON.stringify(bootstrapOutput, null, 2));
  return bootstrapOutput;
}

export async function startRuntimeService() {
  if (!env.redisUrl) {
    runtimeLogger.warn(
      "REDIS_URL is not set. Falling back to in-memory job queue. Jobs will not persist across restarts.",
    );
  }
  if (!env.agentServiceToken) {
    throw new Error(
      "SHIRE_AGENT_SERVICE_TOKEN is required to start the agent service.",
    );
  }

  const bootstrapOutput = getRuntimeBootstrapOutput();
  const server = await createRuntimeHttpServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(env.port, () => resolve());
  });

  runtimeLogger.info(
    {
      jobs: bootstrapOutput.jobs,
      nodeEnv: bootstrapOutput.nodeEnv,
      port: bootstrapOutput.port,
      healthcheck: `http://localhost:${env.port}/health`,
    },
    "Shire agent service listening",
  );

  return server;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const argv = process.argv.slice(2);

  if (resolveJobName(argv[0])) {
    runServer(argv).catch((error) => {
      runtimeLogger.error({ err: error }, "agent runtime crashed");
      process.exitCode = 1;
    });
  } else {
    startRuntimeService().catch((error) => {
      runtimeLogger.error({ err: error }, "agent runtime crashed");
      process.exitCode = 1;
    });
  }
}
