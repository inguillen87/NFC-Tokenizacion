export type DemoExecutionTruthState =
  | "not_started"
  | "synthetic_preview"
  | "persisted_unverified"
  | "verified_evidence"
  | "failed";

export type DemoFeedTruthState =
  | "unavailable"
  | "synthetic_preview"
  | "recorded_events"
  | "public_evidence";

type DemoReceiptTruthInput = {
  execution?: "visual" | "persisted" | "failed" | null;
  source?: string | null;
  degraded?: boolean | null;
  persisted?: boolean | null;
  chainWrite?: boolean | null;
  evidenceVerified?: boolean | null;
  evidenceUrl?: string | null;
};

type DemoFeedTruthInput = {
  degraded?: boolean | null;
  source?: string | null;
  events?: readonly unknown[] | null;
  evidenceVerified?: boolean | null;
  evidenceUrl?: string | null;
} | null;

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveDemoExecutionTruth(receipt?: DemoReceiptTruthInput | null): DemoExecutionTruthState {
  if (!receipt) return "not_started";
  if (receipt.execution === "failed") return "failed";

  const source = normalized(receipt.source);
  if (
    receipt.degraded === true
    || receipt.execution === "visual"
    || receipt.persisted !== true
    || source.includes("synthetic")
    || source.includes("visual-demo")
  ) {
    return "synthetic_preview";
  }

  const hasPublicEvidence = receipt.evidenceVerified === true
    && /^https:\/\//i.test(String(receipt.evidenceUrl || ""));
  if (receipt.chainWrite !== true || !hasPublicEvidence) return "persisted_unverified";
  return "verified_evidence";
}

export function resolveDemoFeedTruth(summary?: DemoFeedTruthInput): DemoFeedTruthState {
  if (!summary) return "unavailable";
  const source = normalized(summary.source);
  if (summary.degraded === true || source.includes("visual-demo") || source.includes("synthetic")) {
    return "synthetic_preview";
  }

  const eventCount = Array.isArray(summary.events) ? summary.events.length : 0;
  if (eventCount === 0) return "unavailable";
  const hasPublicEvidence = summary.evidenceVerified === true
    && /^https:\/\//i.test(String(summary.evidenceUrl || ""));
  if (source === "public-proof" && hasPublicEvidence) return "public_evidence";
  return "recorded_events";
}

export function canUseVerifiedDemoLanguage(state: DemoExecutionTruthState | DemoFeedTruthState) {
  return state === "verified_evidence" || state === "public_evidence";
}

export function isPositiveDemoVerdict(value?: string | null) {
  const verdict = normalized(value).toUpperCase().replace(/[\s-]+/g, "_");
  return [
    "AUTH_OK",
    "AUTHENTICATED",
    "AUTENTICADO",
    "VERIFIED",
    "VERIFICADO",
    "VALID",
    "RESULTADO_VALIDO",
    "OK",
  ].includes(verdict);
}
