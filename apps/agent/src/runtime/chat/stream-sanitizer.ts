import { normalizeChunk } from "../../lib/sse";
import type { HiddenReasoningStreamSanitizer } from "../../types/chat-stream";

export function createAiSdkHiddenReasoningStreamSanitizer(): HiddenReasoningStreamSanitizer {
  let sseLineBuffer = "";
  let insideHiddenReasoning = false;
  let currentReasoningId: string | undefined;
  let reasoningIndex = 0;
  const emittedStatuses = new Set<string>();

  const createReasoningId = () => {
    reasoningIndex += 1;
    return `masked-thinking-${reasoningIndex}`;
  };

  const createSseLine = (event: Record<string, unknown>) =>
    `data: ${JSON.stringify(event)}`;

  const emitThinkingStatus = (rawText: string) => {
    if (!currentReasoningId) return [];

    const status = summarizeHiddenReasoning(rawText);
    if (!status || emittedStatuses.has(status)) return [];

    emittedStatuses.add(status);
    return [
      createSseLine({
        type: "reasoning-delta",
        id: currentReasoningId,
        delta: status,
      }),
    ];
  };

  const stripHiddenReasoningDelta = (delta: string) => {
    let output = "";
    let remaining = delta;
    const events: string[] = [];

    while (remaining.length > 0) {
      if (insideHiddenReasoning) {
        const closeTag = findThinkTag(remaining, "close");
        if (!closeTag) {
          events.push(...emitThinkingStatus(remaining));
          return { delta: output, events };
        }

        events.push(...emitThinkingStatus(remaining.slice(0, closeTag.index)));
        remaining = remaining.slice(closeTag.index + closeTag.length);
        insideHiddenReasoning = false;
        if (currentReasoningId) {
          events.push(
            createSseLine({ type: "reasoning-end", id: currentReasoningId }),
          );
        }
        currentReasoningId = undefined;
        continue;
      }

      const openTag = findThinkTag(remaining, "open");
      if (!openTag) {
        output += remaining;
        return { delta: output, events };
      }

      output += remaining.slice(0, openTag.index);
      remaining = remaining.slice(openTag.index + openTag.length);
      insideHiddenReasoning = true;
      currentReasoningId = createReasoningId();
      emittedStatuses.clear();
      events.push(createSseLine({ type: "reasoning-start", id: currentReasoningId }));
      events.push(...emitThinkingStatus(remaining));
    }

    return { delta: output, events };
  };

  const sanitizeSseLine = (line: string) => {
    if (!line.startsWith("data: ")) {
      return [line];
    }

    const data = line.slice("data: ".length).trim();
    if (!data || data === "[DONE]") {
      return [line];
    }

    try {
      const parsed = JSON.parse(data) as { type?: unknown; delta?: unknown };
      if (parsed.type !== "text-delta" || typeof parsed.delta !== "string") {
        return [line];
      }

      const { delta, events } = stripHiddenReasoningDelta(parsed.delta);
      if (!delta) {
        return events.length ? events : undefined;
      }

      return [...events, createSseLine({ ...parsed, delta })];
    } catch {
      return [line];
    }
  };

  return {
    sanitize(chunk: unknown) {
      const text = normalizeChunk(chunk);
      if (!text) return chunk;

      sseLineBuffer += text;
      const lines = sseLineBuffer.split(/\n/);
      sseLineBuffer = lines.pop() ?? "";

      const sanitizedLines: string[] = [];
      for (const line of lines) {
        const sanitizedLine = sanitizeSseLine(line);
        if (sanitizedLine !== undefined) {
          sanitizedLines.push(...sanitizedLine);
        }
      }

      return sanitizedLines.length ? `${sanitizedLines.join("\n")}\n` : "";
    },
    flush() {
      if (!sseLineBuffer) return "";
      const sanitizedLine = sanitizeSseLine(sseLineBuffer);
      sseLineBuffer = "";
      return sanitizedLine === undefined ? "" : sanitizedLine.join("\n");
    },
  };
}

function summarizeHiddenReasoning(text: string) {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return undefined;

  if (
    normalized.includes("profile") ||
    normalized.includes("candidate") ||
    normalized.includes("role") ||
    normalized.includes("alex")
  ) {
    return "Mencocokkan pertanyaan dengan konteks profil dan role aktif...";
  }

  if (
    normalized.includes("job") ||
    normalized.includes("recommend") ||
    normalized.includes("match") ||
    normalized.includes("listing")
  ) {
    return "Menimbang rekomendasi dan batas data lowongan yang tersedia...";
  }

  if (
    normalized.includes("respond") ||
    normalized.includes("answer") ||
    normalized.includes("concise")
  ) {
    return "Menyusun jawaban yang ringkas dan relevan...";
  }

  if (
    normalized.includes("user") ||
    normalized.includes("question") ||
    normalized.includes("asking") ||
    normalized.includes("context")
  ) {
    return "Memahami pertanyaan dan konteks percakapan...";
  }

  return "Menganalisis konteks sebelum menjawab...";
}

function findThinkTag(value: string, kind: "open" | "close") {
  const pattern = kind === "open" ? /<think\b[^>]*>/i : /<\/think>/i;
  const match = pattern.exec(value);
  if (!match) return undefined;
  return { index: match.index, length: match[0].length };
}
