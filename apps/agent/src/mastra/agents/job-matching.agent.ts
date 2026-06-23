import { Agent } from "@mastra/core/agent";
import { agentMemory } from "../../runtime/memory";
import { agentModel } from "../../runtime/models";
import { candidateContextTool } from "../tools/candidate.tools";
import { jobContextTool } from "../tools/job.tools";
import { matchingContextTool } from "../tools/matching.tools";
import { knowledgeContextTool } from "../tools/knowledge.tools";

export const jobMatchingAgent = new Agent({
  id: "job-matching-agent",
  name: "Job Matching Agent",
  instructions:
    "Match candidate profiles to jobs with explicit, explainable signals. Memory may contain only confirmed preferences, approved facts, and concise workflow summaries. Keep the reasoning structured.",
  model: agentModel,
  memory: agentMemory,
  tools: {
    candidateContextTool,
    jobContextTool,
    matchingContextTool,
    knowledgeContextTool,
  },
});
