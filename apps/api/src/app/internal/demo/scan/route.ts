export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { decryptKey16 } from '../../../../lib/keys';
import { generateSunParams } from '../../../../lib/crypto/sdm';
import { processSunScan } from '../../../../lib/sun-service';

const bodySchema = z.object({
  bid: z.string().min(1),
  uidHex: z.string().min(1).transform((v) => v.toUpperCase()),
  deviceLabel: z.string().default('iPhone 15 Pro - Mendoza'),
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

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.meta_key_ct, b.file_key_ct, t.last_seen_ctr
    FROM batches b
    LEFT JOIN tags t ON t.batch_id = b.id AND t.uid_hex = ${body.uidHex}
    WHERE b.bid = ${body.bid}
    LIMIT 1
  `;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  const currentCtr = Number(batch.last_seen_ctr ?? 0);
  const nextCtr = body.action === 'retail_scan' ? currentCtr : currentCtr + 1;

  const generated = generateSunParams({
    uidHex: body.uidHex,
    ctr: Math.max(0, nextCtr),
    kMetaHex: decryptKey16(batch.meta_key_ct).toString('hex').toUpperCase(),
    kFileHex: decryptKey16(batch.file_key_ct).toString('hex').toUpperCase(),
  });

  const result = await processSunScan({
    bid: body.bid,
    piccDataHex: generated.piccDataHex,
    encHex: generated.encHex,
    cmacHex: generated.cmacHex,
    rawQuery: {
      bid: body.bid,
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

  return json({ ...result.body, source: 'demo', action: body.action }, result.status);
}
