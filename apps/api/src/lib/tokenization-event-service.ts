import {
  CanonicalEventWriteError,
  writeCanonicalEvent,
  type CanonicalEventReceipt,
} from "./canonical-event-writer";
import type { TokenizationRuntimeMode } from "./tokenization-engine";

export type TokenizationEventState = "requested" | "simulated" | "anchored";

export type TokenizationEventRecord = {
  id?: unknown;
  batch_id?: unknown;
  bid?: unknown;
  network?: unknown;
  tx_hash?: unknown;
  token_id?: unknown;
  anchor_hash?: unknown;
  execution_class?: unknown;
  meta?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function recordTokenizationCanonicalEvent(input: {
  request: TokenizationEventRecord;
  state: TokenizationEventState;
  runtimeMode: TokenizationRuntimeMode;
  processor: string;
}): Promise<{ ok: true; receipt: CanonicalEventReceipt } | { ok: false; reason: string }> {
  const requestId = String(input.request.id || "").trim();
  const batchId = String(input.request.batch_id || "").trim();
  if (!requestId || !batchId) return { ok: false, reason: "tokenization_event_identity_incomplete" };
  const executionClass = String(input.request.execution_class || "").trim().toLowerCase();
  const network = String(input.request.network || "").trim().toLowerCase();
  const meta = asRecord(input.request.meta);
  if (input.state === "anchored") {
    if (
      !new Set(["testnet_trial", "live_chain"]).has(executionClass)
      || !new Set(["polygon-amoy", "polygon"]).has(network)
      || meta.evidence_verified !== true
      || !String(input.request.token_id || "").trim()
    ) {
      return { ok: false, reason: "tokenization_anchor_evidence_not_verified" };
    }
  }
  if (
    input.state === "simulated"
    && (
      executionClass !== "simulation"
      || network !== "simulation"
      || input.request.tx_hash
      || input.request.token_id
      || input.request.anchor_hash
    )
  ) {
    return { ok: false, reason: "tokenization_simulation_truth_invalid" };
  }
  const simulated = input.state === "simulated" || executionClass === "simulation";
  const eventName = input.state === "anchored"
    ? "tokenization.anchored" as const
    : input.state === "simulated"
      ? "tokenization.simulated" as const
      : "tokenization.requested" as const;
  const eventType = input.state === "anchored"
    ? "TOKENIZATION_ANCHORED"
    : input.state === "simulated"
      ? "TOKENIZATION_SIMULATED"
      : "TOKENIZATION_REQUESTED";

  try {
    const receipt = await writeCanonicalEvent({
      operationKey: `tokenization:${requestId}:${input.state}`,
      eventName,
      mode: simulated ? "simulated" : "live",
      family: "lifecycle",
      batchId,
      eventType,
      result: eventType,
      verdict: "valid",
      riskLevel: "none",
      reason: input.state === "anchored"
        ? "polygon_evidence_verified"
        : input.state === "simulated"
          ? "tokenization_simulation_completed"
          : "tokenization_request_persisted",
      meta: {
        processor: String(input.processor || "tokenization_engine").slice(0, 120),
        tokenization_request_id: requestId,
      },
      webhookData: {
        requestId,
        status: input.state,
        network: input.state === "simulated" ? "simulation" : network.slice(0, 80),
        txHash: input.state === "anchored" && input.request.tx_hash ? String(input.request.tx_hash).slice(0, 180) : null,
        tokenId: input.state === "anchored" && input.request.token_id ? String(input.request.token_id).slice(0, 180) : null,
        evidenceVerified: input.state === "anchored",
      },
    });
    return { ok: true, receipt };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof CanonicalEventWriteError ? error.code : "canonical_event_write_unavailable",
    };
  }
}
