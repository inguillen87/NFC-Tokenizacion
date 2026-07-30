export const TAG_LIFECYCLE_STATES = [
  "inactive",
  "active",
  "suspended",
  "quarantined",
  "lost",
  "expired",
  "broken",
  "tampered",
  "revoked",
] as const;

export type TagLifecycleState = typeof TAG_LIFECYCLE_STATES[number];
export type TagOperationalStatus = "inactive" | "active" | "revoked";

const TAG_LIFECYCLE_STATE_SET = new Set<string>(TAG_LIFECYCLE_STATES);

const ALLOWED_TRANSITIONS: Readonly<Record<TagLifecycleState, readonly TagLifecycleState[]>> = Object.freeze({
  inactive: ["active", "quarantined", "revoked"],
  active: ["suspended", "quarantined", "lost", "expired", "broken", "tampered", "revoked"],
  suspended: ["active", "quarantined", "lost", "expired", "broken", "tampered", "revoked"],
  quarantined: ["active", "suspended", "lost", "expired", "broken", "tampered", "revoked"],
  lost: ["quarantined", "revoked"],
  expired: ["revoked"],
  broken: ["revoked"],
  tampered: ["revoked"],
  revoked: [],
});

export function isTagLifecycleState(value: unknown): value is TagLifecycleState {
  return TAG_LIFECYCLE_STATE_SET.has(String(value || "").trim().toLowerCase());
}

export function normalizeTagLifecycleState(value: unknown): TagLifecycleState | null {
  const normalized = String(value || "").trim().toLowerCase();
  return isTagLifecycleState(normalized) ? normalized : null;
}

export function allowedTagLifecycleTransitions(current: TagLifecycleState) {
  return [...ALLOWED_TRANSITIONS[current]];
}

export function evaluateTagLifecycleTransition(current: unknown, next: unknown) {
  const currentState = normalizeTagLifecycleState(current);
  const nextState = normalizeTagLifecycleState(next);
  if (!currentState) return { ok: false as const, reason: "current_lifecycle_state_invalid" };
  if (!nextState) return { ok: false as const, reason: "next_lifecycle_state_invalid" };
  if (currentState === nextState) return { ok: false as const, reason: "lifecycle_transition_noop" };
  if (!ALLOWED_TRANSITIONS[currentState].includes(nextState)) {
    return {
      ok: false as const,
      reason: "lifecycle_transition_not_allowed",
      currentState,
      nextState,
      allowed: allowedTagLifecycleTransitions(currentState),
    };
  }
  return { ok: true as const, currentState, nextState };
}

export function operationalStatusForLifecycle(state: TagLifecycleState): TagOperationalStatus {
  if (state === "active") return "active";
  if (state === "revoked") return "revoked";
  return "inactive";
}

/**
 * Business lifecycle can tighten a successfully verified NFC message, but it
 * never makes an invalid cryptographic message valid. The caller must only use
 * this override after its existing SUN/payload verification gates succeed.
 */
export function lifecycleResultOverride(state: TagLifecycleState | null) {
  if (state === "revoked") return "REVOKED" as const;
  if (state === "broken") return "BROKEN" as const;
  if (state === "tampered") return "TAMPER_RISK" as const;
  if (["inactive", "suspended", "quarantined", "lost", "expired"].includes(state || "")) {
    return "NOT_ACTIVE" as const;
  }
  return null;
}

export function lifecycleRiskLevel(state: TagLifecycleState | null) {
  if (state === "revoked" || state === "broken") return "critical" as const;
  if (state === "tampered" || state === "lost" || state === "quarantined") return "high" as const;
  if (state === "expired" || state === "suspended" || state === "inactive") return "medium" as const;
  return "none" as const;
}

