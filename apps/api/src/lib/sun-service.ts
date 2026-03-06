import { sql } from './db';
import { decryptKey16 } from './keys';
import { verifySun } from './crypto/sdm';

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
  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, b.status, b.meta_key_ct, b.file_key_ct
    FROM batches b
    WHERE b.bid = ${input.bid}
    LIMIT 1
  `;
  const batch = batchRows[0];
  if (!batch) return { status: 404, body: { ok: false, reason: 'unknown batch' } };
  if (batch.status === 'revoked') return { status: 403, body: { ok: false, reason: 'batch revoked' } };

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
    : !allowlisted
      ? 'NOT_REGISTERED'
      : tagStatus !== 'active'
        ? 'NOT_ACTIVE'
        : replaySuspect
          ? 'REPLAY_SUSPECT'
          : 'VALID';

  if (input.context?.forceResult) result = input.context.forceResult;

  const hasGeo = Number.isFinite(input.context?.lat) && Number.isFinite(input.context?.lng);

  await sql/*sql*/`
    INSERT INTO events (
      tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status, result, reason,
      ip, user_agent, geo_city, geo_country, geo_lat, geo_lng, city, country_code, lat, lng, device_label,
      source, meta, raw_query
    ) VALUES (
      ${batch.tenant_id},
      ${batch.id},
      ${res.ok ? res.uidHex : null},
      ${res.ok ? res.ctr : null},
      ${res.ok ? res.ctr : null},
      ${res.ok},
      ${allowlisted},
      ${tagStatus},
      ${result},
      ${res.ok ? null : res.reason},
      ${input.context?.ip || null},
      ${input.context?.userAgent || null},
      ${input.context?.city || null},
      ${input.context?.countryCode || null},
      ${hasGeo ? input.context?.lat! : null},
      ${hasGeo ? input.context?.lng! : null},
      ${input.context?.city || null},
      ${input.context?.countryCode || null},
      ${hasGeo ? input.context?.lat! : null},
      ${hasGeo ? input.context?.lng! : null},
      ${input.context?.deviceLabel || null},
      ${input.context?.source || 'real'}::scan_source,
      ${JSON.stringify(input.context?.meta || {})}::jsonb,
      ${JSON.stringify(input.rawQuery || {})}::jsonb
    )
  `;

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
      reason: res.ok ? undefined : res.reason,
    },
  };
}
