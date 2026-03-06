export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as any));
  const bid = String(body.bid || 'DEMO-2026-02');
  const csv = String(body.csv || '');
  if (!csv.trim()) return json({ ok: false, reason: 'CSV required' }, 400);

  const batch = (await sql`SELECT id FROM batches WHERE bid=${bid} LIMIT 1`)[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);

  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  let inserted = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i]?.trim() || '']));
    const uidHex = String(row.uid_hex || '').toUpperCase();
    if (!uidHex) continue;
    await sql`INSERT INTO tags (batch_id, uid_hex, status) VALUES (${batch.id}, ${uidHex}, 'active') ON CONFLICT (batch_id, uid_hex) DO UPDATE SET status='active'`;
    inserted += 1;
  }

  return json({ ok: true, inserted });
}
