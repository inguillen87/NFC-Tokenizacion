import type { TapAssociationAction, TapAssociationContext } from "./tap-association-model";

export const TAP_ELIGIBILITY_SCHEMA = "nexid.consumer-tap-eligibility/v1";
export const ELIGIBILITY_ACTIONS = ["save", "join", "rewards", "claim"] as const;
export type EligibilityAction = typeof ELIGIBILITY_ACTIONS[number];
export type EligibilityDecision = { allowed: boolean; reason: string; freshTapRequired: boolean };
export type ClaimEligibilityDecision = EligibilityDecision & { nextStep: "confirm" | "enter_pin" | "blocked" };
export type TapEligibility = {
  state: "ready" | "session_required" | "fresh_required" | "blocked" | "unavailable";
  actions: Record<Exclude<EligibilityAction, "claim">, EligibilityDecision> & { claim: ClaimEligibilityDecision };
};
type Payload = Record<string, unknown>;
const record = (value: unknown): Payload | null => value && typeof value === "object" && !Array.isArray(value) ? value as Payload : null;
const REASONS = new Set([
  "allowed", "tap_action_not_allowed", "event_security_blocked", "tenant_setup_required", "tap_policy_indeterminate",
  "membership_inactive", "program_unavailable", "member_inactive", "fresh_tap_required", "eligibility_unavailable",
  "claim_policy_configuration_required", "ownership_manual_approval_required", "pos_activation_pending",
  "retailer_attestation_required", "purchase_receipt_required", "pin_policy_misconfigured", "ownership_already_claimed",
]);
const empty = (state: TapEligibility["state"], reason: string, freshTapRequired = false): TapEligibility => ({
  state, actions: { save: { allowed: false, reason, freshTapRequired }, join: { allowed: false, reason, freshTapRequired },
    rewards: { allowed: false, reason, freshTapRequired }, claim: { allowed: false, reason, freshTapRequired, nextStep: "blocked" } },
});

/** Interpret the private server receipt; query parameters never authorize an action. */
export function tapEligibilityReceipt(context: TapAssociationContext, status: number, raw: unknown): TapEligibility {
  if (status === 401) return empty("session_required", "unauthorized");
  const payload = record(raw);
  if (status === 403 && payload?.freshTapRequired === true && payload.error === "fresh_tap_required") {
    return empty("fresh_required", "fresh_tap_required", true);
  }
  if (status === 400 && payload?.error === "invalid_context") return empty("blocked", "invalid_context");
  if (status !== 200 || payload?.ok !== true || payload.schema !== TAP_ELIGIBILITY_SCHEMA || payload.eventId !== context.eventId) {
    return empty("unavailable", "eligibility_unavailable");
  }
  const source = record(payload.actions);
  if (!source) return empty("unavailable", "eligibility_unavailable");
  const actions = {} as TapEligibility["actions"];
  for (const action of ELIGIBILITY_ACTIONS) {
    const row = record(source[action]);
    if (!row || typeof row.allowed !== "boolean" || typeof row.freshTapRequired !== "boolean"
      || typeof row.reason !== "string" || !REASONS.has(row.reason)
      || row.allowed !== (row.reason === "allowed")
      || row.freshTapRequired !== (row.reason === "fresh_tap_required")) return empty("unavailable", "eligibility_unavailable");
    const decision = { allowed: row.allowed, reason: row.reason, freshTapRequired: row.freshTapRequired };
    if (action === "claim") {
      if (row.allowed ? row.nextStep !== "confirm" && row.nextStep !== "enter_pin" : row.nextStep !== "blocked") return empty("unavailable", "eligibility_unavailable");
      actions.claim = { ...decision, nextStep: row.nextStep as ClaimEligibilityDecision["nextStep"] };
    } else actions[action] = decision;
  }
  // The API checks composite business policy. Capabilities are one-use per
  // named action, so one spent action does not imply all other actions are spent.
  return { state: "ready", actions };
}

/** The claim decision allows an attempt, never certifies ownership. POST remains authoritative. */
export function tapEligibilityAllows(value: TapEligibility | null, action: TapAssociationAction) {
  return value?.state === "ready" && value.actions[action].allowed;
}

export function tapEligibilityRequest(context: TapAssociationContext) {
  const query = new URLSearchParams({ eventId: context.eventId });
  if (context.tenant) query.set("tenant", context.tenant);
  if (context.bid) query.set("bid", context.bid);
  return { path: "/api/consumer/tap-eligibility?" + query.toString(), init: {
    method: "GET" as const, cache: "no-store" as const, credentials: "include" as const,
    headers: { "x-nexid-consumer-tap-eligibility": "1" },
  } };
}

type Transport = (path: string, init: ReturnType<typeof tapEligibilityRequest>["init"] & { signal: AbortSignal }) => Promise<{ status: number; payload: unknown }>;
/** One explicit read, no polling or POSTs. Discard old-context and disposed replies. */
export function createTapEligibilityReader(transport: Transport, timeoutMs = 8000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error("eligibility_read_timeout_invalid");
  let active: AbortController | null = null, revision = 0, disposed = false;
  return {
    async read(context: TapAssociationContext): Promise<TapEligibility | null> {
      if (disposed) return null;
      active?.abort();
      const controller = new AbortController(), current = ++revision;
      active = controller;
      const request = tapEligibilityRequest(context);
      let timedOut = false, releaseAbort = () => {};
      const aborted = new Promise<null>(resolve => {
        const stop = () => resolve(null);
        controller.signal.addEventListener("abort", stop, { once: true });
        releaseAbort = () => controller.signal.removeEventListener("abort", stop);
      });
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      try {
        const reply = await Promise.race([transport(request.path, { ...request.init, signal: controller.signal }), aborted]);
        if (disposed || current !== revision) return null;
        if (timedOut) return empty("unavailable", "eligibility_unavailable");
        if (!reply || controller.signal.aborted) return null;
        return tapEligibilityReceipt(context, reply.status, reply.payload);
      } catch {
        if (disposed || current !== revision) return null;
        return timedOut || !controller.signal.aborted ? empty("unavailable", "eligibility_unavailable") : null;
      } finally { clearTimeout(timeout); releaseAbort(); if (active === controller) active = null; }
    },
    dispose() { disposed = true; revision++; active?.abort(); active = null; },
  };
}
