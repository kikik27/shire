import type { CvGenerationResult } from "../cv/normalizer";
import { processCandidateCv } from "../cv/normalizer";
import { generateCandidateProfile } from "../cv/agent-generator";
import {
  candidateProfileStore,
  type CandidateProfileStore,
} from "../data/candidate-profile-store";
import { embedText } from "../models/embeddings";
import type { JobProcessor } from "./job-processor";

export type CvParseProcessorDependencies = {
  generate: (request: {
    candidateId: string;
    jobId: string;
    rawCv: string;
  }) => Promise<CvGenerationResult>;
  embed: (value: string) => Promise<{ embedding: number[] }>;
  store: CandidateProfileStore;
};

const defaultDependencies: CvParseProcessorDependencies = {
  generate: generateCandidateProfile,
  embed: embedText,
  store: candidateProfileStore,
};

export function createCvParseProcessor(
  dependencies: CvParseProcessorDependencies = defaultDependencies,
): JobProcessor<"cv-parse"> {
  return {
    name: "cv-parse",
    llmPolicy: "required",
    async process(payload, context) {
      if (context.signal.aborted) {
        throw new Error("CV parse job aborted");
      }

      const record = await processCandidateCv({
        candidateId: payload.candidateId,
        rawCv: payload.rawCv,
        store: dependencies.store,
        generate: ({ rawCv }) =>
          dependencies.generate({
            candidateId: payload.candidateId,
            jobId: context.jobId,
            rawCv,
          }),
        embed: dependencies.embed,
      });

      return {
        candidateId: payload.candidateId,
        status: record.status,
        profile: record.profile,
        embeddingDimensions: record.embedding.length,
        usage: record.usage,
        llmInvoked: true,
      };
    },
  };
}

export const cvParseProcessor = createCvParseProcessor();
