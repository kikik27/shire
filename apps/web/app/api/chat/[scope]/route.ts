import { NextResponse } from "next/server";

import {
  AuthenticatedUserConfigurationError,
  AuthenticatedUserError,
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "../../../../lib/server/authenticated-user";
import {
  DatabaseConfigurationError,
} from "../../../../lib/server/db";
import {
  createDrizzleProfileRepository,
  ProfileRepositoryError,
  type ProfileRepository,
  type ProfileRole,
} from "../../../../lib/server/profile-repository";
import {
  persistedCandidateProfileSchema,
  storedRecruiterProfileSchema,
} from "../../../../lib/schemas";
import {
  buildAuthenticatedChatContext,
  ChatScopeAuthorizationError,
} from "../../../../lib/chat/server-scope";
import type { ChatResourceType, ChatScopeRequest } from "../../../../lib/chat/types";

export const runtime = "nodejs";
const CHAT_AGENT_HEADER_TIMEOUT_MS = 60_000;

type ResolveAuthenticatedUser = (
  request: Request,
) => Promise<AuthenticatedUser>;

export type ChatPostHandlerDependencies = {
  agentUrl?: string;
  fetcher?: typeof fetch;
  repository?: ProfileRepository;
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  serviceToken?: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function requestedChatScope(body: unknown): ChatScopeRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const nestedScope =
    record.scope && typeof record.scope === "object"
      ? record.scope as Record<string, unknown>
      : {};
  const role = record.role ?? nestedScope.role;
  const resourceType = record.resourceType ?? nestedScope.resourceType;
  const resourceId = record.resourceId ?? nestedScope.resourceId;
  const resourceLabel = record.resourceLabel ?? nestedScope.resourceLabel;

  if (role !== "candidate" && role !== "recruiter") {
    return null;
  }

  if (
    resourceType !== undefined &&
    resourceType !== "job" &&
    resourceType !== "candidate" &&
    resourceType !== "company" &&
    resourceType !== "application"
  ) {
    return null;
  }

  return {
    role,
    resourceType: resourceType as ChatResourceType | undefined,
    resourceId: typeof resourceId === "string" ? resourceId : undefined,
    resourceLabel: typeof resourceLabel === "string" ? resourceLabel : undefined,
  };
}

function requestMessages(body: unknown) {
  if (!body || typeof body !== "object") {
    return [];
  }
  const messages = (body as Record<string, unknown>).messages;
  return Array.isArray(messages) ? messages : [];
}

function storedProfileSchema(role: ProfileRole) {
  return role === "candidate"
    ? persistedCandidateProfileSchema
    : storedRecruiterProfileSchema;
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticatedUserError) {
    return jsonError("unauthorized", 401);
  }
  if (error instanceof AuthenticatedUserConfigurationError) {
    return jsonError("authentication-configuration-error", 500);
  }
  if (error instanceof DatabaseConfigurationError) {
    return jsonError("missing-database-configuration", 500);
  }
  if (error instanceof ProfileRepositoryError) {
    return jsonError("database-error", 500);
  }
  if (error instanceof ChatScopeAuthorizationError) {
    return jsonError(error.code, 403);
  }
  return jsonError("database-error", 500);
}

export function createChatPostHandler(
  dependencies: ChatPostHandlerDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const repository = () =>
    dependencies.repository ?? createDrizzleProfileRepository();
  const fetcher = dependencies.fetcher ?? fetch;

  return async function POST(request: Request) {
    const agentUrl =
      dependencies.agentUrl ?? process.env.SHIRE_AGENT_CHAT_URL?.trim();
    const serviceToken =
      dependencies.serviceToken ?? process.env.SHIRE_AGENT_SERVICE_TOKEN?.trim();
    const startedAt = Date.now();

    if (!agentUrl) {
      console.error("[shire-web:chat-proxy] missing SHIRE_AGENT_CHAT_URL");
      return jsonError("missing-agent-url", 500);
    }
    if (!serviceToken) {
      console.error("[shire-web:chat-proxy] missing SHIRE_AGENT_SERVICE_TOKEN");
      return jsonError("missing-service-token", 500);
    }

    try {
      const body = await request.json().catch(() => undefined);
      const requestedScope = requestedChatScope(body);
      if (!requestedScope) {
        return jsonError("invalid-chat-request", 400);
      }

      const authenticatedUser = await authenticate(request);
      const store = repository();
      const user = await store.resolveUser(authenticatedUser.privyUserId);
      const storedProfile = await store.getProfile(user.id, requestedScope.role);
      if (storedProfile === null) {
        return jsonError("role-not-active", 403);
      }
      const parsedProfile = storedProfileSchema(requestedScope.role).safeParse(
        storedProfile,
      );
      if (!parsedProfile.success) {
        return jsonError("database-error", 500);
      }
      const trusted = buildAuthenticatedChatContext({
        userId: user.id,
        role: requestedScope.role,
        profile: parsedProfile.data,
        requestedScope,
      });
      const forwardedBody = {
        ...trusted,
        messages: requestMessages(body),
      };

      console.info("[shire-web:chat-proxy] forwarding trusted request", {
        method: request.method,
        agentUrl,
        role: requestedScope.role,
        scope: trusted.scope.scope,
      });

      let upstream: Response;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        CHAT_AGENT_HEADER_TIMEOUT_MS,
      );
      try {
        upstream = await fetcher(agentUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${serviceToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(forwardedBody),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.error("[shire-web:chat-proxy] agent response timed out", {
            agentUrl,
            durationMs: Date.now() - startedAt,
            timeoutMs: CHAT_AGENT_HEADER_TIMEOUT_MS,
          });
          return NextResponse.json(
            { error: "agent-timeout", target: agentUrl },
            { status: 504 },
          );
        }
        console.error("[shire-web:chat-proxy] agent unreachable", {
          agentUrl,
          durationMs: Date.now() - startedAt,
        });
        return NextResponse.json(
          {
            error: "agent-unreachable",
            target: agentUrl,
          },
          { status: 502 },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!upstream.ok) {
        const errorBody = await upstream.text();
        console.error("[shire-web:chat-proxy] upstream error", {
          agentUrl,
          durationMs: Date.now() - startedAt,
          status: upstream.status,
          body: errorBody,
        });
        return new Response(errorBody, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }

      console.info("[shire-web:chat-proxy] upstream success", {
        agentUrl,
        durationMs: Date.now() - startedAt,
        status: upstream.status,
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
      });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const POST = createChatPostHandler();
