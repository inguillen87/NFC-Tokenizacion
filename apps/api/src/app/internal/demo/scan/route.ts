export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';

const bodySchema = z.object({
  bid: z.string().min(1),
  uidHex: z.string().min(1).transform((v) => v.toUpperCase()),
  deviceLabel: z.string().default('Demo Device'),
  city: z.string().default('Mendoza'),
  countryCode: z.string().default('AR'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  action: z.enum(['uncork', 'verify', 'retail_scan']).default('verify'),
});

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ ok: false, reason: 'invalid payload' }, 400);

  const body = parsed.data;

  const batchRows = await sql/*sql*/`SELECT id, tenant_id FROM batches WHERE bid = ${body.bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  const tagRows = await sql/*sql*/`
    SELECT id, status, COALESCE(last_seen_ctr, 0) AS last_seen_ctr
    FROM tags
    WHERE batch_id = ${batch.id} AND uid_hex = ${body.uidHex}
    LIMIT 1
  `;
  const tag = tagRows[0];
  if (!tag) return json({ ok: false, reason: 'tag not found' }, 404);

  const replaySuspect = body.action === 'retail_scan';
  const tamper = body.action === 'uncork';
  const nextCtr = replaySuspect ? Math.max(0, Number(tag.last_seen_ctr) - 1) : Number(tag.last_seen_ctr) + 1;

  const result = tag.status !== 'active'
    ? 'NOT_ACTIVE'
    : replaySuspect
      ? 'REPLAY_SUSPECT'
      : tamper
        ? 'TAMPER_ALERT'
        : 'VALID';

  if (!replaySuspect) {
    await sql/*sql*/`
      UPDATE tags
      SET scan_count = scan_count + 1,
          first_seen_at = COALESCE(first_seen_at, now()),
          last_seen_at = now(),
          last_seen_ctr = GREATEST(COALESCE(last_seen_ctr, -1), ${nextCtr})
      WHERE id = ${tag.id}
    `;
  }

  const eventRows = await sql/*sql*/`
    INSERT INTO events (
      tenant_id, batch_id, uid_hex, sdm_read_ctr, read_counter, cmac_ok, allowlisted, tag_status,
      result, reason, ip, user_agent, geo_city, geo_country, geo_lat, geo_lng,
      city, country_code, lat, lng, device_label, source, meta
    ) VALUES (
      ${batch.tenant_id}, ${batch.id}, ${body.uidHex}, ${nextCtr}, ${nextCtr}, true, true, ${tag.status},
      ${result}, ${result === 'VALID' ? null : body.action}, null, 'demo-scanner', ${body.city}, ${body.countryCode}, ${body.lat ?? null}, ${body.lng ?? null},
      ${body.city}, ${body.countryCode}, ${body.lat ?? null}, ${body.lng ?? null}, ${body.deviceLabel}, 'demo',
      ${JSON.stringify({ action: body.action, mode: 'simulator' })}::jsonb
    )
    RETURNING id, created_at, result
  `;

  return json({ ok: true, event: eventRows[0], bid: body.bid, uidHex: body.uidHex, action: body.action, source: 'demo' });
}
