export const REPORT_CATEGORIES = ["tap_review", "seal_opened", "product_problem", "other"] as const;
export type ReportCategory = typeof REPORT_CATEGORIES[number];
export type ReportLocale = "es-AR" | "en" | "pt-BR";
export type ReportProblemProps = { bid: string; eventId: string; supportToken: string; productName: string; locale: ReportLocale; isDemoPreview?: boolean };
export type ReportContext = { bid: string; eventId: string; supportToken: string; isDemoPreview?: boolean };
export type ReportDraft = { category: string; description: string; contact: string };
export type ReportFields = { category: ReportCategory; description: string; contact: string };
export type ReportFieldErrors = Partial<Record<keyof ReportDraft, "required" | "too_long" | "invalid">>;
export type ReportAttempt = ReportFields & { bid: string; event_id: string; support_token: string; request_id: string; locale: ReportLocale };
export type ReportOutcome = { kind: "received"; ticket: { id: string; status: "open" | "pending" | "closed"; createdAt: string }; existing: boolean }
  | { kind: "expired" | "rate_limited" | "unavailable" | "conflict" | "invalid" | "uncertain" | "context_unavailable" };
type Preparation = { ok: true; attempt: ReportAttempt } | { ok: false; errors: ReportFieldErrors; reason?: "context_unavailable" | "resolve_attempt" | "request_id_unavailable" };
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

export function reportContextAvailable(context: ReportContext) {
  return !context.isDemoPreview && typeof context.bid === "string" && Boolean(context.bid.trim()) && context.bid.length <= 200
    && !/[\u0000-\u001f\u007f]/.test(context.bid) && typeof context.eventId === "string"
    && /^[1-9]\d{0,18}$/.test(context.eventId) && BigInt(context.eventId) <= 9223372036854775807n
    && typeof context.supportToken === "string" && context.supportToken.length > 0 && context.supportToken.length <= 4096
    && !/[\u0000-\u0020\u007f]/.test(context.supportToken);
}

export function validateReportDraft(draft: ReportDraft): { fields: ReportFields | null; errors: ReportFieldErrors } {
  const errors: ReportFieldErrors = {};
  const description = typeof draft.description === "string" ? draft.description.replace(/\r\n?/g, "\n").trim() : "";
  const contact = typeof draft.contact === "string" ? draft.contact.trim() : "";
  if (!REPORT_CATEGORIES.includes(draft.category as ReportCategory)) errors.category = "invalid";
  if (!description) errors.description = "required";
  else if (description.length > 1500) errors.description = "too_long";
  else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(description)) errors.description = "invalid";
  if (contact.length > 320) errors.contact = "too_long";
  else if (/[\u0000-\u001f\u007f]/.test(contact)) errors.contact = "invalid";
  return { fields: Object.keys(errors).length ? null : { category: draft.category as ReportCategory, description, contact }, errors };
}

function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function isoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value), day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10) ? date.toISOString() : null;
}

/** Only a scoped, persisted ticket receipt confirms submission. */
export function reportProblemOutcome(status: number, raw: unknown, expected: Pick<ReportAttempt, "bid" | "event_id">): ReportOutcome {
  const payload = record(raw), ticket = record(payload.ticket), createdAt = isoDate(ticket.created_at);
  if (status >= 200 && status < 300 && payload.ok === true && payload.ticket_created === true
    && ["ticket_created", "ticket_existing"].includes(String(payload.outcome)) && payload.eventId === expected.event_id && payload.bid === expected.bid
    && typeof ticket.id === "string" && UUID.test(ticket.id) && ticket.tenant_assigned === true
    && ["open", "pending", "closed"].includes(String(ticket.status)) && createdAt) {
    return { kind: "received", ticket: { id: ticket.id, status: ticket.status as "open" | "pending" | "closed", createdAt }, existing: payload.outcome === "ticket_existing" };
  }
  if (status === 403) return { kind: "expired" };
  if (status === 429) return { kind: "rate_limited" };
  if (status === 409) return { kind: "conflict" };
  if (status === 400 || status === 422) return { kind: "invalid" };
  if (status === 503) return { kind: "unavailable" };
  return { kind: "uncertain" };
}

type Transport = (body: ReportAttempt, signal?: AbortSignal) => Promise<{ status: number; payload: unknown }>;

export async function readReportProblemResponse(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024) throw new Error("report_response_too_large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** In-memory idempotency: uncertain retries retain exactly the reviewed details. */
export function createReportProblemRunner(transport: Transport, createId: () => string) {
  let attempt: ReportAttempt | null = null;
  let outcome: ReportOutcome | null = null;
  let pending = false;
  let unresolved = false;
  const key = (value: ReportAttempt) => JSON.stringify([value.bid, value.event_id, value.category, value.description, value.contact, value.locale]);
  return {
    current: () => ({ attempt, outcome, pending, unresolved }),
    prepare(context: ReportContext, draft: ReportDraft, locale: ReportLocale): Preparation {
      if (!reportContextAvailable(context)) return { ok: false, errors: {}, reason: "context_unavailable" };
      const validation = validateReportDraft(draft);
      if (!validation.fields) return { ok: false, errors: validation.errors };
      if (!["es-AR", "en", "pt-BR"].includes(locale)) return { ok: false, errors: {}, reason: "context_unavailable" };
      const candidate = { ...validation.fields, bid: context.bid, event_id: context.eventId, support_token: context.supportToken, locale, request_id: "" };
      if (pending || outcome?.kind === "received") return { ok: false, errors: {}, reason: "resolve_attempt" };
      if (attempt && (unresolved || outcome?.kind === "rate_limited") && key(candidate) !== key(attempt)) return { ok: false, errors: {}, reason: "resolve_attempt" };
      if (attempt && key(candidate) === key(attempt) && (outcome?.kind !== "conflict" || unresolved)) candidate.request_id = attempt.request_id;
      else {
        try { candidate.request_id = createId(); } catch { return { ok: false, errors: {}, reason: "request_id_unavailable" }; }
        if (!UUID.test(candidate.request_id)) return { ok: false, errors: {}, reason: "request_id_unavailable" };
      }
      attempt = Object.freeze(candidate);
      outcome = null;
      return { ok: true, attempt };
    },
    async submit(context: ReportContext, signal?: AbortSignal): Promise<ReportOutcome | null> {
      if (pending || !attempt || outcome?.kind === "received" || outcome?.kind === "conflict") return null;
      if (!reportContextAvailable(context) || context.bid !== attempt.bid || context.eventId !== attempt.event_id) return { kind: "context_unavailable" };
      pending = true;
      // A renewed credential can retry the same reviewed request. It does not
      // change the event, details, locale or idempotency identity.
      const request = { ...attempt, support_token: context.supportToken };
      try {
        const response = await transport(request, signal);
        outcome = reportProblemOutcome(response.status, response.payload, request);
      } catch { outcome = { kind: "uncertain" }; }
      finally { pending = false; }
      if (outcome.kind === "uncertain" || outcome.kind === "unavailable") unresolved = true;
      else if (outcome.kind === "received") unresolved = false;
      return outcome;
    },
  };
}
