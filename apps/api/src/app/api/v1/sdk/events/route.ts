export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { normalizeEnterpriseOutboundFields } from "../../../../../lib/enterprise-outbound-event";
import { json } from "../../../../../lib/http";
import { publishRealtimeEvent } from "../../../../../lib/realtime-events";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../lib/sdk-auth";
import { sdkExternalEventAtomicError, writeSdkExternalEventAtomic } from "../../../../../lib/sdk-external-event-writer";
import { asRecord, clean, parseHeaderIp } from "../_shared";
import { enforceSdkAuthenticationRateLimit, enforceSdkRateLimit } from "../../../../../lib/critical-rate-limit";
import { readSdkMutationBody, runSdkIdempotentMutation, SDK_IDEMPOTENCY_OPERATIONS } from "../_idempotency";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const authRateLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authRateLimited) return authRateLimited;
  const auth = await authenticateSdkRequest(req, "sdk:events");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint: "sdk.events", statusCode: auth.response.status, startedAt, reason: "auth_failed" });
    return auth.response;
  }
  const rateLimited = await enforceSdkRateLimit(req, auth.context);
  if (rateLimited) return rateLimited;

  await ensureSdkSchema();
  const parsedBody = await readSdkMutationBody(req, auth.context.traceId);
  if (!parsedBody.ok) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: parsedBody.response.status, startedAt, reason: "invalid_request_body" });
    return parsedBody.response;
  }
  const body = parsedBody.body;
  return runSdkIdempotentMutation({
    req,
    context: auth.context,
    route: SDK_IDEMPOTENCY_OPERATIONS.reportEvent.route,
    body,
    execute: async ({ idempotencyOperationId }) => {
  const eventType = clean(body.eventType || body.event_type);
  const bid = clean(body.bid);
  const uidHex = clean(body.uidHex || body.uid_hex).toUpperCase();
  if (!eventType) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 400, startedAt, reason: "event_type_required" });
    return json({ ok: false, reason: "event_type_required", trace_id: auth.context.traceId }, 400);
  }

  const data = {
    ...asRecord(body.data),
    meta: asRecord(body.meta),
    gps: asRecord(body.gps),
    device: asRecord(body.device || body.deviceMeta || body.device_meta),
    requestIp: parseHeaderIp(req),
    traceId: auth.context.traceId,
  };
  const outbound = normalizeEnterpriseOutboundFields({ eventType, data, body });
  if (!outbound.ok) {
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: "sdk.events",
      statusCode: 400,
      startedAt,
      reason: outbound.reason,
      meta: { eventType, bid: bid || null },
    });
    return json({ ok: false, reason: outbound.reason, trace_id: auth.context.traceId }, 400);
  }

  let persisted;
  try {
    persisted = await writeSdkExternalEventAtomic({
      tenantId: auth.context.tenantId,
      apiKeyId: auth.context.apiKeyId,
      idempotencyOperationId,
      bid: bid || null,
      uidHex: uidHex || null,
      eventType,
      source: clean(body.source) || "sdk",
      occurredAt: clean(body.occurredAt || body.occurred_at) || null,
      data,
      traceId: auth.context.traceId,
      outbound: outbound.fields,
    });
  } catch (error) {
    const mapped = sdkExternalEventAtomicError(error);
    if (!mapped) {
      await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 503, startedAt, reason: "sdk_operation_outcome_uncertain", meta: { eventType, bid: bid || null } });
      return json({
        ok: false,
        reason: "sdk_operation_outcome_uncertain",
        retryable: false,
        operationCommitted: null,
        traceId: auth.context.traceId,
        recovery: idempotencyOperationId
          ? "Query the SDK idempotency status endpoint with the same Idempotency-Key. Do not create a new key or replay the mutation until reconciliation finishes."
          : "Reconcile the external event by traceId before replaying. Requests without an Idempotency-Key cannot be safely auto-retried after an ambiguous transport failure.",
      }, 503, { "x-nexid-trace-id": auth.context.traceId });
    }
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: mapped.status, startedAt, reason: mapped.reason, meta: { eventType, bid: bid || null } });
    return json({
      ok: false,
      reason: mapped.reason,
      retryable: mapped.status >= 500,
      operationCommitted: mapped.operationCommitted,
      ...(mapped.requiredMigration ? { requiredMigration: mapped.requiredMigration } : {}),
      bid: bid || null,
      traceId: auth.context.traceId,
    }, mapped.status, {
      ...(mapped.status >= 500 ? { "retry-after": "2" } : {}),
      "x-nexid-trace-id": auth.context.traceId,
    });
  }
  const eventId = persisted.eventId;
  if (!persisted.replayed) {
    publishRealtimeEvent({
      event_type: "sdk.external_event",
      sdk_event_id: eventId,
      tenant_id: auth.context.tenantId,
      tenant_slug: auth.context.tenantSlug,
      bid: persisted.bid || undefined,
      uid_hex: persisted.uidHex || undefined,
      external_event_type: persisted.eventType,
      created_at: persisted.createdAt,
      trace_id: auth.context.traceId,
    });
  }
  await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 201, startedAt, meta: { eventId, eventType, bid: bid || null } });

  return json({
    ok: true,
    eventId,
    eventType,
    tenant: { slug: auth.context.tenantSlug, name: auth.context.tenantName },
    bid: persisted.bid,
    uidMasked: persisted.uidHex ? `${persisted.uidHex.slice(0, 4)}****${persisted.uidHex.slice(-4)}` : null,
    traceId: auth.context.traceId,
    webhookOutbox: persisted.webhookOutbox,
  }, 201);
    },
  });
}
