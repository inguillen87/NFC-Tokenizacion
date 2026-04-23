import { sql } from './db';
import { publishRealtimeEvent } from './realtime-events';

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
};

export async function recordTapEvent(payload: TapEventPayload): Promise<number | null> {
  const resultStr = payload.verdict.toUpperCase();
  const sourceStr = payload.source === 'sun' || payload.source === 'real' ? 'real' : payload.source === 'demo' || payload.source === 'demo_simulation' ? 'demo' : 'imported';
  const metaJson = payload.meta || payload.metadataJson || {};

  try {
    const inserted = await sql`
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
        user_agent, city, country_code, lat, lng, source, meta, tenant_slug, tag_id, bid, event_type, verdict, risk_level,
        picc_data_hash, cmac_hash, raw_url_hash, ip_hash, geo_precision, product_name
      ) VALUES (
        ${payload.tenantId || null}, ${payload.batchId || null}, ${payload.uidHex || null}, ${payload.sdmReadCtr || payload.readCounter || null}, ${payload.readCounter || null}, ${payload.cmacOk || null}, ${payload.allowlisted || null}, ${payload.tagStatus || null}, ${resultStr}, ${payload.reason || null},
        ${payload.userAgent || null}, ${payload.city || null}, ${payload.countryCode || null}, ${payload.lat || null}, ${payload.lng || null}, ${sourceStr}::scan_source, ${metaJson}::jsonb, ${payload.tenantSlug || null}, ${payload.tagId || null}, ${payload.bid || null}, ${payload.eventType}::event_type, ${payload.verdict}, ${payload.riskLevel}::risk_level,
        ${payload.piccDataHash || null}, ${payload.cmacHash || null}, ${payload.rawUrlHash || null}, ${payload.ipHash || null}, ${payload.geoPrecision || 'none'}::geo_precision, ${payload.productName || null}
      )
      RETURNING id
    `;
    const eventId = Number((inserted?.[0] as { id?: number } | undefined)?.id || 0) || null;

    if (eventId) {
      publishRealtimeEvent({
        id: eventId,
        tenant_slug: payload.tenantSlug || undefined,
        bid: payload.bid || undefined,
        uid_hex: payload.uidHex || undefined,
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
    }

    return eventId;
  } catch (error) {
    console.error('Failed to record tap event:', error);
    // Even if db insert fails due to some missing column during migration transition, we might still want to emit realtime event
    // but ideally we just fail gracefully and perhaps return null
    return null;
  }
}
