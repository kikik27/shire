import { cvProfileAgent } from "../mastra/agents/cv-profile.agent";
import {
  parseCvWorkflow,
  runParseCvPipeline,
} from "../mastra/workflows/parse-cv.workflow";
import { jobRunnerData } from "../runtime/data/runtime-data";
import { runJobCli } from "../runtime/server/job-cli";
import { createJobRouting } from "../runtime/server/job-routing";
import { cvParseProcessor } from "../runtime/jobs/cv-parse.processor";

type CvParseJobDependencies = Pick<
  Parameters<typeof runParseCvPipeline>[0],
  "store" | "generate" | "embed"
>;

type CvParseBaseResult = {
  job: "cv-parse";
  agent: string;
  workflow: string;
  data: (typeof jobRunnerData)["cv-parse"];
  routing: ReturnType<typeof createJobRouting>;
};

type CvParseFixtureResult = CvParseBaseResult & {
  usage: [];
};

type CvParseProcessedResult = CvParseBaseResult & {
  usage: Awaited<ReturnType<typeof runParseCvPipeline>>["usage"];
  profile: {
    status: "PENDING_REVIEW";
    draft: Awaited<ReturnType<typeof runParseCvPipeline>>["profile"];
    embeddingText: string;
    embeddingDimensions: number;
    usage: Awaited<ReturnType<typeof runParseCvPipeline>>["usage"];
  };
};

export function runCvParseJob(): Promise<CvParseFixtureResult>;
export function runCvParseJob(
  dependencies: CvParseJobDependencies,
): Promise<CvParseProcessedResult>;
export async function runCvParseJob(
  dependencies?: CvParseJobDependencies,
): Promise<CvParseFixtureResult | CvParseProcessedResult> {
  const baseResult = {
    job: "cv-parse" as const,
    agent: cvProfileAgent.id,
    workflow: parseCvWorkflow.id,
    data: jobRunnerData["cv-parse"],
    routing: createJobRouting("cv-parse"),
  };

  if (!dependencies) {
    return {
      ...baseResult,
      usage: [],
    };
  }

  const candidate = jobRunnerData["cv-parse"].candidate;
  const record = await runParseCvPipeline({
    candidateId: candidate.id,
    rawCv: [
      candidate.name,
      candidate.role,
      candidate.summary,
      candidate.skills.join(", "),
    ].join("\n"),
    ...dependencies,
  });

  return {
    ...baseResult,
    profile: {
      status: record.status,
      draft: record.profile,
      embeddingText: record.embeddingText,
      embeddingDimensions: record.embedding.length,
      usage: record.usage,
    },
    usage: record.usage,
  };
}

async function runCvParseCliJob() {
  const candidate = jobRunnerData["cv-parse"].candidate;
  const result = await cvParseProcessor.process(
    {
      candidateId: candidate.id,
      rawCv: [
        candidate.name,
        candidate.role,
        candidate.summary,
        candidate.skills.join(", "),
      ].join("\n"),
    },
    {
      jobId: crypto.randomUUID(),
      attempt: 1,
      signal: new AbortController().signal,
    },
  );

  return {
    job: "cv-parse" as const,
    agent: cvProfileAgent.id,
    workflow: parseCvWorkflow.id,
    routing: createJobRouting("cv-parse"),
    result,
  };
}

runJobCli(import.meta.url, runCvParseCliJob);
