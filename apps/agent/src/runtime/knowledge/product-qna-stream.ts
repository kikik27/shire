import { randomUUID } from "node:crypto";

import { toAISdkStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/request-context";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageChunk,
} from "ai";

import { productQnaAgent } from "../../mastra/agents/product-qna.agent";
import { logger } from "../logger";
import { getCapabilityPolicy } from "../models/policy";
import {
  buildKnowledgeSystemMessage,
  searchPublicProductKnowledge,
  type KnowledgeResult,
} from "./index";
import {
  dedupeProductKnowledge,
  isProductCodeRequest,
  normalizeProductQuestion,
  PRODUCT_ONLY_CODE_REQUEST_RESPONSE,
} from "./product-qna";
import { shouldRetrieveProductKnowledge } from "./product-intent";

const streamLogger = logger.child({ component: "product-qna-stream" });
const PUBLIC_STREAM_ERROR =
  "Product assistant is temporarily unavailable. Please try again.";

type StreamAgent = {
  stream(messages: unknown[], options: unknown): Promise<unknown>;
};

export type ProductQnaStreamDependencies = {
  agent?: StreamAgent;
  searchPublicProductKnowledge?: typeof searchPublicProductKnowledge;
};

function writeText(
  writer: { write(part: UIMessageChunk): void },
  text: string,
) {
  const id = `product-qna-${randomUUID()}`;
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

export function streamProductQuestion(
  body: unknown,
  signal: AbortSignal,
  dependencies: ProductQnaStreamDependencies = {},
) {
  const question = normalizeProductQuestion(body);
  const stream = createUIMessageStream({
    onError(error) {
      streamLogger.error({ err: error }, "product Q&A stream failed");
      return PUBLIC_STREAM_ERROR;
    },
    execute: async ({ writer }) => {
      if (isProductCodeRequest(question)) {
        writeText(writer, PRODUCT_ONLY_CODE_REQUEST_RESPONSE);
        return;
      }

      const intent = shouldRetrieveProductKnowledge(question, false);
      let knowledge: KnowledgeResult[] = [];
      if (intent.retrieve) {
        writer.write({
          type: "data-status",
          data: { status: "Checking Shire product knowledge..." },
        });
        knowledge = dedupeProductKnowledge(
          await (
            dependencies.searchPublicProductKnowledge ??
            searchPublicProductKnowledge
          )(question),
        );
      }

      writer.write({
        type: "data-status",
        data: { status: "Preparing a concise answer..." },
      });
      const context = knowledge.length
        ? buildKnowledgeSystemMessage(knowledge)
        : "No Shire product knowledge matched this public product question.";
      const requestContext = new RequestContext();
      requestContext.set("model-capability", "product-qna");
      const output = await (
        dependencies.agent ??
        (productQnaAgent as unknown as StreamAgent)
      ).stream(
        [
          {
            role: "system",
            content: [
              "Public product Q&A request.",
              "Use only the Shire product context below.",
              "If the context does not answer the question, say that the information is not available yet.",
              context,
            ].join("\n\n"),
          },
          { role: "user", content: question },
        ],
        {
          abortSignal: signal,
          requestContext,
          runId: `product-qna:${randomUUID()}`,
          maxOutputTokens: getCapabilityPolicy("product-qna").maxOutputTokens,
        },
      );

      for await (const part of toAISdkStream(output as never, {
        from: "agent",
        version: "v6",
      })) {
        if (!part.type.startsWith("reasoning-")) {
          writer.write(part);
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
