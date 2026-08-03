export type SunSecureCarrierProfileCode = "ntag424_dna" | "ntag424_dna_tt";

export type SunAuthenticatedProductState =
  | "VALID_AUTHENTIC"
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER"
  | "SUN_PROFILE_MISMATCH";

export type TagTamperPresentationState =
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY";

const TT_PRODUCT_STATES = new Set<SunAuthenticatedProductState>([
  "VALID_CLOSED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_UNKNOWN_TAMPER",
]);

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function resolveSunSecureCarrierProfile(input: {
  carrierProfileCode?: unknown;
  sdmConfig?: unknown;
}): SunSecureCarrierProfileCode | null {
  const cfg = input.sdmConfig && typeof input.sdmConfig === "object"
    ? input.sdmConfig as Record<string, unknown>
    : {};
  const explicit = normalized(input.carrierProfileCode || cfg.carrier_profile_code);
  if (explicit === "ntag424_dna_tt") return "ntag424_dna_tt";
  if (explicit === "ntag424_dna") return "ntag424_dna";

  // Compatibility for old batches that predate carrier_profile_code. This is
  // deliberately narrow: the substring "424" alone never means TagTamper.
  const chip = normalized(cfg.chip_model || cfg.chip || cfg.tag_type);
  if (/tag.?tamper/.test(chip) || /424.*(?:dna.*)?(?:_|-|\s)tt$/.test(chip)) return "ntag424_dna_tt";
  if (/424/.test(chip) && /dna/.test(chip)) return "ntag424_dna";
  return null;
}

export function carrierSupportsTagTamper(profile: unknown): boolean {
  return normalized(profile) === "ntag424_dna_tt";
}

/**
 * Consumer copy may describe a physical opening state only when the exact
 * TagTamper carrier and the complete two-byte TTStatus value agree. Derived
 * booleans, one-byte compatibility fields and product-state strings are not
 * independent evidence at this boundary.
 */
export function resolveTagTamperPresentationEvidence(input: {
  carrierProfileCode?: unknown;
  ttRaw?: unknown;
}): { raw: string | null; state: TagTamperPresentationState | null } {
  if (!carrierSupportsTagTamper(input.carrierProfileCode)) {
    return { raw: null, state: null };
  }
  const raw = String(input.ttRaw || "").trim().toUpperCase();
  if (!/^[0-9A-F]{4}$/.test(raw)) return { raw: null, state: null };
  if (raw === "4343") return { raw, state: "VALID_CLOSED" };
  if (raw === "4F4F") return { raw, state: "VALID_OPENED" };
  if (raw === "4F43") return { raw, state: "VALID_OPENED_PREVIOUSLY" };
  return { raw, state: null };
}

export function resolveAuthenticatedCarrierState(input: {
  carrierProfileCode: unknown;
  cryptographicVerification: boolean;
  ttProductState?: unknown;
}): SunAuthenticatedProductState {
  if (!input.cryptographicVerification) return "SUN_PROFILE_MISMATCH";
  const profile = normalized(input.carrierProfileCode);
  if (profile === "ntag424_dna") return "VALID_AUTHENTIC";
  if (profile !== "ntag424_dna_tt") return "SUN_PROFILE_MISMATCH";

  const ttState = String(input.ttProductState || "").trim().toUpperCase() as SunAuthenticatedProductState;
  return TT_PRODUCT_STATES.has(ttState) ? ttState : "VALID_UNKNOWN_TAMPER";
}
