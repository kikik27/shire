import type { ChatResourceType, ChatRole, ChatScopeInput } from "./types";
import {
  getApplicationById,
  getApplicationsByCandidateId,
  getCandidateById,
  getCompanyById,
  getJobById,
  getOwnedCompanies,
  getOwnedJobs,
  getTiedApplications,
  getTiedCandidates,
} from "../data/chat-access-data";
import { evaluateChatPolicy, type ChatPolicyDecision } from "./policy";

export type SafeResolvedChatContext = {
  viewer: {
    viewerId: string;
    role: ChatRole;
  };
  resource?: {
    resourceType: ChatResourceType;
    resourceId: string;
  };
  policy: ChatPolicyDecision;
  resources: {
    viewerProfile?: ReturnType<typeof getCandidateById>;
    viewerApplications?: ReturnType<typeof getApplicationsByCandidateId>;
    viewedJob?: ReturnType<typeof getJobById>;
    viewedCompany?: ReturnType<typeof getCompanyById>;
    viewedApplication?: ReturnType<typeof getApplicationById>;
    viewedCandidate?: ReturnType<typeof getCandidateById>;
    ownedCompanies?: ReturnType<typeof getOwnedCompanies>;
    ownedJobs?: ReturnType<typeof getOwnedJobs>;
    tiedCandidates?: ReturnType<typeof getTiedCandidates>;
    tiedApplications?: ReturnType<typeof getTiedApplications>;
  };
};

export function resolveChatContext(input: ChatScopeInput): SafeResolvedChatContext {
  const policy = evaluateChatPolicy(input);
  const resources: SafeResolvedChatContext["resources"] = {};

  if (input.role === "candidate") {
    resources.viewerProfile = getCandidateById(input.viewerId);
    resources.viewerApplications = getApplicationsByCandidateId(input.viewerId);

    if (input.resourceType === "job" && input.resourceId) {
      resources.viewedJob = getJobById(input.resourceId);
    }

    if (input.resourceType === "application" && input.resourceId) {
      const application = getApplicationById(input.resourceId);
      if (application?.candidateId === input.viewerId) {
        resources.viewedApplication = application;
      }
    }

    if (input.resourceType === "candidate" && input.resourceId === input.viewerId) {
      resources.viewedCandidate = getCandidateById(input.resourceId);
    }
  } else {
    resources.ownedCompanies = getOwnedCompanies(input.viewerId);
    resources.ownedJobs = getOwnedJobs(input.viewerId);
    resources.tiedCandidates = getTiedCandidates(input.viewerId);
    resources.tiedApplications = getTiedApplications(input.viewerId);

    if (input.resourceType === "company" && input.resourceId) {
      resources.viewedCompany = getCompanyById(input.resourceId);
    }

    if (input.resourceType === "job" && input.resourceId) {
      resources.viewedJob = getJobById(input.resourceId);
    }

    if (input.resourceType === "candidate" && input.resourceId) {
      const viewedCandidate = getCandidateById(input.resourceId);
      if (viewedCandidate) {
        resources.viewedCandidate = viewedCandidate;
      }
    }

    if (input.resourceType === "application" && input.resourceId) {
      const application = getApplicationById(input.resourceId);
      if (application) {
        resources.viewedApplication = application;
      }
    }
  }

  if (!policy.allowed) {
    delete resources.viewedCompany;
    delete resources.viewedCandidate;
    delete resources.viewedApplication;
  }

  return {
    viewer: {
      viewerId: input.viewerId,
      role: input.role,
    },
    ...(policy.allowed && input.resourceType && input.resourceId
      ? { resource: { resourceType: input.resourceType, resourceId: input.resourceId } }
      : {}),
    policy,
    resources,
  };
}
