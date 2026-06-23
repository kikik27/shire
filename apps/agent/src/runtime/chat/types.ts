export type ChatRole = "candidate" | "recruiter";

export type ChatResourceType = "job" | "candidate" | "company" | "application";

export type ChatScopeInput = {
  viewerId: string;
  role: ChatRole;
  resourceType?: ChatResourceType;
  resourceId?: string;
};

