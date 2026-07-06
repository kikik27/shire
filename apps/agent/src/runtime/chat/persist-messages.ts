import { randomUUID } from "node:crypto";

import { logger } from "../logger";

const persistenceLogger = logger.child({ component: "chat-persistence" });

/**
 * Minimal contract for the underlying Mastra memory storage substore
 * (LibSQLStore). We write through the substore directly instead of the
 * `Memory` wrapper because `Memory.saveMessages` runs output-processing /
 * embedding in @mastra/memory 1.22.x, which deadlocks for our config, and —
 * more fundamentally — `agent.generate()`/`agent.stream()` in
 * @mastra/core 1.49.x create the thread but never call `saveMessages`, so
 * conversation history is silently dropped.
 *
 * This workaround persists each completed turn (user + assistant message)
 * directly so recency-based recall (`lastMessages`) keeps working.
 */
export interface MemorySubstore {
  saveThread(args: {
    thread: {
      id: string;
      resourceId: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }): Promise<unknown>;
  saveMessages(args: { messages: unknown[] }): Promise<unknown>;
}

export interface PersistChatTurnInput {
  /** Underlying memory substore (obtained via `memory.getMemoryStore()`). */
  memoryStore: MemorySubstore;
  /** Thread id from the request body `memory.thread`. */
  thread: string;
  /** Resource id from the request body `memory.resource`. */
  resource: string;
  /** Inbound messages for this request; only the last `user` turn is persisted.
   * Supports both string-content and AI SDK `parts` message shapes. */
  userMessages: unknown[];
  /** Final assistant text for this turn. */
  assistantText: string;
}

/**
 * Extract text from a chat message, handling both the classic
 * `{ role, content: string }` shape and the AI SDK UI message
 * `{ role, parts: [{ type: "text", text }] }` shape.
 */
function extractMessageText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const record = message as Record<string, unknown>;

  if (typeof record.content === "string") return record.content;

  if (Array.isArray(record.parts)) {
    const text = record.parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          part?.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text)
      .join("");
    if (text) return text;
  }

  return undefined;
}

function lastUserMessageText(messages: unknown[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg &&
      typeof msg === "object" &&
      (msg as Record<string, unknown>).role === "user"
    ) {
      const text = extractMessageText(msg);
      if (text !== undefined) return text;
    }
  }
  return undefined;
}

/**
 * Persist one completed chat turn (user message + assistant reply) to the
 * memory substore. Storage errors are caught and logged — this must never
 * throw into the chat response path.
 */
export async function persistChatTurn(
  input: PersistChatTurnInput,
): Promise<void> {
  const { memoryStore, thread, resource, userMessages, assistantText } = input;

  const userText = lastUserMessageText(userMessages);
  if (userText === undefined) return;

  const now = new Date();
  const messageRecords = [
    {
      id: randomUUID(),
      threadId: thread,
      resourceId: resource,
      role: "user",
      type: "text",
      content: {
        format: 2,
        parts: [{ type: "text", text: userText }],
      },
      createdAt: now,
    },
    {
      id: randomUUID(),
      threadId: thread,
      resourceId: resource,
      role: "assistant",
      type: "text",
      content: {
        format: 2,
        parts: [{ type: "text", text: assistantText }],
      },
      createdAt: new Date(now.getTime() + 1),
    },
  ];

  try {
    // Thread may already exist (Mastra creates it during the stream). saveThread
    // is idempotent enough for our purposes; a duplicate insert error is logged
    // but does not prevent the messages from being written.
    try {
      await memoryStore.saveThread({
        thread: {
          id: thread,
          resourceId: resource,
          title: "",
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (threadError) {
      persistenceLogger.debug(
        { threadId: thread, err: String(threadError) },
        "memory thread upsert skipped",
      );
    }

    await memoryStore.saveMessages({ messages: messageRecords });
  } catch (error) {
    persistenceLogger.error(
      { threadId: thread, resourceId: resource, err: String(error) },
      "failed to persist chat turn to memory",
    );
  }
}
