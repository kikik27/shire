import type { ProfileRole } from "../server/profile-repository";
import type {
  CandidateProfile,
  ExperienceLevel,
  JobStatus,
  JobType,
  RecruiterProfile,
} from "../types";

import type {
  ChatResourceType,
  ChatScopeRequest,
  TrustedChatScope,
} from "./types";

export class ChatScopeAuthorizationError extends Error {
  constructor(
    public readonly code:
      | "role-not-active"
      | "resource-forbidden"
      | "resource-not-found",
  ) {
    super(code);
    this.name = "ChatScopeAuthorizationError";
  }
}

type ChatResourceJob = {
  candidateStakeAmount?: number;
  candidateStakeRequired: boolean;
  companyName: string;
  description: string;
  experienceLevel: ExperienceLevel;
  id: string;
  jobType: JobType;
  location: string;
  recruiterUserId: string;
  remote: boolean;
  salaryRange: string;
  skillsRequired: string[];
  status: JobStatus;
  title: string;
};

export type ChatResourceRepository = {
  getJob(id: string): Promise<ChatResourceJob | null>;
};

export type AuthenticatedChatContext = {
  context: Array<{ role: "system"; content: string }>;
  memory: {
    resource: string;
    thread: string;
  };
  scope: TrustedChatScope;
  system: string;
};

type BuildAuthenticatedChatContextInput = {
  profile: CandidateProfile | RecruiterProfile | null;
  requestedScope: ChatScopeRequest & Record<string, unknown>;
  resourceRepository?: ChatResourceRepository;
  role: ProfileRole;
  userId: string;
};

function assertActiveProfile(
  profile: CandidateProfile | RecruiterProfile | null,
): asserts profile is CandidateProfile | RecruiterProfile {
  if (!profile) {
    throw new ChatScopeAuthorizationError("role-not-active");
  }
}

function trustedProfileContext(
  role: ProfileRole,
  profile: CandidateProfile | RecruiterProfile,
) {
  if (role === "candidate") {
    const candidate = profile as CandidateProfile;
    return [
      `Candidate profile: ${candidate.displayName}`,
      `Bio: ${candidate.bio}`,
      `Experience: ${candidate.experienceLevel}`,
      `Target roles: ${candidate.roleTargets.join(", ") || "Not provided"}`,
      `Skills: ${candidate.skills.join(", ") || "Not provided"}`,
      `Location: ${candidate.location ?? "Not provided"}`,
      `Timezone: ${candidate.timezone ?? "Not provided"}`,
      `Languages: ${candidate.languages.join(", ") || "Not provided"}`,
      `Visibility: ${candidate.visibility}`,
    ];
  }

  const recruiter = profile as RecruiterProfile;
  return [
    `Recruiter profile: ${recruiter.companyName}`,
    `Company description: ${recruiter.companyDescription}`,
    `Website: ${recruiter.companyWebsite ?? "Not provided"}`,
    `Location: ${recruiter.location ?? "Not provided"}`,
    `Verification status: ${recruiter.verificationStatus}`,
    `Trust level: ${recruiter.trustLevel}`,
    `Completed hires: ${recruiter.completedHires}`,
    `Dispute count: ${recruiter.disputeCount}`,
  ];
}

function trustedJobContext(job: ChatResourceJob) {
  const candidateStake = job.candidateStakeRequired
    ? `${job.candidateStakeAmount ?? 0}`
    : "Not required";

  return [
    `Job title: ${job.title}`,
    `Company: ${job.companyName}`,
    `Description: ${job.description}`,
    `Required skills: ${job.skillsRequired.join(", ") || "Not provided"}`,
    `Job status: ${job.status}`,
    `Location: ${job.location}`,
    `Work arrangement: ${job.remote ? "Remote" : "On-site"}`,
    `Job type: ${job.jobType}`,
    `Experience level: ${job.experienceLevel}`,
    `Salary range: ${job.salaryRange}`,
    `Candidate stake: ${candidateStake}`,
  ];
}

async function resolveAuthorizedResource(input: {
  profile: CandidateProfile | RecruiterProfile;
  resourceRepository?: ChatResourceRepository;
  requestedScope: ChatScopeRequest;
  role: ProfileRole;
  userId: string;
}): Promise<{
  context: string[];
  resourceId?: string;
  resourceLabel?: string;
  resourceType?: ChatResourceType;
}> {
  const {
    profile,
    requestedScope,
    resourceRepository,
    role,
    userId,
  } = input;

  if (!requestedScope.resourceType) {
    return { context: [] };
  }

  if (role === "candidate") {
    if (requestedScope.resourceType === "candidate") {
      return {
        resourceType: "candidate",
        resourceId: userId,
        resourceLabel: (profile as CandidateProfile).displayName,
        context: [],
      };
    }
  }

  if (role === "recruiter" && requestedScope.resourceType === "company") {
    return {
      resourceType: "company",
      resourceId: userId,
      resourceLabel: (profile as RecruiterProfile).companyName,
      context: [],
    };
  }

  if (
    requestedScope.resourceType !== "job" ||
    !requestedScope.resourceId
  ) {
    throw new ChatScopeAuthorizationError("resource-forbidden");
  }
  if (!resourceRepository) {
    throw new Error("Chat resource repository is required for job scope.");
  }

  const job = await resourceRepository.getJob(requestedScope.resourceId);
  if (!job) {
    throw new ChatScopeAuthorizationError("resource-not-found");
  }

  if (role === "candidate") {
    if (job.status !== "ACTIVE" || job.recruiterUserId === userId) {
      throw new ChatScopeAuthorizationError("resource-forbidden");
    }
  } else if (job.recruiterUserId !== userId) {
    throw new ChatScopeAuthorizationError("resource-forbidden");
  }

  return {
    resourceType: "job",
    resourceId: job.id,
    resourceLabel: job.title,
    context: trustedJobContext(job),
  };
}

function buildSystemMessage(input: {
  memoryResource: string;
  profile: CandidateProfile | RecruiterProfile;
  resourceContext: string[];
  role: ProfileRole;
  scope: TrustedChatScope;
}) {
  const { memoryResource, profile, resourceContext, role, scope } = input;
  const parts = [
    `Viewer: ${scope.viewerId}`,
    `Role: ${scope.role}`,
    `Thread: ${scope.threadId}`,
    `Memory resource: ${memoryResource}`,
    `Scope: ${scope.scope}`,
  ];

  if (scope.resourceType && scope.resourceId) {
    parts.push(`Resource: ${scope.resourceType}:${scope.resourceId}`);
  }

  parts.push(...trustedProfileContext(role, profile));
  parts.push(...resourceContext);
  return parts.join("\n");
}

export async function buildAuthenticatedChatContext({
  profile,
  requestedScope,
  resourceRepository,
  role,
  userId,
}: BuildAuthenticatedChatContextInput): Promise<AuthenticatedChatContext> {
  assertActiveProfile(profile);

  if (requestedScope.role !== role) {
    throw new ChatScopeAuthorizationError("resource-forbidden");
  }

  const { context: resourceContext, ...resource } =
    await resolveAuthorizedResource({
      profile,
      requestedScope,
      resourceRepository,
      role,
      userId,
    });
  const memoryResource = `user:${userId}:role:${role}`;
  const hasResource = Boolean(resource.resourceType && resource.resourceId);
  const threadId = hasResource
    ? `${memoryResource}:${resource.resourceType}:${resource.resourceId}`
    : `${memoryResource}:general`;
  const scope: TrustedChatScope = {
    viewerId: userId,
    role,
    ...resource,
    threadId,
    resourceKey: memoryResource,
    scope: hasResource ? "resource" : "general",
  };
  const system = buildSystemMessage({
    memoryResource,
    profile,
    resourceContext,
    role,
    scope,
  });

  return {
    scope,
    memory: {
      resource: memoryResource,
      thread: threadId,
    },
    system,
    context: [{ role: "system", content: system }],
  };
}
