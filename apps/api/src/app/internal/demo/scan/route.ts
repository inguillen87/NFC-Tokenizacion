export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { decryptKey16 } from '../../../../lib/keys';
import { generateSunParams } from '../../../../lib/crypto/sdm';
import { processSunScan } from '../../../../lib/sun-service';
import { insertSunDiagnostic } from '../../../../lib/sun-diagnostics';
import { createSunFreshHandoffToken } from '../../../../lib/sun-fresh-handoff';
import {
  DEMO_BATCH_BID,
  requireReservedDemoBatch,
  validateDemoResourceScopeRequest,
} from '../../../../lib/demo-resource-scope';

const bodySchema = z.object({
  bid: z.literal(DEMO_BATCH_BID),
  uidHex: z.string().min(1).transform((v) => v.toUpperCase()),
  deviceLabel: z.string().default('iPhone 15 Pro - Mendoza'),
  city: z.string().default('Mendoza'),
  countryCode: z.string().default('AR'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  action: z.enum(['uncork', 'verify', 'retail_scan']).default('verify'),
});

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;

  const rawBody = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestScope = validateDemoResourceScopeRequest(req, rawBody);
  if (!requestScope.ok) return json({ ok: false, reason: requestScope.reason }, requestScope.status);

  const batchScope = await requireReservedDemoBatch();
  if (!batchScope.ok) return json({ ok: false, reason: batchScope.reason }, batchScope.status);

  const parsed = bodySchema.safeParse({ ...rawBody, bid: requestScope.bid });
  if (!parsed.success) return json({ ok: false, reason: 'invalid payload' }, 400);
  const body = parsed.data;

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, b.bid, b.meta_key_ct, b.file_key_ct, b.sdm_config,
      (
        SELECT MAX(COALESCE(e.sdm_read_ctr, e.read_counter))::integer
        FROM events e
        WHERE e.batch_id = b.id
          AND UPPER(e.uid_hex) = ${body.uidHex}
          AND e.source::text = 'demo'
      ) AS last_demo_ctr
    FROM batches b
    WHERE b.id = ${batchScope.batch.id}
      AND b.tenant_id = ${batchScope.batch.tenantId}
    LIMIT 1
  `;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  // Demo counters live only in the demo event stream. They must never borrow
  // or advance the canonical physical-tag watermark in tags.last_seen_ctr.
  const currentCtr = Number(batch.last_demo_ctr ?? 0);
  const nextCtr = body.action === 'retail_scan' ? currentCtr : currentCtr + 1;
  const keyVersion = Number((batch.sdm_config as { key_version?: unknown } | null)?.key_version || 1);
  const keyContext = {
    tenantId: String(batch.tenant_id),
    bid: String(batch.bid || DEMO_BATCH_BID),
    keyVersion: Number.isSafeInteger(keyVersion) && keyVersion > 0 ? keyVersion : 1,
  };

  const generated = generateSunParams({
    uidHex: body.uidHex,
    ctr: Math.max(0, nextCtr),
    kMetaHex: decryptKey16(batch.meta_key_ct, { ...keyContext, role: 'K_META_BATCH' }).toString('hex').toUpperCase(),
    kFileHex: decryptKey16(batch.file_key_ct, { ...keyContext, role: 'K_FILE_BATCH' }).toString('hex').toUpperCase(),
  });

  const result = await processSunScan({
    bid: DEMO_BATCH_BID,
    piccDataHex: generated.piccDataHex,
    encHex: generated.encHex,
    cmacHex: generated.cmacHex,
    rawQuery: {
      bid: DEMO_BATCH_BID,
      picc_data: generated.piccDataHex,
      enc: generated.encHex,
      cmac: generated.cmacHex,
    },
    context: {
      city: body.city,
      countryCode: body.countryCode,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      userAgent: 'demo-scanner',
      deviceLabel: body.deviceLabel,
      source: 'demo',
      meta: { action: body.action },
      forceResult: body.action === 'uncork' ? 'TAMPER' : undefined,
    },
  });

  const eventId = result.body.event_id ? String(result.body.event_id) : '';
  const traceId = String(result.body.request_id || '');
  const resultUid = String(result.body.uid || body.uidHex).toUpperCase();
  const rawCounter = result.body.ctr;
  const readCounter = Number.isSafeInteger(rawCounter) && Number(rawCounter) >= 0 ? Number(rawCounter) : null;
  const diagnosticId = eventId && traceId
    ? await insertSunDiagnostic({
        trace_id: traceId,
        tool_type: 'sun_scan',
        bid: DEMO_BATCH_BID,
        uid_hex: resultUid,
        uid_masked: `${resultUid.slice(0, 4)}***${resultUid.slice(-4)}`,
        read_counter: readCounter,
        auth_status: String(result.body.auth_status || result.body.result || 'UNKNOWN'),
        replay_status: result.body.result === 'REPLAY_SUSPECT' ? 'REPLAY_SUSPECT' : 'NO_REPLAY',
        product_state: result.body.product_state || null,
        tamper_status: result.body.tamper_status || null,
        tamper_signal: result.body.tamper_signal || null,
        tamper_opened: Boolean(result.body.tamper_opened),
        tamper_risk: Boolean(result.body.tamper_risk),
        tagtamper_config_detected: Boolean(result.body.tag_tamper_config_detected),
        enc_plain_status_byte: result.body.enc_plain_status_byte || null,
        request_json: { bid: DEMO_BATCH_BID, uidHex: resultUid, action: body.action },
        result_json: { raw_result: result.body, source: 'internal_demo_scan' },
        notes: ['non-production-e2e-demo'],
      })
    : null;

  let freshToken: string | null = null;
  if (eventId && traceId && diagnosticId) {
    try {
      freshToken = createSunFreshHandoffToken({
        bid: DEMO_BATCH_BID,
        eventId,
        diagnosticId,
        traceId,
        uidHex: resultUid,
        readCounter,
        exp: Math.floor(Date.now() / 1000) + 5 * 60,
      });
    } catch {
      freshToken = null;
    }
  }

  return json({ ...result.body, source: 'demo', action: body.action, fresh_token: freshToken || undefined }, result.status);
}
