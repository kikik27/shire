export type OutputValidationResult =
  | { safe: true }
  | {
      safe: false;
      reasonCode:
        | "output-too-long"
        | "system-prompt-leak"
        | "credential-leak"
        | "unauthorized-action-claim";
    };

function hasCredentialShape(text: string) {
  return (
    /\bsk-[A-Za-z0-9_-]{16,}\b/.test(text) ||
    /\bOPENROUTER_API_KEY\b/.test(text) ||
    /\bTOKENROUTER_API_KEY\b/.test(text) ||
    /\bapi[_-]?key\b/i.test(text) ||
    /\bsecret(?:s)?\b/i.test(text)
  );
}

function hasSystemPromptLeakShape(text: string) {
  return (
    /\b(system prompt|developer message|hidden instruction|memory contents|internal configuration)\b/i.test(
      text,
    ) ||
    /\bmy (?:system|developer) prompt\b/i.test(text) ||
    /\bas an ai (?:language model|assistant)\b/i.test(text)
  );
}

function hasUnauthorizedActionClaimShape(text: string) {
  return (
    /\b(i|we)\s+(?:accessed|viewed|retrieved|deleted|changed|updated|sent|approved|rejected)\b/i.test(
      text,
    ) &&
    /\b(?:another|someone else['"]?s|private|protected|unauthorized)\b/i.test(
      text,
    )
  );
}

export function validateOutputText(
  text: string,
  options: { maxCharacters: number },
): OutputValidationResult {
  if (text.length > options.maxCharacters) {
    return { safe: false, reasonCode: "output-too-long" };
  }

  if (hasSystemPromptLeakShape(text)) {
    return { safe: false, reasonCode: "system-prompt-leak" };
  }

  if (hasCredentialShape(text)) {
    return { safe: false, reasonCode: "credential-leak" };
  }

  if (hasUnauthorizedActionClaimShape(text)) {
    return { safe: false, reasonCode: "unauthorized-action-claim" };
  }

  return { safe: true };
}
