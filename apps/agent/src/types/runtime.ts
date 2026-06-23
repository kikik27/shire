import type { CvDocumentFile } from "../runtime/cv/document";
import type { JobQueue } from "../runtime/jobs/job-queue";
import type { DurableJobRuntime } from "../runtime/jobs/bullmq-job-queue";
import type { RateLimiter } from "../runtime/auth/rate-limit";
import type { answerProductQuestion } from "../runtime/knowledge/product-qna";
import type { guardSecurityPrompt } from "../runtime/security/guard";
import type { confirmSecurityRiskWithLlm } from "../runtime/security/guard-llm";
import type { classifySecurityIndicator } from "../runtime/security/indicators";
import type { searchProductKnowledge } from "../runtime/knowledge";
import type { ReadinessResult } from "../routes/health.route";
import type { ProcessJob } from "./jobs";

export type RuntimeHttpServerDependencies = {
  searchProductKnowledge?: typeof searchProductKnowledge;
  rateLimiter?: RateLimiter;
  now?: () => number;
  securityIndicatorClassifier?: typeof classifySecurityIndicator;
  securityGuard?: typeof guardSecurityPrompt;
  confirmSecurityRisk?: typeof confirmSecurityRiskWithLlm;
  jobQueue?: JobQueue;
  processJob?: ProcessJob;
  durableJobRuntime?: DurableJobRuntime;
  serviceToken?: string;
  extractCvDocument?: (file: CvDocumentFile | undefined) => Promise<string>;
  answerProductQuestion?: typeof answerProductQuestion;
  productQnaTimeoutMs?: number;
  checkReady?: () => Promise<ReadinessResult>;
};
