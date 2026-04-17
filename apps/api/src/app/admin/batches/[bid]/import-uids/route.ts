export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';

function normalizeUid(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = Array.isArray(body.uids) ? body.uids : [];
  const uids = raw.map(normalizeUid).filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
  if (!uids.length) return json({ ok: false, reason: 'uids required' }, 400);

  const batchRows = await sql`SELECT id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  const seen = new Set<string>();
  let inserted = 0;
  let duplicates = 0;

  for (const uid of uids) {
    if (seen.has(uid)) {
      duplicates += 1;
      continue;
    }
    seen.add(uid);

    const result = await sql`
      INSERT INTO tags (batch_id, uid_hex, status)
      VALUES (${batch.id}, ${uid}, 'inactive')
      ON CONFLICT (batch_id, uid_hex)
      DO NOTHING
      RETURNING uid_hex
    `;
    if (result.length) inserted += 1;
  }

  return json({ ok: true, batch: bid, imported: inserted, duplicates, totalParsed: uids.length });
}
