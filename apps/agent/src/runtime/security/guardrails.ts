import { env } from "../../env";
import type { AutonomyMode } from "../server/autonomy";

export type GuardrailDecision = {
  decision: "proceed" | "escalate";
  reason: string;
};

export type GuardrailContext = {
  action: string;
  autonomyMode?: AutonomyMode;
  ambiguous?: boolean;
  risk?: "low" | "medium" | "high";
};

export function evaluateGuardrail({
  action,
  autonomyMode = env.autonomyMode,
  ambiguous = false,
  risk = "low",
}: GuardrailContext): GuardrailDecision {
  if (autonomyMode === "manual") {
    return {
      decision: "escalate",
      reason: `Manual mode requires approval before ${action}.`,
    };
  }

  if (ambiguous) {
    return {
      decision: "escalate",
      reason: `Action ${action} is ambiguous and needs clarification.`,
    };
  }

  if (risk === "high") {
    return {
      decision: "escalate",
      reason: `Action ${action} is high risk and should be reviewed.`,
    };
  }

  if (autonomyMode === "semi-autonomous" && risk === "medium") {
    return {
      decision: "escalate",
      reason: `Action ${action} is medium risk in semi-autonomous mode.`,
    };
  }

  return {
    decision: "proceed",
    reason: `Action ${action} can proceed in ${autonomyMode} mode.`,
  };
}
