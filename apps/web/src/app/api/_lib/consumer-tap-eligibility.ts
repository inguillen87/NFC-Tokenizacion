import "server-only";
import { productUrls } from "@product/config";
import { storedConsumerTapCapability } from "./consumer-tap-handoff";
import { fetchRuntimeApi } from "./server-api-transport";

const WEB_PATH = "/api/consumer/tap-eligibility";
const API_PATH = "/consumer/tap-eligibility";
const SESSION_COOKIE = "nexid_consumer_session";
const INTENT_HEADER = "x-nexid-consumer-tap-eligibility";
const CAPABILITY_HEADER = "x-nexid-consumer-tap-capability";
const SCHEMA = "nexid.consumer-tap-eligibility/v1";
const MAX_RESPONSE_BYTES = 4096;
const PRIVATE_HEADERS = {
  "cache-control": "private, no-store", vary: "Cookie", "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};
const REASONS = new Set([
  "allowed", "tap_action_not_allowed", "event_security_blocked", "tenant_setup_required",
  "tap_policy_indeterminate", "membership_inactive", "program_unavailable", "member_inactive",
  "fresh_tap_required", "eligibility_unavailable",
  "claim_policy_configuration_required", "ownership_manual_approval_required", "pos_activation_pending",
  "retailer_attestation_required", "purchase_receipt_required", "pin_policy_misconfigured", "ownership_already_claimed",
]);
type JsonRecord = Record<string, unknown>;
type EligibilityAction = { allowed: boolean; reason: string; freshTapRequired: boolean };
type EligibilityQuery = { eventId: string; query: URLSearchParams };
type Options = { fetchImpl?: typeof fetch; apiBase?: string; nowMs?: number; timeoutMs?: number };

function failure(status: number, error: string, freshTapRequired = false) {
  return Response.json({ ok: false, error, freshTapRequired }, { status, headers: PRIVATE_HEADERS });
}
function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}
function sameOriginAjax(req: Request, url: URL) {
  if (req.headers.get(INTENT_HEADER) !== "1") return false;
  const origin = req.headers.get("origin"), site = req.headers.get("sec-fetch-site");
  if (origin !== null ? origin !== url.origin : site !== "same-origin") return false;
  if (site !== null && site !== "same-origin") return false;
  const mode = req.headers.get("sec-fetch-mode");
  // Fetch Metadata serializes fetch()'s empty destination as the token "empty".
  const destination = req.headers.get("sec-fetch-dest");
  return (mode === null || mode === "cors" || mode === "same-origin")
    && (destination === null || destination === "" || destination === "empty")
    && !req.headers.has("sec-fetch-user");
}
function eligibilityQuery(url: URL): EligibilityQuery | null {
  const input = url.searchParams;
  if (url.search.length > 1024 || url.hash
    || [...input.keys()].some(key => !["eventId", "tenant", "bid"].includes(key) || input.getAll(key).length !== 1)) return null;
  const eventId = input.get("eventId") ?? "";
  if (!/^[1-9][0-9]{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) return null;
  const query = new URLSearchParams({ eventId });
  for (const key of ["tenant", "bid"] as const) {
    if (!input.has(key)) continue;
    const raw = input.get(key)!;
    if (raw.length > 128 || /[\u0000-\u001f\u007f]/.test(raw)) return null;
    const value = raw.trim();
    if (!value) return null;
    query.set(key, value);
  }
  return { eventId, query };
}
/** Only the consumer session crosses this bridge. Its signature and account are API-owned. */
function sessionCookie(req: Request): string | null {
  const matches = (req.headers.get("cookie") ?? "").split(";").map(part => part.trim()).filter(part => {
    const index = part.indexOf("=");
    return index >= 0 && part.slice(0, index).trim() === SESSION_COOKIE;
  });
  if (matches.length !== 1) return null;
  try {
    const token = decodeURIComponent(matches[0].slice(matches[0].indexOf("=") + 1));
    return /^[a-f0-9]{48}$/.test(token) ? `${SESSION_COOKIE}=${encodeURIComponent(token)}` : null;
  } catch { return null; }
}
function eligibilityAction(value: unknown): EligibilityAction | null {
  const item = record(value);
  if (!item || typeof item.allowed !== "boolean" || typeof item.freshTapRequired !== "boolean"
    || typeof item.reason !== "string" || !REASONS.has(item.reason)) return null;
  if (item.allowed !== (item.reason === "allowed")
    || item.freshTapRequired !== (item.reason === "fresh_tap_required")) return null;
  return { allowed: item.allowed, reason: item.reason, freshTapRequired: item.freshTapRequired };
}
function eligibilityPayload(value: unknown, eventId: string) {
  const payload = record(value), source = record(payload?.actions);
  if (!payload || payload.ok !== true || payload.schema !== SCHEMA || payload.eventId !== eventId || !source) return null;
  const save = eligibilityAction(source.save), join = eligibilityAction(source.join), rewards = eligibilityAction(source.rewards);
  const claimDecision = eligibilityAction(source.claim), claimSource = record(source.claim);
  const nextStep = claimSource?.nextStep;
  if (!claimDecision || (claimDecision.allowed ? nextStep !== "confirm" && nextStep !== "enter_pin" : nextStep !== "blocked")) return null;
  // Permission to attempt a claim is not a confirmed ownership record.
  const claim = { ...claimDecision, nextStep };
  return save && join && rewards ? { ok: true, schema: SCHEMA, eventId, actions: { save, join, rewards, claim } } : null;
}
async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new Error("unavailable");
  const length = response.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new Error("unavailable");
  if (!response.body) throw new Error("unavailable");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0, stop: () => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    stop = () => { void reader.cancel().catch(() => {}); reject(new Error("unavailable")); };
  });
  signal.addEventListener("abort", stop, { once: true });
  try {
    if (signal.aborted) throw new Error("unavailable");
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { void reader.cancel().catch(() => {}); throw new Error("unavailable"); }
      chunks.push(value);
    }
  } finally { signal.removeEventListener("abort", stop); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Advisory, read-only GET. Custody never grants identity, consent, or POST authority. */
export async function proxyConsumerTapEligibility(req: Request, options: Options = {}) {
  const url = new URL(req.url);
  if (req.method !== "GET" || url.pathname !== WEB_PATH) return failure(405, "method_not_allowed");
  if (!sameOriginAjax(req, url)) return failure(403, "same_origin_required");
  const context = eligibilityQuery(url);
  if (!context) return failure(400, "invalid_context");
  const cookie = sessionCookie(req);
  if (!cookie) return failure(401, "unauthorized");
  const capability = storedConsumerTapCapability(req, context.eventId, options.nowMs ?? Date.now());
  if (!capability) return failure(403, "fresh_tap_required", true);
  let base: URL;
  try {
    base = new URL(options.apiBase ?? productUrls.api);
    const local = process.env.NODE_ENV !== "production" && !process.env.VERCEL
      && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/"
      || (base.protocol !== "https:" && !(base.protocol === "http:" && local))) return failure(503, "eligibility_unavailable");
  } catch { return failure(503, "eligibility_unavailable"); }
  const controller = new AbortController();
  let upstream: Response | undefined;
  let stop: () => void = () => {};
  const interrupted = new Promise<Response>(resolve => { stop = () => {
    controller.abort();
    try { void upstream?.body?.cancel().catch(() => {}); } catch { /* Locked body stays private. */ }
    resolve(failure(503, "eligibility_unavailable"));
  }; });
  if (req.signal.aborted) return failure(503, "eligibility_unavailable");
  req.signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, Math.min(12_000, Math.max(1, options.timeoutMs ?? 10_000)));
  const forward = (async () => {
    try {
      const target = new URL(API_PATH, base); target.search = context.query.toString();
      upstream = await (options.fetchImpl ?? fetchRuntimeApi)(target.href, {
        method: "GET", headers: { accept: "application/json", cookie, [CAPABILITY_HEADER]: capability },
        cache: "no-store", redirect: "error", signal: controller.signal,
      });
      if (controller.signal.aborted) { void upstream.body?.cancel().catch(() => {}); return interrupted; }
      if (upstream.redirected || (upstream.status >= 300 && upstream.status < 400)
        || ![200, 400, 401, 403, 503].includes(upstream.status)) {
        void upstream.body?.cancel().catch(() => {});
        return failure(503, "eligibility_unavailable");
      }
      const value = await boundedJson(upstream, controller.signal);
      if (controller.signal.aborted) return interrupted;
      if (upstream.status === 200) {
        const payload = eligibilityPayload(value, context.eventId);
        return payload ? Response.json(payload, { headers: PRIVATE_HEADERS }) : failure(503, "eligibility_unavailable");
      }
      const errors: Record<number, string> = { 400: "invalid_context", 401: "unauthorized", 403: "fresh_tap_required", 503: "eligibility_unavailable" };
      const payload = record(value), error = errors[upstream.status], fresh = upstream.status === 403;
      return payload?.ok === false && payload.error === error && payload.freshTapRequired === fresh
        ? failure(upstream.status, error, fresh) : failure(503, "eligibility_unavailable");
    } catch {
      try { void upstream?.body?.cancel().catch(() => {}); } catch { /* No raw diagnostic leaves this bridge. */ }
      return failure(503, "eligibility_unavailable");
    }
  })();
  try { return await Promise.race([forward, interrupted]); }
  finally { clearTimeout(timer); req.signal.removeEventListener("abort", stop); }
}
