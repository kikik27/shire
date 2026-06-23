import { randomUUID } from "node:crypto";

import { RequestContext } from "@mastra/core/request-context";

import { productQnaAgent } from "../../mastra/agents/product-qna.agent";
import { logger } from "../logger";
import {
  buildKnowledgeSystemMessage,
  searchPublicProductKnowledge,
  type KnowledgeResult,
} from "./index";
import { getCapabilityPolicy } from "../models/policy";
import { stripHiddenReasoning } from "../security/reasoning";

type AgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProductQnaAgentResponse = {
  text?: string;
  content?: string;
  object?: unknown;
  response?: { messages?: Array<{ content?: unknown }> };
};

type ProductQnaAgent = {
  generate: (
    messages: AgentMessage[],
    options: unknown,
  ) => Promise<ProductQnaAgentResponse>;
};

export type ProductQnaRequest = {
  question: string;
};

export type ProductQnaResponse = {
  answer: string;
  knowledgePaths: string[];
};

export class ProductQnaError extends Error {
  constructor(
    public readonly code:
      | "invalid-product-question"
      | "product-question-too-long"
      | "product-answer-unavailable",
    message: string,
  ) {
    super(message);
  }
}

const MAX_PRODUCT_QUESTION_LENGTH = 1_000;
const productQnaLogger = logger.child({ component: "product-qna" });
const PRODUCT_ONLY_CODE_REQUEST_RESPONSE =
  "I can help with how to use Shire as a product, but I cannot provide code, API snippets, CLI commands, or implementation details here. Ask me about onboarding, roles, staking, escrow, AI matching, disputes, or the hiring flow.";

const codeRequestPattern =
  /\b(code|coding|snippet|api|sdk|cli|curl|npm|pnpm|yarn|function|component|database|sql|query|schema|endpoint|webhook|contract|solidity|typescript|javascript|python|implement|integrate|config)\b/i;

const codeOutputPattern =
  /```|<\/?[a-z][\s\S]*?>|\b(import|export|function|const|let|var|class|interface|type)\s+\w+|=>|\b(npm|pnpm|yarn|curl|npx)\s+/i;

function normalizeQuestion(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProductQnaError(
      "invalid-product-question",
      "Product Q&A requests require a question.",
    );
  }

  const question = (input as Record<string, unknown>).question;
  if (typeof question !== "string" || question.trim().length === 0) {
    throw new ProductQnaError(
      "invalid-product-question",
      "Product Q&A requests require a non-empty question.",
    );
  }

  const trimmed = question.trim();
  if (trimmed.length > MAX_PRODUCT_QUESTION_LENGTH) {
    throw new ProductQnaError(
      "product-question-too-long",
      "Product Q&A questions must stay under 1,000 characters.",
    );
  }

  return trimmed;
}

function dedupeKnowledge(results: KnowledgeResult[]) {
  const seen = new Set<string>();
  const selected: KnowledgeResult[] = [];

  for (const result of results) {
    const key = `${result.path}:${result.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(result);
  }

  return selected;
}

function extractText(response: ProductQnaAgentResponse) {
  if (typeof response.text === "string") return response.text.trim();
  if (typeof response.content === "string") return response.content.trim();
  if (typeof response.object === "string") return response.object.trim();

  const content = response.response?.messages?.at(-1)?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function isCodeRequest(question: string) {
  return codeRequestPattern.test(question);
}

function containsCodeOutput(answer: string) {
  return codeOutputPattern.test(answer);
}

export async function answerProductQuestion(
  body: unknown,
  dependencies: {
    agent?: ProductQnaAgent;
    searchPublicProductKnowledge?: typeof searchPublicProductKnowledge;
  } = {},
): Promise<ProductQnaResponse> {
  const startedAt = Date.now();
  const question = normalizeQuestion(body);
  productQnaLogger.info(
    {
      questionLength: question.length,
      codeRequest: isCodeRequest(question),
    },
    "product Q&A normalized question",
  );
  if (isCodeRequest(question)) {
    return {
      answer: PRODUCT_ONLY_CODE_REQUEST_RESPONSE,
      knowledgePaths: [],
    };
  }

  const search =
    dependencies.searchPublicProductKnowledge ?? searchPublicProductKnowledge;
  const retrievalStartedAt = Date.now();
  const knowledge = dedupeKnowledge(await search(question));
  productQnaLogger.info(
    {
      durationMs: Date.now() - retrievalStartedAt,
      resultCount: knowledge.length,
    },
    "product Q&A knowledge retrieval completed",
  );
  const context = knowledge.length
    ? buildKnowledgeSystemMessage(knowledge)
    : "No Shire product knowledge matched this public product question.";
  const requestContext = new RequestContext();
  requestContext.set("model-capability", "product-qna");

  const agent = dependencies.agent ?? (productQnaAgent as unknown as ProductQnaAgent);
  const modelStartedAt = Date.now();
  const response = await agent.generate(
    [
      {
        role: "system",
        content: [
          "Public product Q&A request.",
          "Use only the Shire product context below.",
          "If the context does not answer the question, say the information is not available yet.",
          context,
        ].join("\n\n"),
      },
      { role: "user", content: question },
    ],
    {
      requestContext,
      runId: `product-qna:${randomUUID()}`,
      maxOutputTokens: getCapabilityPolicy("product-qna").maxOutputTokens,
    },
  );
  productQnaLogger.info(
    {
      durationMs: Date.now() - modelStartedAt,
      totalDurationMs: Date.now() - startedAt,
    },
    "product Q&A model call completed",
  );
  const answer = stripHiddenReasoning(extractText(response));

  if (!answer) {
    throw new ProductQnaError(
      "product-answer-unavailable",
      "The product assistant did not return an answer.",
    );
  }

  return {
    answer: containsCodeOutput(answer)
      ? PRODUCT_ONLY_CODE_REQUEST_RESPONSE
      : answer,
    knowledgePaths: [...new Set(knowledge.map((item) => item.path))],
  };
}
