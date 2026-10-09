import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { json } from "./http";
import { sql, type SqlExecutor } from "./db";
import { allowedSommelierOrigin, DEMO_GRANT_SECONDS, issueSommelierDemoGrant, readSommelierDemoCookie, resolveConsumerSommelierContext, sommelierCallerHash, sommelierDemoCookie, sommelierIssuanceHash, verifySommelierDemoGrant, type SommelierEnv } from "./sommelier-access";
import { parseSommelierRequest, sommelierLocale, type SommelierContext, type SommelierRequest } from "./sommelier-contract";
import { valleSecretoSommelierFacts } from "./sommelier-demo-facts";
import { syngentaGuideFacts } from "./syngenta-guide-facts";
import { requestLiveSommelier } from "./sommelier-provider";
import { reserveSommelierBuckets, sommelierChatBuckets, sommelierIssuanceBuckets, sommelierProviderBuckets } from "./sommelier-quota";
type Dependencies = { env?: SommelierEnv; query?: SqlExecutor; provider?: (input: SommelierRequest, context: SommelierContext, env: SommelierEnv, options: { signal: AbortSignal; deadlineMs: number }) => ReturnType<typeof requestLiveSommelier>; now?: () => number; resolveConsumer?: typeof resolveConsumerSommelierContext };
const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const fail = (reason: string, status: number, retryAfter?: number) => json({ ok: false, reason }, status, { ...HEADERS, ...(retryAfter ? { "retry-after": String(retryAfter) } : {}) });
function preflight(req: Request, env: SommelierEnv, path: string) {
  const url = new URL(req.url);
  if (req.method !== "POST" || url.pathname !== path || url.search || url.hash) return fail("sommelier_request_invalid", 400);
  if (!allowedSommelierOrigin(req, env)) return fail("sommelier_origin_rejected", 403);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) return fail("sommelier_content_type_required", 415);
  if (env.NEXID_SOMMELIER_ENABLED !== "true") return fail("sommelier_disabled", 503);
  return null;
}
async function boundedHttp(req: Request, work: (signal: AbortSignal, started: number) => Promise<Response>) {
  const controller = new AbortController(), started = Date.now();
  const abort = () => controller.abort();
  if (req.signal.aborted) controller.abort();
  req.signal.addEventListener("abort", abort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(fail("sommelier_timeout", 503)); }, 11_000); });
  try { return await Promise.race([work(controller.signal, started), expiry]); }
  catch (error) { return fail(error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "sommelier_request_unavailable", error instanceof RequestBodyTooLargeError ? 413 : 503); }
  finally { clearTimeout(timer!); req.signal.removeEventListener("abort", abort); controller.abort(); }
}
export async function handleSommelierDemoSession(req: Request, dependencies: Dependencies = {}) {
  const env = dependencies.env || process.env, query = dependencies.query || sql;
  const rejected = preflight(req, env, "/public/sommelier/demo/session");
  if (rejected) return rejected;
  if (env.NEXID_SOMMELIER_DEMO_ENABLED !== "true") return fail("sommelier_demo_disabled", 503);
  return boundedHttp(req, async signal => {
    let raw;
    try { raw = await readBoundedJsonBody<Record<string, unknown>>(req, 1024); } catch (error) { if (error instanceof RequestBodyTooLargeError) throw error; return fail("sommelier_request_invalid", 400); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).some(k => k !== "profile" && k !== "locale") || (raw.profile !== "valle-secreto" && raw.profile !== "syngenta") || !sommelierLocale(raw.locale)) return fail("sommelier_demo_profile_invalid", 400);
    const profile = raw.profile;
    const origin = allowedSommelierOrigin(req, env)!, caller = sommelierCallerHash(req, env), issuance = sommelierIssuanceHash(req, env);
    if (!caller || !issuance) return fail("sommelier_caller_unavailable", 503);
    const now = Math.floor((dependencies.now?.() ?? Date.now()) / 1000);
    const existing = verifySommelierDemoGrant(readSommelierDemoCookie(req, env, profile), origin, caller, env, now, profile);
    // Repeated mounting reuses the current grant; no renewal/quota bypass.
    if (existing) return json({ ok: true, profile, expiresIn: existing.exp - now }, 200, HEADERS);
    if (signal.aborted) return fail("sommelier_timeout", 503);
    const quota = await reserveSommelierBuckets(sommelierIssuanceBuckets(issuance), env, query);
    if (!quota.ok) return fail(quota.reason, quota.reason === "sommelier_quota_unavailable" ? 503 : 429, quota.retryAfter);
    if (signal.aborted) return fail("sommelier_timeout", 503);
    return json({ ok: true, profile, expiresIn: DEMO_GRANT_SECONDS }, 200, { ...HEADERS, "set-cookie": sommelierDemoCookie(issueSommelierDemoGrant(origin, caller, env, now, undefined, profile), env, profile) });
  });
}
export async function handleSommelierChat(req: Request, dependencies: Dependencies = {}) {
  const env = dependencies.env || process.env, query = dependencies.query || sql;
  const rejected = preflight(req, env, "/sommelier/chat");
  if (rejected) return rejected;
  return boundedHttp(req, async (signal, started) => {
    let raw;
    try { raw = await readBoundedJsonBody(req, 12_288); } catch (error) { if (error instanceof RequestBodyTooLargeError) throw error; return fail("sommelier_request_invalid", 400); }
    const input = parseSommelierRequest(raw);
    if (!input) return fail("sommelier_request_invalid", 400);
    const origin = allowedSommelierOrigin(req, env)!, caller = sommelierCallerHash(req, env);
    if (!caller) return fail("sommelier_caller_unavailable", 503);
    if (signal.aborted) return fail("sommelier_timeout", 503);
    let context: SommelierContext, subject: string;
    if (input.mode === "demo") {
      if (env.NEXID_SOMMELIER_DEMO_ENABLED !== "true") return fail("sommelier_demo_disabled", 503);
      const profile = input.demoProfile ?? "valle-secreto";
      const grant = verifySommelierDemoGrant(readSommelierDemoCookie(req, env, profile), origin, caller, env, Math.floor((dependencies.now?.() ?? Date.now()) / 1000), profile);
      if (!grant) return fail("sommelier_demo_session_required", 401);
      context = profile === "syngenta" ? syngentaGuideFacts(input.locale) : valleSecretoSommelierFacts(input.locale);
      subject = `demo:${grant.jti}`;
    } else {
      const consumer = await (dependencies.resolveConsumer || resolveConsumerSommelierContext)(req, input.eventId, input.locale, query);
      if (!consumer) return fail(input.eventId ? "sommelier_event_not_authorized" : "sommelier_consumer_session_required", 403);
      context = consumer.context;
      subject = `consumer:${consumer.consumerId}`;
    }
    if (signal.aborted) return fail("sommelier_timeout", 503);
    const quota = await reserveSommelierBuckets(sommelierChatBuckets(subject, context.tenantId), env, query);
    if (!quota.ok) return fail(quota.reason, quota.reason === "sommelier_quota_unavailable" ? 503 : 429, quota.retryAfter);
    if (signal.aborted) return fail("sommelier_timeout", 503);
    const result = await (dependencies.provider || ((request, ctx, environment, options) => requestLiveSommelier(request, ctx, environment, { ...options, reserve: (tenant, charge) => reserveSommelierBuckets(sommelierProviderBuckets(tenant, charge), environment, query) })))(input, context, env, { signal, deadlineMs: Math.max(1, 11_000 - (Date.now() - started)) });
    return json(context.source === "syngenta_demo" ? { ...result, demo: true, demoProfile: "syngenta", contextSource: "syngenta_demo" } : result, 200, HEADERS);
  });
}
