import type { SecurityCategory, SecurityGuardDecision } from "./guard";

export type SecurityPolicyDecision = {
  decision: "allow" | "block" | "degraded";
  reasonCode: string;
};

const CLEAR_HIGH_RISK_CATEGORIES = new Set<SecurityCategory>([
  "prompt-injection",
  "secret-extraction",
  "authorization-bypass",
]);

export function evaluateSecurityPolicy(
  decision: Pick<SecurityGuardDecision, "risk" | "category" | "confidence"> | null | undefined,
): SecurityPolicyDecision {
  if (!decision) {
    return { decision: "allow", reasonCode: "guard-unavailable" };
  }

  if (decision.risk === "high" && CLEAR_HIGH_RISK_CATEGORIES.has(decision.category)) {
    return { decision: "block", reasonCode: `block:${decision.category}` };
  }

  if (decision.risk === "medium") {
    return { decision: "degraded", reasonCode: `degraded:${decision.category}` };
  }

  return { decision: "allow", reasonCode: "allow" };
}
