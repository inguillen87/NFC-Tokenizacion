import { sql } from './db';
import { decryptKey16 } from './keys';
import { verifySun } from './crypto/sdm';
import { publishRealtimeEvent } from './realtime-events';

export type ScanContext = {
  ip?: string | null;
  userAgent?: string | null;
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  deviceLabel?: string | null;
  source?: 'real' | 'demo' | 'imported';
  meta?: Record<string, unknown>;
  forceResult?: string;
};

export async function processSunScan(input: {
  bid: string;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  rawQuery?: Record<string, string>;
  context?: ScanContext;
}) {
  async function logUnassignedAttempt(reason: string) {
    try {
      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS sun_scan_attempts (
          id bigserial PRIMARY KEY,
          bid text NOT NULL,
          result text NOT NULL,
          reason text,
          ip inet,
          user_agent text,
          geo_city text,
          geo_country text,
          geo_lat double precision,
          geo_lng double precision,
          source text NOT NULL DEFAULT 'real',
          raw_query jsonb,
          meta jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql/*sql*/`
        INSERT INTO sun_scan_attempts (
          bid, result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, source, raw_query, meta
        ) VALUES (
          ${input.bid},
          'UNASSIGNED_ATTEMPT',
          ${reason},
          ${input.context?.ip || null},
          ${input.context?.userAgent || null},
          ${input.context?.city || null},
          ${input.context?.countryCode || null},
          ${Number.isFinite(input.context?.lat) ? input.context?.lat! : null},
          ${Number.isFinite(input.context?.lng) ? input.context?.lng! : null},
          ${input.context?.source || 'real'},
          ${JSON.stringify(input.rawQuery || {})}::jsonb,
          ${JSON.stringify({ warning: 'batch_not_found_or_revoked', context: input.context?.meta || {} })}::jsonb
        )
      `;
    } catch {
      // best effort logging for unknown/revoked batch attempts
    }
  }

  async function insertEvent(payload: {
    uidHex: string | null;
    ctr: number | null;
    cmacOk: boolean;
    allowlistedValue: boolean;
    tagStatusValue: string | null;
    resultValue: string;
    reasonValue: string | null;
    hasGeoValue: boolean;
  }) {
    const emitRealtime = () => {
      publishRealtimeEvent({
        tenant_slug: (batch as { tenant_slug?: string }).tenant_slug || undefined,
        bid: input.bid,
        uid_hex: payload.uidHex || undefined,
        result: payload.resultValue,
        reason: payload.reasonValue || undefined,
        city: input.context?.city || null,
        country_code: input.context?.countryCode || null,
        lat: payload.hasGeoValue ? input.context?.lat || null : null,
        lng: payload.hasGeoValue ? input.context?.lng || null : null,
        source: input.context?.source || 'real',
        created_at: new Date().toISOString(),
      });
    };

    const commonValues = [
      batch.tenant_id,
      batch.id,
      payload.uidHex,
      payload.ctr,
      payload.cmacOk,
      payload.allowlistedValue,
      payload.tagStatusValue,
      payload.resultValue,
      payload.reasonValue,
      input.context?.ip || null,
      input.context?.userAgent || null,
      input.context?.city || null,
      input.context?.countryCode || null,
      payload.hasGeoValue ? input.context?.lat! : null,
      payload.hasGeoValue ? input.context?.lng! : null,
      input.context?.city || null,
      input.context?.countryCode || null,
      payload.hasGeoValue ? input.context?.lat! : null,
      payload.hasGeoValue ? input.context?.lng! : null,
      input.context?.deviceLabel || null,
      input.context?.source || 'real',
      JSON.stringify(input.context?.meta || {}),
      JSON.stringify(input.rawQuery || {}),
    ] as const;

    const isMissingColumnError = (error: unknown) => {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      return message.includes('column') && message.includes('does not exist');
    };

    try {
      await sql/*sql*/`
        INSERT INTO events (
          tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
          ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, city, country_code, lat, lng, device_label,
          source, meta, raw_query
        ) VALUES (
          ${commonValues[0]}, ${commonValues[1]}, ${commonValues[2]}, ${payload.ctr}, ${payload.ctr}, ${commonValues[4]}, ${commonValues[5]}, ${commonValues[6]}, ${commonValues[7]}, ${commonValues[8]},
          ${commonValues[9]}, ${commonValues[10]}, ${commonValues[11]}, ${commonValues[12]}, ${commonValues[13]}, ${commonValues[14]}, ${commonValues[15]}, ${commonValues[16]}, ${commonValues[17]}, ${commonValues[18]}, ${commonValues[19]},
          ${commonValues[20]}::scan_source, ${commonValues[21]}::jsonb, ${commonValues[22]}::jsonb
        )
      `;
      emitRealtime();
      return;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
    }

    try {
      await sql/*sql*/`
        INSERT INTO events (
          tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason,
          ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, city, country_code, lat, lng, device_label,
          source, meta, raw_query
        ) VALUES (
          ${commonValues[0]}, ${commonValues[1]}, ${commonValues[2]}, ${payload.ctr}, ${commonValues[4]}, ${commonValues[5]}, ${commonValues[6]}, ${commonValues[7]}, ${commonValues[8]},
          ${commonValues[9]}, ${commonValues[10]}, ${commonValues[11]}, ${commonValues[12]}, ${commonValues[13]}, ${commonValues[14]}, ${commonValues[15]}, ${commonValues[16]}, ${commonValues[17]}, ${commonValues[18]}, ${commonValues[19]},
          ${commonValues[20]}::scan_source, ${commonValues[21]}::jsonb, ${commonValues[22]}::jsonb
        )
      `;
      emitRealtime();
      return;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
    }

    await sql/*sql*/`
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, sdm_read_ctr, cmac_ok, allowlisted, tag_status, result, reason,
        ip, user_agent, raw_query
      ) VALUES (
        ${commonValues[0]}, ${commonValues[1]}, ${commonValues[2]}, ${payload.ctr}, ${commonValues[4]}, ${commonValues[5]}, ${commonValues[6]}, ${commonValues[7]}, ${commonValues[8]},
        ${commonValues[9]}, ${commonValues[10]}, ${commonValues[22]}::jsonb
      )
    `;
    emitRealtime();
  }

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, t.slug AS tenant_slug, b.status, b.meta_key_ct, b.file_key_ct
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${input.bid}
    LIMIT 1
  `;
  const batch = batchRows[0];
  if (!batch) {
    await logUnassignedAttempt('unknown batch');
    return { status: 404, body: { ok: false, reason: 'unknown batch' } };
  }
  if (batch.status === 'revoked') {
    await logUnassignedAttempt('batch revoked');
    return { status: 403, body: { ok: false, reason: 'batch revoked' } };
  }

  const kMeta = decryptKey16(batch.meta_key_ct).toString('hex').toUpperCase();
  const kFile = decryptKey16(batch.file_key_ct).toString('hex').toUpperCase();

  const res = verifySun({
    piccDataHex: input.piccDataHex,
    encHex: input.encHex,
    cmacHex: input.cmacHex,
    kMetaHex: kMeta,
    kFileHex: kFile,
  });

  let allowlisted = false;
  let tagStatus: string | null = null;
  let replaySuspect = false;

  if (res.ok) {
    const priorEventRows = await sql/*sql*/`
      SELECT id
      FROM events
      WHERE batch_id = ${batch.id}
        AND uid_hex = ${res.uidHex}
        AND sdm_read_ctr = ${res.ctr}
      LIMIT 1
    `;
    if (priorEventRows[0]) replaySuspect = true;

    const tagRows = await sql/*sql*/`
      SELECT id, status, last_seen_ctr
      FROM tags
      WHERE batch_id = ${batch.id} AND uid_hex = ${res.uidHex}
      LIMIT 1
    `;
    const tag = tagRows[0];
    if (tag) {
      allowlisted = true;
      tagStatus = tag.status;
      if (typeof tag.last_seen_ctr === 'number' && res.ctr <= tag.last_seen_ctr) replaySuspect = true;
      await sql/*sql*/`
        UPDATE tags
        SET scan_count = scan_count + 1,
            first_seen_at = COALESCE(first_seen_at, now()),
            last_seen_at = now(),
            last_seen_ctr = GREATEST(COALESCE(last_seen_ctr, -1), ${res.ctr})
        WHERE id = ${tag.id}
      `;
    }
  }

  let result = !res.ok
    ? 'INVALID'
    : replaySuspect
      ? 'REPLAY_SUSPECT'
      : !allowlisted
      ? 'NOT_REGISTERED'
      : tagStatus !== 'active'
        ? 'NOT_ACTIVE'
        : 'VALID';

  const successReason = replaySuspect ? 'copied URL / replay suspected' : null;
  const resolvedReason = !res.ok ? res.reason : successReason;

  if (input.context?.forceResult) result = input.context.forceResult;

  const hasGeo = Number.isFinite(input.context?.lat) && Number.isFinite(input.context?.lng);

  await insertEvent({
    uidHex: res.ok ? res.uidHex : null,
    ctr: res.ok ? res.ctr : null,
    cmacOk: res.ok,
    allowlistedValue: allowlisted,
    tagStatusValue: tagStatus,
    resultValue: result,
    reasonValue: resolvedReason,
    hasGeoValue: hasGeo,
  });

  return {
    status: result === 'VALID' ? 200 : 403,
    body: {
      ok: result === 'VALID',
      result,
      bid: input.bid,
      uid: res.ok ? res.uidHex : undefined,
      ctr: res.ok ? res.ctr : undefined,
      enc_plain_hex: res.ok ? res.encPlainHex : undefined,
      allowlisted,
      tag_status: tagStatus,
      reason: resolvedReason || undefined,
    },
  };
}
