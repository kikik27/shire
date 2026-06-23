import type { Express } from "express";
import multer, { MulterError } from "multer";

import { env } from "../env";
import { logger } from "../runtime/logger";
import { parseJobRequest } from "../runtime/jobs/job-contracts";
import type {
  JobResult,
  ProcessableJob,
} from "../runtime/jobs/job-contracts";
import type { DurableJobRuntime } from "../runtime/jobs/bullmq-job-queue";
import type { JobQueue } from "../runtime/jobs/job-queue";
import {
  createDefaultCvDocumentDependencies,
  CvDocumentError,
  extractCvDocument,
  type CvDocumentFile,
} from "../runtime/cv-document";
import { hasValidServiceToken } from "../runtime/internal-auth";

const jobsLogger = logger.child({ component: "jobs-route" });

export interface JobsRouteDependencies {
  serviceToken?: string;
  jobQueue?: JobQueue;
  durableJobRuntime?: DurableJobRuntime;
  extractCvDocument?: (file: CvDocumentFile | undefined) => Promise<string>;
}

/**
 * Mounts the job submission and status routes:
 *   POST /jobs: enqueue a typed job
 *   GET  /jobs/:jobId: poll job status (candidateId-scoped when provided)
 *   POST /jobs/cv-document: upload a CV file and enqueue cv-parse
 */
export function mountJobsRoutes(
  app: Express,
  dependencies: JobsRouteDependencies,
) {
  const isAuthorized = (request: { header: (name: string) => string | undefined }) =>
    hasValidServiceToken(request.header("authorization"), dependencies.serviceToken);

  const cvDocumentExtractor =
    dependencies.extractCvDocument ??
    ((file: CvDocumentFile | undefined) =>
      extractCvDocument(
        file,
        createDefaultCvDocumentDependencies(env.cvMaxFileBytes),
      ));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.cvMaxFileBytes, files: 1, fields: 1 },
  });

  app.post("/jobs/cv-document", (request, response) => {
    if (!isAuthorized(request)) {
      response.status(401).json({ status: "unauthorized" });
      return;
    }

    upload.single("file")(request, response, async (uploadError) => {
      try {
        if (uploadError) {
          if (
            uploadError instanceof MulterError &&
            uploadError.code === "LIMIT_FILE_SIZE"
          ) {
            throw new CvDocumentError(
              "CV_FILE_TOO_LARGE",
              "The CV file exceeds the configured size limit.",
            );
          }
          throw uploadError;
        }

        const candidateId =
          typeof request.body?.candidateId === "string"
            ? request.body.candidateId.trim()
            : "";
        if (!candidateId) {
          response.status(400).json({
            code: "CV_CANDIDATE_REQUIRED",
            message: "A candidateId is required.",
          });
          return;
        }

        const rawCv = await cvDocumentExtractor(request.file);
        const jobRequest = parseJobRequest({
          name: "cv-parse",
          payload: { candidateId, rawCv },
        });
        const job = dependencies.durableJobRuntime
          ? await dependencies.durableJobRuntime.enqueue(jobRequest)
          : await dependencies.jobQueue!.enqueue(jobRequest);
        response.status(202).json({ jobId: job.id, status: job.status });
      } catch (error) {
        if (error instanceof CvDocumentError) {
          response.status(400).json({
            code: error.code,
            message: error.message,
          });
          return;
        }
        jobsLogger.error({ err: error }, "CV document upload failed");
        response.status(503).json({ status: "queue-unavailable" });
      }
    });
  });

  app.post("/jobs", async (request, response) => {
    try {
      const parsed = parseJobRequest(request.body);
      const job = dependencies.durableJobRuntime
        ? await dependencies.durableJobRuntime.enqueue(parsed)
        : await dependencies.jobQueue!.enqueue(parsed);
      jobsLogger.info(
        { jobId: job.id, jobName: job.name },
        "job queued",
      );
      response.status(202).json({ jobId: job.id, status: job.status });
    } catch {
      response.status(400).json({
        status: "invalid-job-request",
        message: "Job name or payload is invalid.",
      });
    }
  });

  app.get("/jobs/:jobId", async (request, response) => {
    const candidateId =
      typeof request.query.candidateId === "string"
        ? request.query.candidateId
        : undefined;
    if (candidateId && !isAuthorized(request)) {
      response.status(401).json({ status: "unauthorized" });
      return;
    }
    let job;
    try {
      job = dependencies.durableJobRuntime
        ? await dependencies.durableJobRuntime.get(request.params.jobId, candidateId)
        : await dependencies.jobQueue!.get(request.params.jobId);
    } catch (error) {
      jobsLogger.error(
        { err: error, jobId: request.params.jobId },
        "job status lookup failed",
      );
      response.status(503).json({ status: "queue-unavailable" });
      return;
    }
    if (
      job &&
      candidateId &&
      job.name === "cv-parse" &&
      (job.payload as { candidateId: string }).candidateId !== candidateId
    ) {
      response.status(404).json({ status: "not-found" });
      return;
    }
    if (!job) {
      response.status(404).json({ status: "not-found" });
      return;
    }
    response.json(job);
  });
}

/** Re-exported so existing callers keep importing the job process signature. */
export type { JobResult, ProcessableJob };
