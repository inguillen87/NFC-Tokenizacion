export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';
import { requireReservedDemoBatch, validateDemoResourceScopeRequest } from '../../../../lib/demo-resource-scope';

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestScope = validateDemoResourceScopeRequest(req, body);
  if (!requestScope.ok) return json({ ok: false, reason: requestScope.reason }, requestScope.status);

  const batchScope = await requireReservedDemoBatch();
  if (!batchScope.ok) return json({ ok: false, reason: batchScope.reason }, batchScope.status);
  const batch = batchScope.batch;
  const csv = String(body.csv || '');
  if (!csv.trim()) return json({ ok: false, reason: 'CSV required' }, 400);

  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, cols[i]?.trim() || '']));
  });
  for (const row of rows) {
    const rowScope = validateDemoResourceScopeRequest(req, row);
    if (!rowScope.ok) return json({ ok: false, reason: rowScope.reason }, rowScope.status);
  }

  let inserted = 0;
  for (const row of rows) {
    const uidHex = String(row.uid_hex || '').toUpperCase();
    if (!uidHex) continue;
    await sql`INSERT INTO tags (batch_id, uid_hex, status) VALUES (${batch.id}, ${uidHex}, 'active') ON CONFLICT (batch_id, uid_hex) DO UPDATE SET status='active'`;
    inserted += 1;
  }

  return json({ ok: true, inserted });
}
