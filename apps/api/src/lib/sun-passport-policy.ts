type PassportAction = "claim" | "save" | "join" | "warranty" | "rewards" | "tokenization" | "provenance";
type PassportVerdict =
  | "valid"
  | "valid_opened"
  | "replay_suspect"
  | "tampered"
  | "revoked"
  | "not_active"
  | "not_registered"
  | "invalid";

export function mapVerdictAndRisk(input: { statusCode: string; productState: string | null; reason: string }) {
  const code = String(input.statusCode || "").toUpperCase();
  const state = String(input.productState || "").toUpperCase();
  const reason = String(input.reason || "").toUpperCase();
  if (code === "REVOKED" || reason.includes("REVOKED")) return { verdict: "revoked", riskLevel: "critical" as const };
  if (code === "REPLAY_SUSPECT" || state === "REPLAY_SUSPECT" || reason.includes("REPLAY") || reason.includes("COPIED URL")) {
    return { verdict: "replay_suspect", riskLevel: "high" as const };
  }
  if (code === "TAMPER_RISK" || state === "TAMPER_RISK" || reason.includes("TAMPER_RISK") || reason.includes("INVALID_TAMPER")) {
    return { verdict: "tampered", riskLevel: "high" as const };
  }
  if (
    code === "OPENED"
    || code === "OPENED_PREVIOUSLY"
    || code === "MANUAL_OPENED"
    || state === "VALID_OPENED"
    || state === "VALID_OPENED_PREVIOUSLY"
    || state === "VALID_MANUAL_OPENED"
    || reason.includes("OPENED")
  ) {
    return { verdict: "valid_opened", riskLevel: "low" as const };
  }
  if (code === "VALID" || code === "AUTH_OK" || state === "VALID_CLOSED" || state === "VALID_UNKNOWN_TAMPER") {
    return { verdict: "valid", riskLevel: "none" as const };
  }
  if (code === "NOT_ACTIVE") return { verdict: "not_active", riskLevel: "medium" as const };
  if (code === "NOT_REGISTERED") return { verdict: "not_registered", riskLevel: "medium" as const };
  return { verdict: "invalid", riskLevel: "medium" as const };
}

export function resolveActionMatrix(verdict: PassportVerdict | string): { allowedActions: PassportAction[]; blockedActions: PassportAction[] } {
  const blockedSet = new Set<PassportAction>();
  const allowSet = new Set<PassportAction>(["provenance"]);
  if (verdict === "valid" || verdict === "valid_opened") {
    allowSet.add("claim");
    allowSet.add("save");
    allowSet.add("join");
    allowSet.add("warranty");
    allowSet.add("rewards");
    allowSet.add("tokenization");
  } else {
    blockedSet.add("claim");
    blockedSet.add("rewards");
    blockedSet.add("tokenization");
    blockedSet.add("warranty");
    blockedSet.add("save");
    blockedSet.add("join");
  }
  return {
    allowedActions: Array.from(allowSet),
    blockedActions: Array.from(blockedSet),
  };
}
