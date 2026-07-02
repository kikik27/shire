export function stripHiddenReasoning(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

export function hasHiddenReasoning(text: string) {
  return /<think\b/i.test(text);
}

export type UiMessageStreamEvent =
  | { type: "status"; status: string }
  | { type: "text"; delta: string }
  | { type: "finish" };

export function parseUiMessageSse(buffer: string, chunk: string) {
  const blocks = `${buffer}${chunk}`.split(/\r?\n\r?\n/);
  const nextBuffer = blocks.pop() ?? "";
  const events: UiMessageStreamEvent[] = [];

  for (const block of blocks) {
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;

      const data = line.slice(5).trim();
      if (data === "[DONE]") {
        events.push({ type: "finish" });
        continue;
      }

      try {
        const event = JSON.parse(data) as {
          type?: string;
          delta?: unknown;
          data?: { status?: unknown };
        };
        if (event.type === "text-delta" && typeof event.delta === "string") {
          events.push({ type: "text", delta: event.delta });
        } else if (
          event.type === "data-status" &&
          typeof event.data?.status === "string"
        ) {
          const status = event.data.status
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .trim()
            .slice(0, 120);
          if (status) events.push({ type: "status", status });
        }
      } catch {
        // Ignore malformed upstream events while preserving subsequent chunks.
      }
    }
  }

  return { buffer: nextBuffer, events };
}
