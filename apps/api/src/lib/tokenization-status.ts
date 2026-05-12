export const TOKENIZATION_STATUS = {
  NONE: "none",
  SIMULATED: "simulated",
  PENDING: "pending",
  PROCESSING: "processing",
  PENDING_RETRY: "pending_retry",
  ANCHORED: "anchored",
  FAILED: "failed",
  BLOCKED: "blocked",
} as const;

export type TokenizationStatus = (typeof TOKENIZATION_STATUS)[keyof typeof TOKENIZATION_STATUS];

export function normalizeTokenizationStatus(input: unknown): TokenizationStatus {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw || raw === "null" || raw === "undefined") return TOKENIZATION_STATUS.NONE;
  if (raw === "minted" || raw === "minted_on_chain" || raw === "polygon_minted") return TOKENIZATION_STATUS.ANCHORED;
  if (raw === "sandbox_ready" || raw === "sandbox" || raw === "mock" || raw === "simulated_mint") return TOKENIZATION_STATUS.SIMULATED;
  if (raw === "requested" || raw === "queued" || raw === "mint_pending") return TOKENIZATION_STATUS.PENDING;
  if (raw === "mint_pending_retry" || raw === "retry" || raw === "queued_retry") return TOKENIZATION_STATUS.PENDING_RETRY;
  if (raw === "mint_failed" || raw === "errored" || raw === "error") return TOKENIZATION_STATUS.FAILED;
  if (raw.startsWith("blocked")) return TOKENIZATION_STATUS.BLOCKED;
  if (
    raw === TOKENIZATION_STATUS.NONE ||
    raw === TOKENIZATION_STATUS.SIMULATED ||
    raw === TOKENIZATION_STATUS.PENDING ||
    raw === TOKENIZATION_STATUS.PROCESSING ||
    raw === TOKENIZATION_STATUS.PENDING_RETRY ||
    raw === TOKENIZATION_STATUS.ANCHORED ||
    raw === TOKENIZATION_STATUS.FAILED ||
    raw === TOKENIZATION_STATUS.BLOCKED
  ) {
    return raw as TokenizationStatus;
  }
  return TOKENIZATION_STATUS.PENDING;
}
