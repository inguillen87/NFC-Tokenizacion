export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { publishRealtimeEvent } from "../../../../../lib/realtime-events";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../lib/sdk-auth";
import { enqueueSdkWebhookGuaranteed, sdkWebhookOutboxUnavailableBody, SdkWebhookOutboxUnavailableError } from "../../../../../lib/sdk-webhook-outbox-guarantee";
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

  const targetRows = bid ? await sql/*sql*/`
    SELECT
      b.id::text AS batch_id,
      t.id::text AS tag_id
    FROM batches b
    LEFT JOIN LATERAL (
      SELECT id
      FROM tags candidate
      WHERE candidate.batch_id = b.id
        AND (${uidHex} = '' OR UPPER(candidate.uid_hex) = UPPER(${uidHex}))
      ORDER BY candidate.created_at ASC
      LIMIT 1
    ) t ON ${uidHex} <> ''
    WHERE b.tenant_id = ${auth.context.tenantId}
      AND b.bid = ${bid}
    LIMIT 1
  ` : [];
  if (bid && !targetRows[0]) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 404, startedAt, reason: "batch_not_found_for_tenant", meta: { bid, eventType } });
    return json({ ok: false, reason: "batch_not_found_for_tenant", bid, trace_id: auth.context.traceId }, 404);
  }
  const target = (targetRows[0] || {}) as Record<string, unknown>;
  const data = {
    ...asRecord(body.data),
    meta: asRecord(body.meta),
    gps: asRecord(body.gps),
    device: asRecord(body.device || body.deviceMeta || body.device_meta),
    requestIp: parseHeaderIp(req),
    traceId: auth.context.traceId,
  };

  const rows = await sql/*sql*/`
    INSERT INTO sdk_external_events (
      tenant_id, api_key_id, batch_id, tag_id, bid, uid_hex, event_type, source, occurred_at, data,
      idempotency_operation_id
    ) VALUES (
      ${auth.context.tenantId},
      ${auth.context.apiKeyId},
      ${clean(target.batch_id) || null},
      ${clean(target.tag_id) || null},
      ${bid || null},
      ${uidHex || null},
      ${eventType},
      ${clean(body.source) || "sdk"},
      ${clean(body.occurredAt || body.occurred_at) || null},
      ${JSON.stringify(data)}::jsonb,
      ${idempotencyOperationId}::uuid
    )
    RETURNING id::text AS id, created_at
  `;
  const eventId = String((rows[0] as { id?: string } | undefined)?.id || "");
  publishRealtimeEvent({
    event_type: "sdk.external_event",
    sdk_event_id: eventId,
    tenant_id: auth.context.tenantId,
    tenant_slug: auth.context.tenantSlug,
    bid: bid || undefined,
    uid_hex: uidHex || undefined,
    external_event_type: eventType,
    created_at: String((rows[0] as { created_at?: string } | undefined)?.created_at || new Date().toISOString()),
    trace_id: auth.context.traceId,
  });
  let webhookOutbox;
  try {
    webhookOutbox = await enqueueSdkWebhookGuaranteed({
      tenantId: auth.context.tenantId,
      eventName: "sdk.external_event",
      idempotencyKey: eventId,
      payload: { eventId, eventType, bid: bid || null, uidHex: uidHex || null, source: clean(body.source) || "sdk", traceId: auth.context.traceId },
      correlationId: auth.context.traceId,
      resourceId: eventId,
    });
  } catch (error) {
    if (!(error instanceof SdkWebhookOutboxUnavailableError)) throw error;
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 503, startedAt, reason: error.code, meta: { eventId, eventType, bid: bid || null } });
    return json({ ...sdkWebhookOutboxUnavailableBody(error), operation: { eventId, eventType, bid: bid || null } }, 503, { "retry-after": "2", "x-nexid-trace-id": auth.context.traceId });
  }
  await logSdkUsage({ req, context: auth.context, endpoint: "sdk.events", statusCode: 201, startedAt, meta: { eventId, eventType, bid: bid || null } });

  return json({
    ok: true,
    eventId,
    eventType,
    tenant: { slug: auth.context.tenantSlug, name: auth.context.tenantName },
    bid: bid || null,
    uidMasked: uidHex ? `${uidHex.slice(0, 4)}****${uidHex.slice(-4)}` : null,
    traceId: auth.context.traceId,
    webhookOutbox,
  }, 201);
    },
  });
}
