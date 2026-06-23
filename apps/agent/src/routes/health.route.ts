import type { Express } from "express";

import type { getRuntimeBootstrapOutput } from "../server";

export type RuntimeBootstrap = ReturnType<typeof getRuntimeBootstrapOutput>;

/**
 * A readiness probe result. When `ready` is false, `reason` describes which
 * dependency failed its reachability check.
 */
export type ReadinessResult =
  | { ready: true }
  | { ready: false; reason: string };

/**
 * Default readiness check: returns ready. The real dependency probes are wired
 * in `server.ts` (Redis/libSQL reachability) and injected at mount time so unit
 * tests can stub them.
 */
export function mountHealthRoutes(
  app: Express,
  options: {
    bootstrap: RuntimeBootstrap;
    checkReady?: () => Promise<ReadinessResult>;
  },
) {
  const checkReady = options.checkReady ?? (async () => ({ ready: true }) as const);

  // /health: process-alive probe. Always 200.
  app.get("/health", (_request, response) => {
    response.json(options.bootstrap);
  });

  // /ready: dependency-readiness probe. 200 when dependencies are reachable,
  // 503 when a required dependency fails its probe.
  app.get("/ready", async (_request, response) => {
    const result = await checkReady();
    if (result.ready) {
      response.json(options.bootstrap);
      return;
    }
    response
      .status(503)
      .json({ ...options.bootstrap, status: "not-ready", reason: result.reason });
  });
}
