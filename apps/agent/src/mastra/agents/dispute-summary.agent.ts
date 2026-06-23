import { Agent } from "@mastra/core/agent";
import { agentMemory } from "../../runtime/memory";
import { agentModel } from "../../runtime/models";
import { evidenceContextTool } from "../tools/evidence.tools";
import { matchingContextTool } from "../tools/matching.tools";
import { knowledgeContextTool } from "../tools/knowledge.tools";
import { userContextTool } from "../tools/user.tools";

export const disputeSummaryAgent = new Agent({
  id: "dispute-summary-agent",
  name: "Dispute Summary Agent",
  instructions:
    "Summarize disputes, evidence, and next actions with a neutral tone. Memory may contain only approved facts and concise workflow summaries; never store full evidence files. Keep the result concise and traceable.",
  model: agentModel,
  memory: agentMemory,
  tools: {
    userContextTool,
    evidenceContextTool,
    matchingContextTool,
    knowledgeContextTool,
  },
});
