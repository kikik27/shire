import type { ChatModelCapability } from "./model-policy";
import { resolveModelChain } from "./model-router";

export const jobCapabilities = {
  "cv-parse": "cv-normalization",
  "job-matching": "job-rerank",
  "talent-matching": "talent-rerank",
  "dispute-summary": "dispute-summary",
} as const satisfies Record<string, ChatModelCapability>;

export type RoutedJobName = keyof typeof jobCapabilities;

export function createJobRouting(
  job: RoutedJobName,
  escalationReason?: string,
) {
  const capability = jobCapabilities[job];
  const routing = {
    capability,
    attemptedModels: resolveModelChain({ capability }).map(
      (entry) => entry.model,
    ),
    ...(escalationReason ? { escalationReason } : {}),
  };

  return routing;
}
