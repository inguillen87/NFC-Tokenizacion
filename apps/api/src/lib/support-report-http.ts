import { json } from "./http";
import { enforceCriticalRateLimit } from "./critical-rate-limit";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { loadSupportReportScope, supportEventId, verifySupportReportCapability, type SupportReportScope } from "./support-report-capability";
import { verifySunFreshHandoffToken } from "./sun-fresh-handoff";
import { parseSupportReportInput, SupportReportError, writeSupportReport } from "./support-report-service";
import { publishRealtimeEvent } from "./realtime-events";
import { recordDemoCta } from "./demo-cta";

const privateHeaders = { "cache-control": "private, no-store", "referrer-policy": "no-referrer", vary: "Cookie" };
type Result = Awaited<ReturnType<typeof writeSupportReport>>;
async function companions(scope: SupportReportScope, result: Result) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled([
        recordDemoCta("problem_report_request", scope.bid, scope.uid || `EVENT-${scope.eventId}`, {
          ticket_id: result.ticket.id, event_id: scope.eventId, tenant_id: scope.tenantId, request_status: result.ticket.status,
          provenance: "durable_support_ticket", // No description, contact, token or fingerprint in analytics.
        }),
        publishRealtimeEvent({ event_type: "ticket.created", ticket_id: result.ticket.id, event_id: scope.eventId,
          tenant_id: scope.tenantId, tenant_slug: scope.tenantSlug, batch_id: scope.batchId, bid: scope.bid,
          source: "durable_support_ticket", status: result.ticket.status, created_at: result.ticket.created_at }),
      ]),
      new Promise<void>(resolve => { timeout = setTimeout(resolve, 1500); }),
    ]);
  } finally { if (timeout) clearTimeout(timeout); }
}
type Dependencies = {
  limit?: typeof enforceCriticalRateLimit; load?: typeof loadSupportReportScope; write?: typeof writeSupportReport;
  verifySupport?: typeof verifySupportReportCapability; verifyFresh?: typeof verifySunFreshHandoffToken;
  companions?: typeof companions;
};
export async function handleSupportReport(req: Request, consumer?: { id: string; eventId: string }, dependencies: Dependencies = {}) {
  const fail = (reason: string, status: number, extra = {}) => json({ ok: false, reason, error: reason, ...extra }, status, privateHeaders);
  try {
    const limited = await (dependencies.limit || enforceCriticalRateLimit)(req, consumer
      ? { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:report-problem` }
      : { rateClass: "proof_write", tenantId: "platform", subjectId: "report-problem:public" });
    if (limited) return limited;
    let body: Record<string, unknown>;
    try { body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024); }
    catch (error) { return fail(error instanceof RequestBodyTooLargeError ? "request_body_too_large" : "invalid_json", error instanceof RequestBodyTooLargeError ? 413 : 400); }
    const input = parseSupportReportInput(body);
    const allowed = ["bid", "event_id", "eventId", "support_token", "supportToken", "request_id", "category", "description", "contact", "locale", "fresh_token", "freshToken", "sun_fresh", "sunFresh"];
    if (Object.keys(body).some(key => !allowed.includes(key))) return fail("report_field_not_allowed", 400);
    if (body.event_id !== undefined && body.eventId !== undefined && body.event_id !== body.eventId) return fail("report_identity_mismatch", 409);
    const eventId = supportEventId(consumer?.eventId || body.event_id || body.eventId);
    if (!eventId) return fail("report_event_required", 400);
    if (consumer && (body.event_id !== undefined && body.event_id !== eventId || body.eventId !== undefined && body.eventId !== eventId)) return fail("report_identity_mismatch", 409);
    if (!consumer && typeof (body.support_token ?? body.supportToken) !== "string") return fail("support_capability_required", 403);
    const scope = await (dependencies.load || loadSupportReportScope)(eventId);
    if (!scope) return fail("support_capability_required", 403);
    if ((!consumer || body.bid !== undefined) && body.bid !== scope.bid) return fail("support_capability_required", 403);
    const hasSupport = Object.hasOwn(body, "support_token") || Object.hasOwn(body, "supportToken");
    if (hasSupport || !consumer) {
      if (body.support_token !== undefined && body.supportToken !== undefined && body.support_token !== body.supportToken) return fail("support_capability_required", 403);
      const verified = (dependencies.verifySupport || verifySupportReportCapability)(body.support_token ?? body.supportToken, scope);
      if (!verified.ok) return fail("support_capability_required", 403);
    } else {
      // A consumer session still needs a scoped bearer capability. Verification
      // does not spend the old fresh token before the ticket is durable.
      const token = body.fresh_token ?? body.freshToken ?? body.sun_fresh ?? body.sunFresh;
      if (typeof token !== "string" || token.length > 4000) return fail("support_capability_required", 403);
      const verified = (dependencies.verifyFresh || verifySunFreshHandoffToken)(token, { eventId: scope.eventId, bid: scope.bid,
        uidHex: scope.uid, readCounter: scope.counter });
      if (!verified.ok) return fail("support_capability_required", 403);
    }
    const result = await (dependencies.write || writeSupportReport)(scope,
      { source: consumer ? "consumer_portal_report" : "sun_public_report", consumerId: consumer?.id || null }, input);
    if (result.outcome === "ticket_created") {
      try { await (dependencies.companions || companions)(scope, result); } catch { /* Ticket remains committed. */ }
    }
    return json(result, result.outcome === "ticket_created" ? 201 : 200, privateHeaders);
  } catch (error) {
    return fail(error instanceof SupportReportError ? error.code : "ticket_persistence_unavailable", error instanceof SupportReportError ? error.status : 503);
  }
}
