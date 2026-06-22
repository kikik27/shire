import type { ChatScopeRequest } from "./types";

export type ThreadCopy = {
  emptyTitle: string;
  emptyDescription: string;
  suggestions: string[];
  placeholder: string;
  contextLabel: string;
  thinkingTexts: string[];
};

export function buildThreadCopy(scope?: ChatScopeRequest): ThreadCopy {
  const role = scope?.role;
  const resourceType = scope?.resourceType;
  const label = scope?.resourceLabel;
  const named = (fallback: string) => label?.trim() || fallback;

  if (role === "candidate" && resourceType === "job") {
    const roleName = named("this role");
    return {
      emptyTitle: `Ask Shire about ${roleName}`,
      emptyDescription:
        "Use the job page and your candidate context to understand fit, risks, next steps, and application strategy.",
      suggestions: [
        "How well do I fit this role?",
        "What should I improve before applying?",
        "Explain the stake and escrow flow",
      ],
      placeholder: "Ask about this role...",
      contextLabel: "Candidate + role context",
      thinkingTexts: [
        "Reading the role requirements...",
        "Checking your candidate context...",
        "Comparing fit signals...",
        "Preparing next steps...",
      ],
    };
  }

  if (role === "candidate" && resourceType === "candidate") {
    return {
      emptyTitle: "Ask Shire about your profile",
      emptyDescription:
        "Use your candidate profile context to review readiness, missing details, and ways to improve matching quality.",
      suggestions: [
        "What is missing from my profile?",
        "How can I improve my matches?",
        "Summarize my candidate profile",
      ],
      placeholder: "Ask about your profile...",
      contextLabel: "Candidate profile context",
      thinkingTexts: [
        "Reading your profile context...",
        "Checking matching signals...",
        "Finding profile gaps...",
        "Preparing candidate guidance...",
      ],
    };
  }

  if (role === "recruiter" && resourceType === "job") {
    const roleName = named("this hiring role");
    return {
      emptyTitle: `Ask Shire about ${roleName}`,
      emptyDescription:
        "Use the job context to refine requirements, understand match quality, and decide what to do next.",
      suggestions: [
        "How can I improve this job post?",
        "What candidate signals matter most?",
        "What should I review next?",
      ],
      placeholder: "Ask about this hiring role...",
      contextLabel: "Recruiter + role context",
      thinkingTexts: [
        "Reading the hiring role...",
        "Checking recruiter context...",
        "Reviewing match signals...",
        "Preparing hiring guidance...",
      ],
    };
  }

  if (role === "recruiter" && resourceType === "company") {
    return {
      emptyTitle: "Ask Shire about your company profile",
      emptyDescription:
        "Use your recruiter profile context to sharpen positioning, candidate trust signals, and hiring readiness.",
      suggestions: [
        "What is missing from our profile?",
        "How can we attract better talent?",
        "Summarize our hiring profile",
      ],
      placeholder: "Ask about your company profile...",
      contextLabel: "Recruiter profile context",
      thinkingTexts: [
        "Reading company context...",
        "Checking hiring signals...",
        "Reviewing profile completeness...",
        "Preparing recruiter guidance...",
      ],
    };
  }

  if (role === "recruiter") {
    return {
      emptyTitle: "Ask Shire about hiring",
      emptyDescription:
        "Use your recruiter context to plan hiring, review talent fit, and understand marketplace workflows.",
      suggestions: [
        "What should I do next?",
        "How does talent matching work?",
        "How should I set up a role?",
      ],
      placeholder: "Ask about hiring on Shire...",
      contextLabel: "Recruiter context",
      thinkingTexts: [
        "Reading recruiter context...",
        "Checking product knowledge...",
        "Reviewing hiring workflow...",
        "Preparing a scoped answer...",
      ],
    };
  }

  return {
    emptyTitle: "Ask Shire for candidate guidance",
    emptyDescription:
      "Use your candidate context to understand roles, matching, applications, staking, and next steps.",
    suggestions: [
      "What should I do next?",
      "How does matching work?",
      "How does staking protect me?",
    ],
    placeholder: "Ask about Shire...",
    contextLabel: "Candidate context",
    thinkingTexts: [
      "Reading candidate context...",
      "Checking product knowledge...",
      "Reviewing next-step options...",
      "Preparing a scoped answer...",
    ],
  };
}
