export function normalizeChunk(chunk: unknown) {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return "";
}

export function parseAiSdkDataEventTypes(chunk: string) {
  const eventTypes: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice("data: ".length).trim();
    if (!data || data === "[DONE]") {
      eventTypes.push(data === "[DONE]" ? "done" : "empty");
      continue;
    }
    try {
      const parsed = JSON.parse(data) as { type?: unknown };
      eventTypes.push(
        typeof parsed.type === "string" ? parsed.type : "unknown-json",
      );
    } catch {
      eventTypes.push("invalid-json");
    }
  }
  return eventTypes;
}
