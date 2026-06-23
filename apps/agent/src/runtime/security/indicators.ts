type UnknownRecord = Record<string, unknown>;

export type SecurityIndicator = {
  level: "safe" | "suspicious" | "blocked";
  category:
    | "none"
    | "prompt-injection"
    | "secret-extraction"
    | "authorization-bypass"
    | "obfuscation";
  reasonCode: string;
  text: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractMessageText(message: UnknownRecord) {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (!Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .filter(
      (part): part is UnknownRecord =>
        isRecord(part) &&
        part.type === "text" &&
        typeof part.text === "string",
    )
    .map((part) => String(part.text))
    .join(" ")
    .trim();
}

export function extractInstructionBearingText(body: unknown) {
  if (!isRecord(body)) {
    return [];
  }

  const texts: string[] = [];
  if (typeof body.system === "string") {
    texts.push(body.system);
  }

  for (const field of ["messages", "context"] as const) {
    if (!Array.isArray(body[field])) {
      continue;
    }

    for (const entry of body[field]) {
      if (!isRecord(entry)) {
        continue;
      }

      const text = extractMessageText(entry);
      if (text) {
        texts.push(text);
      }
    }
  }

  return texts;
}

const blockedPatterns = [
  /\bignore\b.{0,40}\b(previous|prior|above|system|developer)\b.{0,30}\b(instruction|prompt|rule)/i,
  /\b(disregard|override|forget)\b.{0,40}\b(instruction|prompt|rule|policy)/i,
  /\b(reveal|show|print|repeat|expose|leak)\b.{0,40}\b(system prompt|hidden instruction|developer message|protected context|memory|secret|credential)/i,
  /\b(act as|pretend to be|you are now)\b.{0,50}\b(unrestricted|administrator|admin|developer|system|root)/i,
  /\b(bypass|disable|remove|evade)\b.{0,40}\b(policy|guardrail|safety|access|permission|restriction)/i,
  /\b(jailbreak|developer mode|dan mode|no restrictions)\b/i,
  /\b(abaikan|lupakan|timpa)\b.{0,40}\b(instruksi|prompt|aturan|kebijakan)\b/i,
  /\b(tampilkan|ungkapkan|cetak|bocorkan)\b.{0,40}\b(prompt sistem|instruksi tersembunyi|konteks terlindungi|memori|rahasia|kredensial)\b/i,
  /\b(lewati|nonaktifkan|hapus|hindari)\b.{0,40}\b(kebijakan|pengaman|keamanan|akses|izin|batasan)\b/i,
];

const suspiciousPatterns = [
  /\b(encoded|base64|rot13)\b.{0,40}\b(instruction|prompt|command)\b/i,
  /\b(tersembunyi|disamarkan|encoded)\b.{0,30}\b(instruksi|prompt|perintah)\b/i,
];

export function classifySecurityIndicator(body: unknown): SecurityIndicator {
  const texts = extractInstructionBearingText(body);
  const text = texts.join(" ").trim();

  if (!text) {
    return {
      level: "safe",
      category: "none",
      reasonCode: "no-instruction-text",
      text: "",
    };
  }

  if (blockedPatterns.some((pattern) => pattern.test(text))) {
    return {
      level: "blocked",
      category: "prompt-injection",
      reasonCode: "instruction-override",
      text,
    };
  }

  if (suspiciousPatterns.some((pattern) => pattern.test(text))) {
    return {
      level: "suspicious",
      category: "obfuscation",
      reasonCode: "obfuscated-instruction",
      text,
    };
  }

  return {
    level: "safe",
    category: "none",
    reasonCode: "none",
    text,
  };
}
