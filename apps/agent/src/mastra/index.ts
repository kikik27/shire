import { Mastra } from "@mastra/core";
import { chatRoute } from "@mastra/ai-sdk";
import { cvProfileAgent } from "./agents/cv-profile.agent";
import { disputeSummaryAgent } from "./agents/dispute-summary.agent";
import { jobMatchingAgent } from "./agents/job-matching.agent";
import {
  productQnaAgent,
  productQnaInstructions,
} from "./agents/product-qna.agent";
import {
  roleAwareChatAgent,
  roleAwareChatInstructions,
} from "./agents/role-aware-chat.agent";
import { securityGuardAgent } from "./agents/security-guard.agent";
import { talentMatchingAgent } from "./agents/talent-matching.agent";
import { parseCvWorkflow } from "./workflows/parse-cv.workflow";
import { jobMatchingWorkflow } from "./workflows/job-matching.workflow";
import { talentMatchingWorkflow } from "./workflows/talent-matching.workflow";
import { disputeSummaryWorkflow } from "./workflows/dispute-summary.workflow";
import { userContextTool } from "./tools/user.tools";
import { candidateContextTool } from "./tools/candidate.tools";
import { companyContextTool } from "./tools/company.tools";
import { jobContextTool } from "./tools/job.tools";
import { matchingContextTool } from "./tools/matching.tools";
import { evidenceContextTool } from "./tools/evidence.tools";
import { knowledgeContextTool } from "./tools/knowledge.tools";

export { parseCvWorkflowId } from "./workflows/parse-cv.workflow";
export { jobMatchingWorkflowId } from "./workflows/job-matching.workflow";
export { talentMatchingWorkflowId } from "./workflows/talent-matching.workflow";
export { disputeSummaryWorkflowId } from "./workflows/dispute-summary.workflow";
export { userContextToolId } from "./tools/user.tools";
export { candidateContextToolId } from "./tools/candidate.tools";
export { companyContextToolId } from "./tools/company.tools";
export { jobContextToolId } from "./tools/job.tools";
export { matchingContextToolId } from "./tools/matching.tools";
export { evidenceContextToolId } from "./tools/evidence.tools";
export { knowledgeContextToolId } from "./tools/knowledge.tools";
export {
  agentMemoryTemplate,
  buildAgentMemoryConfig,
  createAgentMemoryConfig,
  createAgentMemory,
} from "../runtime/memory";

export const chatRouteVersion = "v6" as const;

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({
        path: "/chat/:agentId",
        version: chatRouteVersion,
      }),
    ],
  },
  tools: {
    userContextTool,
    candidateContextTool,
    companyContextTool,
    jobContextTool,
    matchingContextTool,
    evidenceContextTool,
    knowledgeContextTool,
  },
  agents: {
    cvProfileAgent,
    jobMatchingAgent,
    productQnaAgent,
    talentMatchingAgent,
    disputeSummaryAgent,
    roleAwareChatAgent,
    securityGuardAgent,
  },
  workflows: {
    parseCvWorkflow,
    jobMatchingWorkflow,
    talentMatchingWorkflow,
    disputeSummaryWorkflow,
  },
});

export {
  cvProfileAgent,
  disputeSummaryAgent,
  jobMatchingAgent,
  productQnaAgent,
  productQnaInstructions,
  roleAwareChatAgent,
  roleAwareChatInstructions,
  talentMatchingAgent,
  parseCvWorkflow,
  jobMatchingWorkflow,
  talentMatchingWorkflow,
  disputeSummaryWorkflow,
  userContextTool,
  candidateContextTool,
  companyContextTool,
  jobContextTool,
  matchingContextTool,
  evidenceContextTool,
  knowledgeContextTool,
};
