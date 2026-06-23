export function stripHiddenReasoning(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

export function hasHiddenReasoning(text: string) {
  return /<think\b/i.test(text);
}
