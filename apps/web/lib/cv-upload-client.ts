import type { AgentCandidateProfile } from "./cv-profile-draft";

type Fetcher = typeof fetch;

export type CvJobState =
  | { status: "queued" | "active"; attempts?: number; maxAttempts?: number }
  | {
      status: "delayed";
      attempts?: number;
      maxAttempts?: number;
      nextRetryAt?: string;
    }
  | { status: "completed"; profile: AgentCandidateProfile }
  | { status: "failed"; message: string };

function authHeaders(accessToken?: string) {
  return accessToken
    ? { authorization: `Bearer ${accessToken}` }
    : undefined;
}

export async function submitCandidateCv(
  file: File,
  accessToken?: string,
  fetcher: Fetcher = fetch,
) {
  const body = new FormData();
  body.set("file", file, file.name);
  const response = await fetcher("/api/candidates/me/cv", {
    method: "POST",
    headers: authHeaders(accessToken),
    body,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? "CV upload failed.");
  }
  return payload as { jobId: string; status: "queued" };
}

type CvJobPayload = {
  status?: unknown;
  attempts?: unknown;
  maxAttempts?: unknown;
  nextRetryAt?: unknown;
  result?: { profile?: AgentCandidateProfile };
  error?: { message?: unknown };
};

export function normalizeCvJob(input: unknown): CvJobState {
  const payload =
    input && typeof input === "object" ? (input as CvJobPayload) : {};
  const attempts =
    typeof payload.attempts === "number" ? payload.attempts : undefined;
  const maxAttempts =
    typeof payload.maxAttempts === "number" ? payload.maxAttempts : undefined;

  if (payload.status === "completed") {
    return {
      status: "completed",
      profile: payload.result?.profile ?? {},
    };
  }
  if (payload.status === "failed") {
    return {
      status: "failed",
      message:
        typeof payload.error?.message === "string"
          ? payload.error.message
          : "CV processing failed.",
    };
  }
  if (payload.status === "delayed") {
    return {
      status: "delayed",
      attempts,
      maxAttempts,
      nextRetryAt:
        typeof payload.nextRetryAt === "string"
          ? payload.nextRetryAt
          : undefined,
    };
  }
  return {
    status: payload.status === "active" ? "active" : "queued",
    attempts,
    maxAttempts,
  };
}

export async function getCandidateCvJob(
  jobId: string,
  accessToken?: string,
  fetcher: Fetcher = fetch,
) {
  const response = await fetcher(
    `/api/candidates/me/cv/jobs/${encodeURIComponent(jobId)}`,
    { headers: authHeaders(accessToken) },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? "Job status unavailable.");
  }
  return normalizeCvJob(payload);
}
