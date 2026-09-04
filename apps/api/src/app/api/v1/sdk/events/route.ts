export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { enterprisePayloadContainsSecret, normalizeEnterpriseOutboundFields } from "../../../../../lib/enterprise-outbound-event";
import { json } from "../../../../../lib/http";
import { publishRealtimeEvent } from "../../../../../lib/realtime-events";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../lib/sdk-auth";
import { sdkExternalEventAtomicError, writeSdkExternalEventAtomic } from "../../../../../lib/sdk-external-event-writer";
import { isSdkSensorReadingEventType, normalizeSdkSensorEvent, sdkSensorEvidenceReceipt, sdkSensorReceiptMatchesTarget, SDK_SENSOR_READING_EVENT_TYPE } from "../../../../../lib/sdk-sensor-event";
import { resolveSdkSensorTarget, type SdkSensorTarget } from "../../../../../lib/sdk-sensor-sun-source";
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
  const securityEnvelope = {
    data: body.data,
    meta: body.meta,
    gps: body.gps,
    device: body.device ?? body.deviceMeta ?? body.device_meta,
    connectorConfig: body.connectorConfig ?? body.connector_config,
  };
  if (enterprisePayloadContainsSecret(securityEnvelope)) {
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: "sdk.events",
      statusCode: 400,
      startedAt,
      reason: "enterprise_event_secret_fields_forbidden",
      meta: { eventType: clean(body.eventType || body.event_type) || null, bid: clean(body.bid) || null },
    });
    return json({
      ok: false,
      reason: "enterprise_event_secret_fields_forbidden",
      trace_id: auth.context.traceId,
    }, 400, { "cache-control": "no-store", "x-nexid-trace-id": auth.context.traceId });
  }
  if (
    isSdkSensorReadingEventType(body.eventType || body.event_type)
    && !String(req.headers.get("idempotency-key") || "").trim()
  ) {
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: "sdk.events",
      statusCode: 428,
      startedAt,
      reason: "sdk_sensor_idempotency_key_required",
      meta: { eventType: SDK_SENSOR_READING_EVENT_TYPE, bid: clean(body.bid) || null },
    });
    return json({
      ok: false,
      reason: "sdk_sensor_idempotency_key_required",
      requirement: "Send one stable Idempotency-Key per physical sensor reading and reuse it only when retrying that exact payload.",
      traceId: auth.context.traceId,
    }, 428, { "cache-control": "no-store", "x-nexid-trace-id": auth.context.traceId });
  }
  return runSdkIdempotentMutation({
    req,
    context: auth.context,
    route: SDK_IDEMPOTENCY_OPERATIONS.reportEvent.route,
    body,
    execute: async ({ idempotencyOperationId }) => {
  let eventType = clean(body.eventType || body.event_type);
  let bid = clean(body.bid);
  let uidHex = clean(body.uidHex || body.uid_hex).toUpperCase();
  if (!eventType) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 400, startedAt, reason: "event_type_required" });
    return json({ ok: false, reason: "event_type_required", trace_id: auth.context.traceId }, 400);
  }

  const isSensorReading = isSdkSensorReadingEventType(eventType);
  if (isSensorReading) eventType = SDK_SENSOR_READING_EVENT_TYPE;
  let eventSource = clean(body.source) || "sdk";
  let occurredAt = clean(body.occurredAt || body.occurred_at) || null;
  let data: Record<string, unknown>;
  let sensorTarget: SdkSensorTarget | null = null;
  if (isSensorReading) {
    const normalized = normalizeSdkSensorEvent({
      bid,
      uidHex,
      occurredAt,
      source: body.source,
      data: body.data,
    });
    if (!normalized.ok) {
      await logSdkUsage({
        req,
        context: auth.context,
        endpoint: "sdk.events",
        statusCode: 400,
        startedAt,
        reason: normalized.reason,
        meta: { eventType, bid: bid || null },
      });
      return json({ ok: false, reason: normalized.reason, trace_id: auth.context.traceId }, 400);
    }
    bid = normalized.value.bid;
    uidHex = normalized.value.uidHex;
    occurredAt = normalized.value.occurredAt;
    eventSource = normalized.value.source;
    data = normalized.value.data;

    try {
      sensorTarget = await resolveSdkSensorTarget({ tenantId: auth.context.tenantId, bid, uidHex });
    } catch {
      await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 503, startedAt, reason: "sdk_sensor_target_lookup_unavailable", meta: { eventType, bid } });
      return json({ ok: false, reason: "sdk_sensor_target_lookup_unavailable", retryable: true, operationCommitted: false, traceId: auth.context.traceId }, 503, {
        "retry-after": "2",
        "x-nexid-trace-id": auth.context.traceId,
      });
    }
    if (!sensorTarget) {
      await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 404, startedAt, reason: "sdk_sensor_target_not_found", meta: { eventType, bid } });
      return json({ ok: false, reason: "sdk_sensor_target_not_found", bid, traceId: auth.context.traceId }, 404);
    }
    data = {
      sensors: {
        ...asRecord(data.sensors),
        nexidExpectedBatchId: sensorTarget.batchId,
        nexidExpectedTagId: sensorTarget.tagId,
      },
    };
  } else {
    data = {
      ...asRecord(body.data),
      meta: asRecord(body.meta),
      gps: asRecord(body.gps),
      device: asRecord(body.device || body.deviceMeta || body.device_meta),
      requestIp: parseHeaderIp(req),
      traceId: auth.context.traceId,
    };
  }
  const outbound = normalizeEnterpriseOutboundFields({ eventType, data, ...(isSensorReading ? {} : { body }) });
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
      source: eventSource,
      occurredAt,
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
  if (isSensorReading && (!sensorTarget || !sdkSensorReceiptMatchesTarget(sensorTarget, persisted))) {
    await logSdkUsage({
      req,
      context: auth.context,
      endpoint: "sdk.events",
      statusCode: 409,
      startedAt,
      reason: "sdk_sensor_target_changed",
      meta: { eventId, eventType, bid: bid || null, timelineEligible: false },
    });
    return json({
      ok: false,
      reason: "sdk_sensor_target_changed",
      retryable: false,
      operationCommitted: true,
      eventId,
      eventType,
      bid: persisted.bid,
      uidMasked: persisted.uidHex ? `${persisted.uidHex.slice(0, 4)}****${persisted.uidHex.slice(-4)}` : null,
      traceId: auth.context.traceId,
      webhookOutbox: persisted.webhookOutbox,
      sensorEvidence: sdkSensorEvidenceReceipt(false),
      recovery: "The external event was recorded for audit, but its unit binding changed during ingestion. Do not use it as SUN evidence; submit a new reading only after the BID and UID registration is stable.",
    }, 409, { "cache-control": "no-store", "x-nexid-trace-id": auth.context.traceId });
  }
  try {
    // A retry with the same idempotency key re-emits the same durable event.
    // This can repair a post-commit fanout failure without creating a second
    // SDK event. It is request-level repair; automatic durable recovery still
    // requires a transactional realtime outbox and worker.
    const realtimePublication = await publishRealtimeEvent({
      event_type: "sdk.external_event",
      sdk_event_id: eventId,
      tenant_id: auth.context.tenantId,
      tenant_slug: auth.context.tenantSlug,
      bid: persisted.bid || undefined,
      external_event_type: persisted.eventType,
      created_at: persisted.createdAt,
    });
    if (!realtimePublication.distributed) {
      console.warn("[sdk_realtime_publish_unavailable]", JSON.stringify({
        eventId,
        replayed: persisted.replayed,
        transport: realtimePublication.transport,
      }));
    }
  } catch (error) {
    // Persistence and webhook outbox already committed; never report that
    // mutation as failed solely because the optional live projection failed.
    console.warn("[sdk_realtime_publish_failed]", JSON.stringify({
      eventId,
      replayed: persisted.replayed,
      reason: error instanceof Error ? error.name : "unknown_error",
    }));
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
    ...(isSensorReading ? {
      sensorEvidence: sdkSensorEvidenceReceipt(true),
    } : {}),
  }, 201);
    },
  });
}
