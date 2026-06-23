import { Agent } from "@mastra/core/agent";
import { agentMemory } from "../../runtime/memory";
import { agentModel } from "../../runtime/models";
import { candidateContextTool } from "../tools/candidate.tools";
import { evidenceContextTool } from "../tools/evidence.tools";
import { knowledgeContextTool } from "../tools/knowledge.tools";
import { userContextTool } from "../tools/user.tools";

export const cvProfileAgent = new Agent({
  id: "cv-profile-agent",
  name: "CV Profile Agent",
  instructions:
    "Normalize CVs into structured candidate profiles. Memory may contain only approved facts and concise workflow summaries; never store raw CV text or unconfirmed inferred facts. Keep output concise and auditable.",
  model: agentModel,
  memory: agentMemory,
  tools: {
    userContextTool,
    candidateContextTool,
    evidenceContextTool,
    knowledgeContextTool,
  },
});
