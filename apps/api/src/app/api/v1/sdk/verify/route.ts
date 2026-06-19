export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../lib/sdk-auth";
import { dispatchTenantWebhooks } from "../../../../../lib/sdk-webhooks";
import { processSunScan } from "../../../../../lib/sun-service";
import { asRecord, clean, mapSdkVerdict, mapSealStatus, maskUid, numberOrNull, parseHeaderIp } from "../_shared";

export async function POST(req: Request) {
  const startedAt = Date.now();
  const auth = await authenticateSdkRequest(req, "sdk:verify");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint: "sdk.verify", statusCode: auth.response.status, startedAt, reason: "auth_failed" });
    return auth.response;
  }

  const body = asRecord(await req.json().catch(() => ({})));
  const bid = clean(body.bid);
  const piccDataHex = clean(body.picc_data || body.piccDataHex || body.picc);
  const encHex = clean(body.enc || body.encrypted_data || body.encHex);
  const cmacHex = clean(body.cmac || body.mac || body.cmacHex);
  if (!bid || !piccDataHex || !encHex || !cmacHex) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.verify", statusCode: 400, startedAt, reason: "missing_sun_payload", meta: { bid } });
    return json({ ok: false, reason: "missing_sun_payload", need: ["bid", "picc_data", "enc", "cmac"], trace_id: auth.context.traceId }, 400);
  }

  const batchRows = await sql/*sql*/`
    SELECT id::text AS id
    FROM batches
    WHERE tenant_id = ${auth.context.tenantId}
      AND bid = ${bid}
    LIMIT 1
  `;
  if (!batchRows[0]) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.verify", statusCode: 404, startedAt, reason: "batch_not_found_for_tenant", meta: { bid } });
    return json({ ok: false, reason: "batch_not_found_for_tenant", bid, trace_id: auth.context.traceId }, 404);
  }

  const gps = asRecord(body.gps);
  const deviceMeta = asRecord(body.deviceMeta || body.device_meta || body.device);
  const lat = numberOrNull(gps.lat ?? gps.latitude);
  const lng = numberOrNull(gps.lng ?? gps.longitude);
  const result = await processSunScan({
    bid,
    piccDataHex,
    encHex,
    cmacHex,
    rawQuery: { bid, picc_data: piccDataHex, enc: encHex, cmac: cmacHex },
    context: {
      source: "real",
      requestId: auth.context.traceId,
      ip: parseHeaderIp(req) || undefined,
      userAgent: clean(deviceMeta.userAgent) || req.headers.get("user-agent") || undefined,
      city: clean(gps.city),
      countryCode: clean(gps.country || gps.countryCode),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      deviceLabel: clean(deviceMeta.label) || "nexid-sdk",
      meta: {
        sdk: true,
        api_key_id: auth.context.apiKeyId,
        tenant_slug: auth.context.tenantSlug,
        device: deviceMeta,
        gps,
      },
    },
  });

  const resultBody = asRecord(result.body);
  if (clean(resultBody.tenant_id) && clean(resultBody.tenant_id) !== auth.context.tenantId) {
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.verify", statusCode: 403, startedAt, reason: "tenant_batch_mismatch", meta: { bid } });
    return json({ ok: false, reason: "tenant_batch_mismatch", bid, trace_id: auth.context.traceId }, 403);
  }

  const responseBody = {
    ok: Boolean(resultBody.ok),
    verdict: mapSdkVerdict(resultBody.result || resultBody.auth_status),
    uidMasked: maskUid(resultBody.uid),
    readCounter: typeof resultBody.ctr === "number" ? resultBody.ctr : null,
    sealStatus: mapSealStatus(resultBody.tamper_status),
    eventId: resultBody.event_id ? String(resultBody.event_id) : null,
    tenant: {
      slug: auth.context.tenantSlug,
      name: auth.context.tenantName,
    },
    bid,
    result: clean(resultBody.result || resultBody.auth_status),
    reason: clean(resultBody.reason || resultBody.crypto_error_reason) || null,
    traceId: auth.context.traceId,
  };
  await dispatchTenantWebhooks({
    tenantId: auth.context.tenantId,
    eventName: "sdk.verify",
    payload: { ...responseBody, eventId: responseBody.eventId, traceId: auth.context.traceId },
  }).catch(() => null);
  await logSdkUsage({ req, context: auth.context, endpoint: "sdk.verify", statusCode: result.status, startedAt, reason: responseBody.reason, meta: { bid, verdict: responseBody.verdict } });
  return json(responseBody, result.status);
}
