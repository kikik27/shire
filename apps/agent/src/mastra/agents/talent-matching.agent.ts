import { Agent } from "@mastra/core/agent";
import { agentMemory } from "../../runtime/memory";
import { agentModel } from "../../runtime/models";
import { companyContextTool } from "../tools/company.tools";
import { jobContextTool } from "../tools/job.tools";
import { matchingContextTool } from "../tools/matching.tools";
import { knowledgeContextTool } from "../tools/knowledge.tools";

export const talentMatchingAgent = new Agent({
  id: "talent-matching-agent",
  name: "Talent Matching Agent",
  instructions:
    "Match available talent to company needs with minimal assumptions and clear criteria. Memory may contain only approved facts and concise workflow summaries. Keep outputs structured.",
  model: agentModel,
  memory: agentMemory,
  tools: {
    companyContextTool,
    jobContextTool,
    matchingContextTool,
    knowledgeContextTool,
  },
});
