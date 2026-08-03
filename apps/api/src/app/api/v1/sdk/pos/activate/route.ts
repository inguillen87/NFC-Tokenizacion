export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";

import { ensureSdkSchema } from "../../../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { authenticateSdkRequest, hashSdkApiKey, logSdkUsage, sdkKeyPrefix } from "../../../../../../lib/sdk-auth";
import { enqueueSdkWebhookGuaranteed, sdkWebhookOutboxUnavailableBody, SdkWebhookOutboxUnavailableError } from "../../../../../../lib/sdk-webhook-outbox-guarantee";
import { asRecord, clean, numberOrNull, parseHeaderIp } from "../../_shared";
import { enforceSdkAuthenticationRateLimit, enforceSdkRateLimit } from "../../../../../../lib/critical-rate-limit";
import { readSdkMutationBody, runSdkIdempotentMutation, SDK_IDEMPOTENCY_OPERATIONS } from "../../_idempotency";
import {
  hashOwnershipClaimPin,
  readOwnershipClaimPinInput,
  validateNewOwnershipClaimPin,
} from "../../../../../../lib/ownership-claim-pin";

function generatePosToken() {
  return `nxpos_${randomBytes(24).toString("base64url")}`;
}

function clampExpiryMinutes(value: unknown) {
  const minutes = Number(value || 60 * 24 * 7);
  if (!Number.isFinite(minutes)) return 60 * 24 * 7;
  return Math.min(Math.max(Math.round(minutes), 5), 60 * 24 * 30);
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const authRateLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authRateLimited) return authRateLimited;
  const auth = await authenticateSdkRequest(req, "sdk:pos");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint: "sdk.pos.activate", statusCode: auth.response.status, startedAt, reason: "auth_failed" });
    return auth.response;
  }
  const rateLimited = await enforceSdkRateLimit(req, auth.context);
  if (rateLimited) return rateLimited;

  await ensureSdkSchema();
  const parsedBody = await readSdkMutationBody(req, auth.context.traceId);
  if (!parsedBody.ok) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: parsedBody.response.status, startedAt, reason: "invalid_request_body" });
    return parsedBody.response;
  }
  const body = parsedBody.body;
  return runSdkIdempotentMutation({
    req,
    context: auth.context,
    route: SDK_IDEMPOTENCY_OPERATIONS.activatePosPurchase.route,
    body,
    execute: async ({ idempotencyOperationId }) => {
  const bid = clean(body.bid);
  const uidHex = clean(body.uidHex || body.uid_hex).toUpperCase();
  const externalOrderId = clean(body.externalOrderId || body.external_order_id || body.orderId);
  const retailerId = clean(body.retailerId || body.retailer_id || body.storeId);
  const contact = clean(body.contact || body.email || body.phone || body.whatsapp);
  const pinInput = readOwnershipClaimPinInput(body.pin ?? body.claimPin ?? body.claim_pin);
  if (!pinInput.ok) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 400, startedAt, reason: pinInput.reason });
    return json({ ok: false, reason: pinInput.reason, trace_id: auth.context.traceId }, 400);
  }
  const pin = pinInput.pin;
  const expiresInMinutes = clampExpiryMinutes(body.expiresInMinutes || body.expires_in_minutes);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

  if (!bid) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 400, startedAt, reason: "bid_required" });
    return json({ ok: false, reason: "bid_required", trace_id: auth.context.traceId }, 400);
  }
  if (!uidHex) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 400, startedAt, reason: "uid_required_for_pos_activation", meta: { bid } });
    return json({ ok: false, reason: "uid_required_for_pos_activation", trace_id: auth.context.traceId }, 400);
  }

  const rows = await sql/*sql*/`
    SELECT
      b.id::text AS batch_id,
      b.bid,
      t.id::text AS tag_id,
      t.uid_hex
    FROM batches b
    LEFT JOIN LATERAL (
      SELECT id, uid_hex
      FROM tags candidate
      WHERE candidate.batch_id = b.id
        AND (${uidHex} = '' OR UPPER(candidate.uid_hex) = UPPER(${uidHex}))
      ORDER BY candidate.created_at ASC
      LIMIT 1
    ) t ON ${uidHex} <> ''
    WHERE b.tenant_id = ${auth.context.tenantId}
      AND b.bid = ${bid}
    LIMIT 1
  `;
  const target = rows[0] as Record<string, unknown> | undefined;
  if (!target) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 404, startedAt, reason: "batch_not_found_for_tenant", meta: { bid } });
    return json({ ok: false, reason: "batch_not_found_for_tenant", bid, trace_id: auth.context.traceId }, 404);
  }
  if (uidHex && !clean(target.tag_id)) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 404, startedAt, reason: "tag_not_found_for_batch", meta: { bid, uidHex } });
    return json({ ok: false, reason: "tag_not_found_for_batch", bid, uidHex, trace_id: auth.context.traceId }, 404);
  }

  const normalizedUid = clean(target.uid_hex || uidHex).toUpperCase();
  const pinContext = { tenantId: auth.context.tenantId, bid, uidHex: normalizedUid || null };
  if (pin) {
    const validation = validateNewOwnershipClaimPin(pin, pinContext);
    if (!validation.ok) {
      await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 400, startedAt, reason: validation.reason, meta: { bid, uidHex: normalizedUid || null } });
      return json({ ok: false, reason: validation.reason, trace_id: auth.context.traceId }, 400);
    }
  }
  const tagPinHash = pin ? await hashOwnershipClaimPin(pin, pinContext) : "";
  const rawToken = generatePosToken();
  const gps = asRecord(body.gps);
  const lat = numberOrNull(gps.lat ?? gps.latitude);
  const lng = numberOrNull(gps.lng ?? gps.longitude);
  const meta = {
    ...asRecord(body.meta),
    sdk: true,
    api_key_id: auth.context.apiKeyId,
    tenantSlug: auth.context.tenantSlug,
    source: clean(body.source) || "pos",
    externalOrderId: externalOrderId || null,
    retailerId: retailerId || null,
    gps: { ...gps, lat, lng },
    device: asRecord(body.device || body.deviceMeta || body.device_meta),
    requestIp: parseHeaderIp(req),
  };

  await sql/*sql*/`
    UPDATE tags
    SET
      active_for_claim = true,
      claim_pin_required = CASE WHEN ${Boolean(pin)} THEN true ELSE claim_pin_required END,
      hash_pin = COALESCE(${tagPinHash || null}, hash_pin)
    WHERE id = ${clean(target.tag_id)}
      AND batch_id = ${clean(target.batch_id)}
  `;

  const activationRows = await sql/*sql*/`
    INSERT INTO sdk_pos_activations (
      tenant_id, api_key_id, batch_id, tag_id, bid, uid_hex, pos_token_prefix, pos_token_hash,
      external_order_id, retailer_id, contact, expires_at, meta, idempotency_operation_id
    ) VALUES (
      ${auth.context.tenantId},
      ${auth.context.apiKeyId},
      ${clean(target.batch_id)},
      ${clean(target.tag_id) || null},
      ${bid},
      ${normalizedUid || null},
      ${sdkKeyPrefix(rawToken)},
      ${hashSdkApiKey(rawToken)},
      ${externalOrderId || null},
      ${retailerId || null},
      ${contact || null},
      ${expiresAt},
      ${JSON.stringify(meta)}::jsonb,
      ${idempotencyOperationId}::uuid
    )
    RETURNING id::text AS id, expires_at
  `;
  const activation = activationRows[0] as { id?: string; expires_at?: string } | undefined;
  const activationId = String(activation?.id || "");

  let webhookOutbox;
  try {
    webhookOutbox = await enqueueSdkWebhookGuaranteed({
      tenantId: auth.context.tenantId,
      eventName: "sdk.pos.activated",
      idempotencyKey: activationId,
      payload: {
        activationId,
        bid,
        uidHex: normalizedUid || null,
        externalOrderId: externalOrderId || null,
        retailerId: retailerId || null,
        expiresAt: String(activation?.expires_at || expiresAt),
        traceId: auth.context.traceId,
      },
      correlationId: auth.context.traceId,
      resourceId: activationId,
    });
  } catch (error) {
    if (!(error instanceof SdkWebhookOutboxUnavailableError)) throw error;
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 503, startedAt, reason: error.code, meta: { bid, activationId } });
    return json({ ...sdkWebhookOutboxUnavailableBody(error), operation: { activationId, bid, posToken: rawToken, expiresAt: String(activation?.expires_at || expiresAt) } }, 503, { "retry-after": "2", "x-nexid-trace-id": auth.context.traceId });
  }
  await logSdkUsage({ req, context: auth.context, endpoint: "sdk.pos.activate", statusCode: 201, startedAt, meta: { bid, uidHex: normalizedUid || null, activationId } });

  return json({
    ok: true,
    activationId,
    tenant: { slug: auth.context.tenantSlug, name: auth.context.tenantName },
    bid,
    uidMasked: normalizedUid ? `${normalizedUid.slice(0, 4)}****${normalizedUid.slice(-4)}` : null,
    posToken: rawToken,
    expiresAt: String(activation?.expires_at || expiresAt),
    policy: {
      claimRequiresPos: true,
      claimPinRequired: Boolean(pin),
      autoClaimEnabled: true,
      note: "The token is shown once. Store it in the POS, receipt, ERP or checkout backend.",
    },
    traceId: auth.context.traceId,
    webhookOutbox,
  }, 201);
    },
  });
}
