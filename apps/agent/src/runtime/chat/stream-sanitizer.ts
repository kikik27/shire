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

      // The upstream AI SDK emits proper SSE events: each event is one or more
      // `data: …` lines terminated by a blank line (`\n\n`). Splitting on
      // `\n\n` gives us the event boundary, which lets us cleanly expand a
      // single input event (e.g. a `text-delta` containing `<think>…`) into
      // multiple output events (reasoning-start/delta/end + text-delta) while
      // re-emitting every event with its own `\n\n` terminator. Without this,
      // adjacent `data: …` lines would be concatenated by downstream SSE
      // parsers and the resulting `JSON.parse` would fail mid-stream.
      let output = "";
      let boundaryIndex = sseLineBuffer.indexOf("\n\n");
      while (boundaryIndex !== -1) {
        const eventText = sseLineBuffer.slice(0, boundaryIndex);
        sseLineBuffer = sseLineBuffer.slice(boundaryIndex + 2);

        // An event may contain multiple `data: …` lines (uncommon but valid
        // SSE). Process each line independently; each gets its own `\n\n`
        // terminator from `createSseLine` / the pass-through branch.
        const lines = eventText.split("\n");
        for (const line of lines) {
          const sanitizedLine = sanitizeSseLine(line);
          if (sanitizedLine === undefined) continue;
          for (const outLine of sanitizedLine) {
            output += `${outLine}\n\n`;
          }
        }

        boundaryIndex = sseLineBuffer.indexOf("\n\n");
      }

      return output;
    },
    flush() {
      // Drain anything still in the buffer. If the upstream closed without a
      // trailing `\n\n`, treat the residue as a final partial event so we
      // don't drop the last reasoning or text-delta chunk.
      if (!sseLineBuffer) return "";
      const lines = sseLineBuffer.split("\n");
      sseLineBuffer = "";

      let output = "";
      for (const line of lines) {
        const sanitizedLine = sanitizeSseLine(line);
        if (sanitizedLine === undefined) continue;
        for (const outLine of sanitizedLine) {
          output += `${outLine}\n\n`;
        }
      }
      return output;
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
