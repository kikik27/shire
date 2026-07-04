export type ProductIntent = "product" | "social" | "resource" | "unknown";

const productTerms =
  /\b(shire|stake|staking|escrow|candidate|recruiter|onboarding|matching|match|dispute|application|applicant|job|role|profile|platform|hiring|lowongan|pelamar|rekrutmen)\b/i;
const socialOnly =
  /^(hi|hello|hey|halo|hai|thanks|thank you|terima kasih|makasih|good (morning|afternoon|evening))[!,.?\s]*$/i;
const resourceTerms =
  /\b(this (page|job|role|profile)|halaman ini|lowongan ini|role ini|profil ini)\b/i;

export function classifyProductIntent(query: string): ProductIntent {
  const normalized = query.normalize("NFKC").trim();
  if (
    resourceTerms.test(normalized) &&
    !productTerms.test(normalized.replace(resourceTerms, ""))
  ) {
    return "resource";
  }
  if (productTerms.test(normalized)) return "product";
  if (socialOnly.test(normalized)) return "social";
  return "unknown";
}

export function shouldRetrieveProductKnowledge(
  query: string,
  hasTrustedResourceContext: boolean,
) {
  const intent = classifyProductIntent(query);
  return {
    intent,
    retrieve:
      intent === "product" ||
      (intent === "unknown" && !hasTrustedResourceContext),
  };
}
