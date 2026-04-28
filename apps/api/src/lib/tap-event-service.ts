import { sql } from './db';
import { publishRealtimeEvent } from './realtime-events';
import { evaluateSecurityAlerts } from "./alert-engine";

export type TapEventPayload = {
  tenantId?: string | null;
  tenantSlug?: string | null;
  batchId?: string | null;
  tagId?: string | null;
  uidHex?: string | null;
  bid?: string | null;
  source: 'real' | 'demo' | 'imported' | 'sun' | 'demo_simulation' | 'admin_manual' | 'mobile_action' | 'tokenization' | 'warranty' | 'ownership';
  eventType: 'TAP_VALID' | 'TAP_INVALID' | 'REPLAY_SUSPECT' | 'UNKNOWN_BATCH' | 'NOT_REGISTERED' | 'NOT_ACTIVE' | 'REVOKED' | 'BROKEN' | 'TAMPERED' | 'OWNERSHIP_ACTIVATED' | 'WARRANTY_REGISTERED' | 'PROVENANCE_VIEWED' | 'TOKENIZATION_REQUESTED' | 'TOKENIZATION_SIMULATED' | 'TOKENIZATION_ANCHORED' | 'EXPORT_GENERATED';
  verdict: 'valid' | 'invalid' | 'replay_suspect' | 'blocked_replay' | 'revoked' | 'broken' | 'tampered' | 'unknown_batch' | 'not_registered' | 'not_active';
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  readCounter?: number | null;
  sdmReadCtr?: number | null;
  piccDataHash?: string | null;
  cmacHash?: string | null;
  cmacOk?: boolean | null;
  allowlisted?: boolean | null;
  tagStatus?: string | null;
  rawUrlHash?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  city?: string | null;
  province?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  geoPrecision?: 'none' | 'ip' | 'browser_rounded' | 'browser_exact';
  productName?: string | null;
  metadataJson?: Record<string, unknown>;
  reason?: string | null;
  meta?: Record<string, unknown>;
  traceId?: string | null;
  ip?: string | null;
  geoCity?: string | null;
  geoCountry?: string | null;
  deviceLabel?: string | null;
  rawQuery?: Record<string, unknown>;
};

export async function recordTapEvent(payload: TapEventPayload): Promise<number | null> {
  const resultStr = payload.verdict.toUpperCase();
  const sourceStr = payload.source === 'sun' || payload.source === 'real' ? 'real' : payload.source === 'demo' || payload.source === 'demo_simulation' ? 'demo' : 'imported';
  const metaJson = payload.meta || payload.metadataJson || {};

  const insertWithReadCounter = () => sql`
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
        user_agent, city, country_code, lat, lng, source, meta, tenant_slug, tag_id, bid, event_type, verdict, risk_level,
        picc_data_hash, cmac_hash, raw_url_hash, ip_hash, geo_precision, product_name,
        ip, geo_city, geo_country, device_label, raw_query
      ) VALUES (
        ${payload.tenantId || null}, ${payload.batchId || null}, ${payload.uidHex || null}, ${payload.sdmReadCtr || payload.readCounter || null}, ${payload.readCounter || null}, ${payload.cmacOk || null}, ${payload.allowlisted || null}, ${payload.tagStatus || null}, ${resultStr}, ${payload.reason || null},
        ${payload.userAgent || null}, ${payload.city || null}, ${payload.countryCode || null}, ${payload.lat || null}, ${payload.lng || null}, ${sourceStr}::text, ${metaJson}::jsonb, ${payload.tenantSlug || null}, ${payload.tagId || null}, ${payload.bid || null}, ${payload.eventType}::text, ${payload.verdict}, ${payload.riskLevel}::text,
        ${payload.piccDataHash || null}, ${payload.cmacHash || null}, ${payload.rawUrlHash || null}, ${payload.ipHash || null}, ${payload.geoPrecision || 'none'}::text, ${payload.productName || null},
        ${payload.ip || null}, ${payload.geoCity || null}, ${payload.geoCountry || null}, ${payload.deviceLabel || null}, ${payload.rawQuery || null}::jsonb
      )
      RETURNING id
    `;
  const insertWithoutReadCounter = () => sql`
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason,
        user_agent, city, country_code, lat, lng, source, meta, tenant_slug, tag_id, bid, event_type, verdict, risk_level,
        picc_data_hash, cmac_hash, raw_url_hash, ip_hash, geo_precision, product_name,
        ip, geo_city, geo_country, device_label, raw_query
      ) VALUES (
        ${payload.tenantId || null}, ${payload.batchId || null}, ${payload.uidHex || null}, ${payload.sdmReadCtr || payload.readCounter || null}, ${payload.cmacOk || null}, ${payload.allowlisted || null}, ${payload.tagStatus || null}, ${resultStr}, ${payload.reason || null},
        ${payload.userAgent || null}, ${payload.city || null}, ${payload.countryCode || null}, ${payload.lat || null}, ${payload.lng || null}, ${sourceStr}::text, ${metaJson}::jsonb, ${payload.tenantSlug || null}, ${payload.tagId || null}, ${payload.bid || null}, ${payload.eventType}::text, ${payload.verdict}, ${payload.riskLevel}::text,
        ${payload.piccDataHash || null}, ${payload.cmacHash || null}, ${payload.rawUrlHash || null}, ${payload.ipHash || null}, ${payload.geoPrecision || 'none'}::text, ${payload.productName || null},
        ${payload.ip || null}, ${payload.geoCity || null}, ${payload.geoCountry || null}, ${payload.deviceLabel || null}, ${payload.rawQuery || null}::jsonb
      )
      RETURNING id
    `;

  try {
    let inserted;
    try {
      inserted = await insertWithReadCounter();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const missingReadCounter = err?.code === "42703" && String(err?.message || "").toLowerCase().includes("read_counter");
      if (!missingReadCounter) throw error;
      inserted = await insertWithoutReadCounter();
    }
    const eventId = Number((inserted?.[0] as { id?: number } | undefined)?.id || 0) || null;

    if (eventId) {
      publishRealtimeEvent({
        id: eventId,
        tenant_id: payload.tenantId || undefined,
        tenant_slug: payload.tenantSlug || undefined,
        batch_id: payload.batchId || undefined,
        tag_id: payload.tagId || undefined,
        bid: payload.bid || undefined,
        uid_hex: payload.uidHex || undefined,
        verdict: payload.verdict,
        risk_level: payload.riskLevel,
        product_name: payload.productName || undefined,
        result: resultStr,
        reason: payload.reason || undefined,
        city: payload.city || null,
        country_code: payload.countryCode || null,
        lat: payload.lat || null,
        lng: payload.lng || null,
        source: sourceStr,
        created_at: new Date().toISOString(),
        trace_id: payload.traceId || null,
      });
      void evaluateSecurityAlerts({
        eventId,
        tenantId: payload.tenantId || null,
        tenantSlug: payload.tenantSlug || null,
        uidHex: payload.uidHex || null,
        result: resultStr,
        countryCode: payload.countryCode || payload.geoCountry || null,
        deviceLabel: payload.deviceLabel || null,
      }).catch(() => null);
    }

    return eventId;
  } catch (error) {
    console.error('Failed to record tap event:', error);
    // Even if db insert fails due to some missing column during migration transition, we might still want to emit realtime event
    // but ideally we just fail gracefully and perhaps return null
    return null;
  }
}
