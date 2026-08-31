const PUBLIC_LOT_LABEL_KEYS = ["public_lot_label", "lot", "batch_lot", "lot_number"] as const;

export const MAX_PUBLIC_LOT_LABEL_LENGTH = 160;

export type PublicLotLabelInput =
  | { ok: true; value: string | null }
  | { ok: false; reason: "public_lot_label_invalid_type" | "public_lot_label_too_long" };

/**
 * Normalizes the explicit tenant-managed display label before persistence.
 *
 * The write contract accepts only a string or null, keeps the label on one
 * readable line and rejects oversized values instead of silently truncating
 * admin input.
 */
export function normalizePublicLotLabelInput(value: unknown): PublicLotLabelInput {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, reason: "public_lot_label_invalid_type" };
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > MAX_PUBLIC_LOT_LABEL_LENGTH) {
    return { ok: false, reason: "public_lot_label_too_long" };
  }

  return { ok: true, value: normalized };
}

/**
 * Resolves the consumer-facing lot label from the batch configuration.
 *
 * `batches.bid` remains the immutable operational identifier. This helper only
 * exposes an optional display label explicitly configured by the tenant.
 */
export function resolvePublicLotLabel(config: Record<string, unknown> | null | undefined) {
  if (!config) return null;

  for (const key of PUBLIC_LOT_LABEL_KEYS) {
    const value = config[key];
    if (typeof value !== "string" && typeof value !== "number") continue;

    const normalized = String(value).trim();
    if (normalized) return normalized.slice(0, MAX_PUBLIC_LOT_LABEL_LENGTH);
  }

  return null;
}
