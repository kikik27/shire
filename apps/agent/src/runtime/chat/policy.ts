import type { ChatResourceType, ChatScopeInput } from "./types";
import {
  getApplicationById,
  getCandidateApplicationForJob,
  getOwnedCompanyIds,
  getOwnedJobs,
  getTiedCandidates,
} from "../data/chat-access-data";

export type ChatPolicyScope = "owned" | "related" | "forbidden";

export type ChatPolicyDecision = {
  allowed: boolean;
  scope: ChatPolicyScope;
  reason: string;
};

function isCandidateAccessAllowed(
  viewerId: string,
  resourceType?: ChatResourceType,
  resourceId?: string,
): ChatPolicyDecision {
  if (!resourceType || !resourceId) {
    return {
      allowed: true,
      scope: "owned",
      reason: `Candidate ${viewerId} may access their general chat context.`,
    };
  }

  if (resourceType === "candidate" && resourceId === viewerId) {
    return {
      allowed: true,
      scope: "owned",
      reason: `Candidate ${viewerId} may access profile ${resourceId}.`,
    };
  }

  if (resourceType === "application") {
    const application = getApplicationById(resourceId);
    if (application?.candidateId === viewerId) {
      return {
        allowed: true,
        scope: "owned",
        reason: `Candidate ${viewerId} may access application ${resourceId}.`,
      };
    }
  }

  if (resourceType === "job") {
    return {
      allowed: true,
      scope: "owned",
      reason: `Candidate ${viewerId} may access viewed job ${resourceId}.`,
    };
  }

  return {
    allowed: false,
    scope: "forbidden",
    reason: `Candidate ${viewerId} cannot access ${resourceType} ${resourceId}.`,
  };
}

function isRecruiterAccessAllowed(
  viewerId: string,
  resourceType?: ChatResourceType,
  resourceId?: string,
): ChatPolicyDecision {
  if (!resourceType || !resourceId) {
    return {
      allowed: true,
      scope: "owned",
      reason: `Recruiter ${viewerId} may access their owned company and job context.`,
    };
  }

  if (resourceType === "company" && getOwnedCompanyIds(viewerId).includes(resourceId)) {
    return {
      allowed: true,
      scope: "owned",
      reason: `Recruiter ${viewerId} may access company ${resourceId}.`,
    };
  }

  const ownedJobs = getOwnedJobs(viewerId);
  const ownedJob = ownedJobs.find((job) => job.id === resourceId);
  if (resourceType === "job" && ownedJob) {
    return {
      allowed: true,
      scope: "owned",
      reason: `Recruiter ${viewerId} may access job ${resourceId}.`,
    };
  }

  if (resourceType === "candidate") {
    const tiedCandidate = getTiedCandidates(viewerId).find(
      (candidate) => candidate.id === resourceId,
    );
    const tiedJob = ownedJobs.find((job) =>
      getCandidateApplicationForJob(resourceId, job.id),
    );

    if (tiedCandidate && tiedJob) {
      return {
        allowed: true,
        scope: "related",
        reason: `Recruiter ${viewerId} may access candidate ${resourceId} tied to job ${tiedJob.id}.`,
      };
    }
  }

  if (resourceType === "application") {
    const application = getApplicationById(resourceId);
    const owningJob = ownedJobs.find((job) => job.id === application?.jobId);
    if (application && owningJob) {
      return {
        allowed: true,
        scope: "related",
        reason: `Recruiter ${viewerId} may access application ${resourceId} tied to job ${owningJob.id}.`,
      };
    }
  }

  return {
    allowed: false,
    scope: "forbidden",
    reason: `Recruiter ${viewerId} cannot access ${resourceType} ${resourceId}.`,
  };
}

export function evaluateChatPolicy(input: ChatScopeInput): ChatPolicyDecision {
  return input.role === "candidate"
    ? isCandidateAccessAllowed(input.viewerId, input.resourceType, input.resourceId)
    : isRecruiterAccessAllowed(input.viewerId, input.resourceType, input.resourceId);
}
