import { NextResponse } from "next/server";

export const runtime = "nodejs";
const PRODUCT_ASSISTANT_TIMEOUT_MS = 25_000;

type ProductAssistantDependencies = {
  agentUrl?: string;
  serviceToken?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function resolveProductQnaUrl() {
  const internalUrl = process.env.SHIRE_AGENT_INTERNAL_URL?.trim();
  if (internalUrl) {
    return `${internalUrl.replace(/\/+$/, "")}/product-qna`;
  }

  const chatUrl = process.env.SHIRE_AGENT_CHAT_URL?.trim();
  if (!chatUrl) {
    return undefined;
  }

  return chatUrl.replace(/\/chat\/[^/]+\/?$/, "/product-qna");
}

export function createProductAssistantPost(
  dependencies: ProductAssistantDependencies = {},
) {
  return async function POST(request: Request) {
    const agentUrl = dependencies.agentUrl ?? resolveProductQnaUrl();
    const serviceToken =
      dependencies.serviceToken ??
      process.env.SHIRE_AGENT_SERVICE_TOKEN?.trim();

    if (!agentUrl) {
      console.error("[shire-web:product-assistant] missing agent URL");
      return jsonError("missing-agent-url", 500);
    }

    if (!serviceToken) {
      console.error("[shire-web:product-assistant] missing service token");
      return jsonError("missing-service-token", 500);
    }

    const body = await request.json().catch(() => undefined);
    const question =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).question
        : undefined;

    if (typeof question !== "string" || question.trim().length === 0) {
      return jsonError("invalid-product-question", 400);
    }

    let upstream: Response;
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(
        dependencies.timeoutMs ?? PRODUCT_ASSISTANT_TIMEOUT_MS,
      ),
    ]);
    try {
      upstream = await (dependencies.fetch ?? fetch)(agentUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ question }),
        signal,
      });
    } catch {
      if (signal.aborted) {
        console.error("[shire-web:product-assistant] agent request timed out", {
          agentUrl,
          timeoutMs: dependencies.timeoutMs ?? PRODUCT_ASSISTANT_TIMEOUT_MS,
        });
        return jsonError("agent-timeout", 504);
      }
      return jsonError("agent-unreachable", 502);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "text/event-stream",
        "cache-control": "no-cache, no-transform",
      },
    });
  };
}

export const POST = createProductAssistantPost();
