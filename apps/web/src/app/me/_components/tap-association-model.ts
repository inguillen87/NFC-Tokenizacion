export const TAP_ASSOCIATION_ACTIONS = ["save", "join", "claim", "rewards"] as const;
export type TapAssociationAction = typeof TAP_ASSOCIATION_ACTIONS[number];
export type TapAssociationContext = { eventId: string; tenant: string; bid: string; preferred: TapAssociationAction | null; key: string };
export type TapAssociationOutcome = "saved" | "linked" | "claimed" | "enrolled" | "recorded_pending" | "committed_unknown"
  | "review_required" | "fresh_required" | "session_required" | "no_program" | "blocked" | "unconfirmed";
export type TapAssociationResult = { outcome: TapAssociationOutcome; retryable: boolean };
export type TapAssociationState = { pending: TapAssociationAction | null; results: Partial<Record<TapAssociationAction, TapAssociationResult>> };
export type TapAssociationSession = "checking" | "active" | "none" | "unavailable";
const ENDPOINTS: Record<TapAssociationAction, string> = { save: "consumer/save-product", join: "consumer/join-tenant", claim: "consumer/claim", rewards: "loyalty/enroll" };

export function tapAssociationContext(params: URLSearchParams): TapAssociationContext | null {
  if (!["1", "true", "yes"].includes((params.get("fromTap") || "").toLowerCase())) return null;
  for (const key of ["fromTap", "eventId", "tenant", "bid", "action"]) if (params.getAll(key).length > 1) return null;
  const eventId = params.get("eventId") || "";
  if (!/^[1-9]\d{0,18}$/.test(eventId) || BigInt(eventId) > 9223372036854775807n) return null;
  const tenant = (params.get("tenant") || "").trim(), bid = (params.get("bid") || "").trim();
  if (tenant.length > 120 || bid.length > 200 || /[\u0000-\u001f\u007f]/.test(tenant + bid)) return null;
  const action = (params.get("action") || "").trim().toLowerCase();
  const preferred = action === "products" ? "save" : TAP_ASSOCIATION_ACTIONS.find(value => value === action) || null;
  return { eventId, tenant, bid, preferred, key: JSON.stringify([eventId, tenant, bid, preferred]) };
}
export function tapAssociationLoginHref(context: TapAssociationContext) {
  const query = new URLSearchParams({ fromTap: "1", eventId: context.eventId });
  if (context.tenant) query.set("tenant", context.tenant);
  if (context.bid) query.set("bid", context.bid);
  if (context.preferred) query.set("action", context.preferred);
  return "/login?consumer=1&next=" + encodeURIComponent("/me?" + query.toString());
}
export function tapAssociationRequest(context: TapAssociationContext, action: TapAssociationAction, locale: string) {
  if (!TAP_ASSOCIATION_ACTIONS.includes(action)) throw new Error("tap_association_action_invalid");
  return { path: `/api/mobile/passport/${encodeURIComponent(context.eventId)}/${ENDPOINTS[action]}`,
    body: { ...(context.tenant ? { tenantSlug: context.tenant } : {}), ...(context.bid ? { bid: context.bid } : {}),
      ...(action === "rewards" ? { locale: ["es-AR", "en", "pt-BR"].includes(locale) ? locale : "es-AR" } : {}) } };
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function tapAssociationSession(status: number, raw: unknown): TapAssociationSession {
  const payload = record(raw);
  if (status === 401 || (status >= 200 && status < 300 && payload.authenticated === false)) return "none";
  return status >= 200 && status < 300 && payload.ok === true && payload.authenticated === true ? "active" : "unavailable";
}
/** HTTP success alone never grants an entitlement. */
export function tapAssociationResult(action: TapAssociationAction, eventId: string, status: number, raw: unknown): TapAssociationResult {
  const payload = record(raw), ownership = record(payload.ownership), member = record(payload.member), membership = record(payload.membership);
  const success = status >= 200 && status < 300 && payload.ok === true;
  const claimed = ownership.status === "claimed" && (payload.ownership_scope === "nexid_off_chain_digital_title" || ownership.record_scope === "nexid_off_chain_digital_title");
  if (payload.operation_committed === true) return { outcome: action === "claim" && claimed ? "recorded_pending" : "committed_unknown", retryable: false };
  if (success) {
    if (action === "save" && payload.saved === true && String(payload.eventId) === eventId) return { outcome: "saved", retryable: false };
    if (action === "join" && typeof membership.id === "string" && membership.id && membership.status === "active") return { outcome: "linked", retryable: false };
    if (action === "claim" && claimed && String(payload.eventId) === eventId) return { outcome: "claimed", retryable: false };
    if (action === "rewards" && payload.enrollment_status === "enrolled" && typeof member.id === "string" && member.id && member.status === "enrolled") return { outcome: "enrolled", retryable: false };
  }
  const error = String(payload.error || payload.reason || "");
  if (status === 401) return { outcome: "session_required", retryable: true };
  if (["fresh_tap_capability_required", "fresh_physical_tap_required_for_ownership", "snapshot_blocked", "pin_required", "invalid_pin", "claim_pin_locked"].includes(error)) return { outcome: "fresh_required", retryable: false };
  if (error === "ownership_manual_review_required" || payload.review_required === true) return { outcome: "review_required", retryable: false };
  if (error === "no_active_program") return { outcome: "no_program", retryable: false };
  if ([400, 403, 404, 409, 422].includes(status)) return { outcome: "blocked", retryable: false };
  return { outcome: "unconfirmed", retryable: true };
}
type Transport = (path: string, body: Record<string, unknown>, signal: AbortSignal) => Promise<{ status: number; payload: unknown }>;
/** One explicit request at a time; committed actions cannot be resent.
 * State belongs to this mounted context, never browser storage or a token.
 * A lost response does not guarantee the server performed no work.
 */
export function createTapAssociationRunner(context: TapAssociationContext, transport: Transport) {
  let state: TapAssociationState = { pending: null, results: {} };
  let disposed = false;
  let controller: AbortController | null = null;
  const listeners = new Set<(state: TapAssociationState) => void>();
  const emit = () => { for (const listener of listeners) listener(state); };
  return {
    state: () => state,
    subscribe(listener: (state: TapAssociationState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { disposed = true; controller?.abort(); listeners.clear(); },
    async run(action: TapAssociationAction, locale = "es-AR") {
      if (disposed || state.pending || !TAP_ASSOCIATION_ACTIONS.includes(action) || state.results[action]?.retryable === false) return null;
      state = { ...state, pending: action }; emit();
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), 15000);
      let result: TapAssociationResult;
      try {
        const request = tapAssociationRequest(context, action, locale);
        const response = await transport(request.path, request.body, controller.signal);
        result = tapAssociationResult(action, context.eventId, response.status, response.payload);
      } catch { result = { outcome: "unconfirmed", retryable: true }; }
      finally { clearTimeout(timer); }
      if (disposed) return null;
      state = { pending: null, results: { ...state.results, [action]: result } }; emit();
      return result;
    },
  };
}
