import { NextResponse } from "next/server";

export const runtime = "nodejs";
const PRODUCT_ASSISTANT_TIMEOUT_MS = 25_000;

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

export async function POST(request: Request) {
  const agentUrl = resolveProductQnaUrl();
  const serviceToken = process.env.SHIRE_AGENT_SERVICE_TOKEN?.trim();

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRODUCT_ASSISTANT_TIMEOUT_MS);
  try {
    upstream = await fetch(agentUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[shire-web:product-assistant] agent request timed out", {
        agentUrl,
        timeoutMs: PRODUCT_ASSISTANT_TIMEOUT_MS,
      });
      return jsonError("agent-timeout", 504);
    }
    return jsonError("agent-unreachable", 502);
  } finally {
    clearTimeout(timeout);
  }

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
