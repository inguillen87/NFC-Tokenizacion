import { sql } from "./db";

export type TapCommercialRightsEvidence = {
  result?: unknown;
  reason?: unknown;
  manual_tamper_status?: unknown;
  manual_tamper_reason?: unknown;
  manualTamperStatus?: unknown;
  manualTamperReason?: unknown;
};

export type TapCommercialRightsDecision = {
  allowed: boolean;
  reason: "eligible" | "manual_opening_declared" | "event_not_found" | "rights_evidence_unavailable";
  manualOpeningDeclared: boolean;
};

function normalized(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function containsManualOpeningReason(value: unknown) {
  const reason = normalized(value).replace(/[\s-]+/g, "_");
  return reason.includes("MANUAL_TAMPER_OPENED")
    || reason.includes("MANUAL_OPENED")
    || reason.includes("OPERATOR_DECLARED_OPEN");
}

/**
 * A manual declaration is operational evidence, never a chip verdict. Keep
 * `events.result` untouched and combine both sources only when deciding
 * whether a commercial action may execute.
 */
export function isManualOpeningDeclared(input: TapCommercialRightsEvidence | null | undefined) {
  if (!input) return false;
  const status = normalized(input.manual_tamper_status ?? input.manualTamperStatus);
  const result = normalized(input.result);
  return result === "MANUAL_OPENED"
    || result === "VALID_MANUAL_OPENED"
    || status === "MANUAL_OPENED"
    || status === "OPENED"
    || containsManualOpeningReason(input.manual_tamper_reason ?? input.manualTamperReason)
    || containsManualOpeningReason(input.reason);
}

export function evaluateTapCommercialRights(input: TapCommercialRightsEvidence | null | undefined): TapCommercialRightsDecision {
  if (!input) return { allowed: false, reason: "event_not_found", manualOpeningDeclared: false };
  const manualOpeningDeclared = isManualOpeningDeclared(input);
  if (manualOpeningDeclared) {
    return { allowed: false, reason: "manual_opening_declared", manualOpeningDeclared: true };
  }
  return { allowed: true, reason: "eligible", manualOpeningDeclared: false };
}

/**
 * Re-reads the durable override instead of trusting a fresh-token snapshot.
 * Database errors fail closed: a commercial sink must never silently proceed
 * when the current rights evidence cannot be established.
 */
export async function readCurrentTapCommercialRights(eventId: string | number): Promise<TapCommercialRightsDecision> {
  try {
    const rows = await sql/*sql*/`
      SELECT
        event.result,
        event.reason,
        manual_override.tamper_status AS manual_tamper_status,
        manual_override.reason AS manual_tamper_reason
      FROM events event
      LEFT JOIN tag_manual_tamper_overrides manual_override
        ON manual_override.batch_id = event.batch_id
       AND UPPER(manual_override.uid_hex) = UPPER(event.uid_hex)
      WHERE event.id = ${String(eventId)}::bigint
      LIMIT 1
    `;
    if (!rows[0]) return { allowed: false, reason: "event_not_found", manualOpeningDeclared: false };
    return evaluateTapCommercialRights(rows[0]);
  } catch {
    return { allowed: false, reason: "rights_evidence_unavailable", manualOpeningDeclared: false };
  }
}
