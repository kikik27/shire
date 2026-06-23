type UnknownRecord = Record<string, unknown>;

export type SecurityRisk = "low" | "medium" | "high";

export type SecurityCategory =
  | "none"
  | "prompt-injection"
  | "secret-extraction"
  | "authorization-bypass"
  | "obfuscation"
  | "malware"
  | "other";

export type SecurityGuardDecision = {
  risk: SecurityRisk;
  confidence: number;
  category: SecurityCategory;
  reasonCode: string;
  detectedLanguage: string;
  text: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractLatestUserText(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return "";
  }

  for (let index = body.messages.length - 1; index >= 0; index -= 1) {
    const message = body.messages[index];
    if (!isRecord(message) || message.role !== "user") {
      continue;
    }

    if (typeof message.content === "string") {
      return message.content.trim();
    }

    if (Array.isArray(message.parts)) {
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
  }

  return "";
}

function detectLanguage(text: string) {
  if (/[\u3040-\u30ff]/u.test(text)) return "ja";
  if (/[\uac00-\ud7af]/u.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/u.test(text)) return "zh";
  if (/[\u0600-\u06ff]/u.test(text)) return "ar";
  if (/[\u0e00-\u0e7f]/u.test(text)) return "th";
  if (/\b(bagaimana|instruksi|bisa|tolong|aplikasi|lamaran|kerja)\b/i.test(text)) return "id";
  if (/[¿¡ñáéíóúü]/i.test(text)) return "es";
  if (/[çàâæèéêëîïôœùûüÿ]/i.test(text)) return "fr";
  if (/[ãõáàâçéêíóôõú]/i.test(text)) return "pt";
  if (/[äöüß]/i.test(text)) return "de";
  if (/[a-z]/i.test(text)) return "en";
  return "unknown";
}

const highRiskPatterns = [
  /\b(ignore|disregard|override|forget)\b.{0,40}\b(previous|prior|above|all)\b.{0,30}\b(instruction|prompt|rule|policy)/i,
  /\b(reveal|show|print|leak|expose|dump|repeat)\b.{0,40}\b(system prompt|hidden instruction|developer message|memory|credentials|secrets|protected context)/i,
  /\b(bypass|disable|remove|evade)\b.{0,40}\b(guardrail|security|policy|permission|access|restriction)/i,
  /\b(base64|rot13|encoded|cipher)\b.{0,40}\b(instruction|prompt|payload|command)/i,
  /\b(abaikan|tampilkan|ungkapkan|bocorkan|lewati|nonaktifkan|hapus)\b.{0,40}\b(instruksi|prompt|memori|kebijakan|keamanan|izin|batasan)/i,
];

const mediumRiskPatterns = [
  /\b(encode|encoded|base64|rot13|obfuscate|hidden)\b/i,
  /\b(tersembunyi|disamarkan|encoded|disandi)\b/i,
  /\b(prompt|instruction|instruksi|perintah)\b.{0,20}\b(base64|encoded|hidden|obfuscated)\b/i,
];

export function guardSecurityPrompt(body: unknown): SecurityGuardDecision {
  const text = extractLatestUserText(body);
  const detectedLanguage = text ? detectLanguage(text) : "unknown";

  if (!text) {
    return {
      risk: "low",
      confidence: 0,
      category: "none",
      reasonCode: "no-user-text",
      detectedLanguage,
      text: "",
    };
  }

  if (highRiskPatterns.some((pattern) => pattern.test(text))) {
    return {
      risk: "high",
      confidence: 0.97,
      category: text.toLowerCase().includes("base64") ? "obfuscation" : "prompt-injection",
      reasonCode: "high-risk-security-pattern",
      detectedLanguage,
      text,
    };
  }

  if (mediumRiskPatterns.some((pattern) => pattern.test(text))) {
    return {
      risk: "medium",
      confidence: 0.72,
      category: "obfuscation",
      reasonCode: "suspicious-obfuscation",
      detectedLanguage,
      text,
    };
  }

  return {
    risk: "low",
    confidence: 0.22,
    category: "none",
    reasonCode: "no-suspicion",
    detectedLanguage,
    text,
  };
}
