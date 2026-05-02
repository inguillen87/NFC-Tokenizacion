export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';
import { parseTagManifest } from '../../../../../lib/tag-manifest';
import { requireTenantSunProfile } from '../../../../../lib/tenant-onboarding';

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = Array.isArray(body.uids) ? body.uids : [];
  if (!raw.length) return json({ ok: false, reason: 'uids required' }, 400);

  const batchRows = await sql`SELECT id, tenant_id FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: 'batch not found' }, 404);
  const readiness = await requireTenantSunProfile(String(batch.tenant_id)).catch((error) => ({ ok: false, missing: (error as Error & { missing?: string[] }).missing || ['tenant_sun_profiles'] }));
  if (!readiness.ok) return json({ ok: false, reason: 'tenant_sun_profile_incomplete', missing: readiness.missing }, 409);

  const manifest = parseTagManifest(raw.join('\n'), bid);
  if (manifest.rejectedRows.length) {
    await sql`
      INSERT INTO tenant_manifests (
        tenant_id, batch_id, bid, manifest_type, row_count, duplicate_count, rejected_count, content_hash, import_status, errors_json
      ) VALUES (
        ${batch.tenant_id}, ${batch.id}, ${bid}, 'txt', ${manifest.rows.length}, ${manifest.duplicateUids.length}, ${manifest.rejectedRows.length}, ${manifest.contentHash}, 'rejected', ${JSON.stringify(manifest.rejectedRows)}::jsonb
      )
    `;
    return json({ ok: false, reason: 'manifest_validation_failed', rejectedRows: manifest.rejectedRows, duplicateUids: manifest.duplicateUids }, 400);
  }

  let inserted = 0;

  for (const row of manifest.rows) {
    const result = await sql`
      INSERT INTO tags (batch_id, uid_hex, status)
      VALUES (${batch.id}, ${row.uidHex}, 'inactive')
      ON CONFLICT (batch_id, uid_hex)
      DO NOTHING
      RETURNING uid_hex
    `;
    if (result.length) inserted += 1;
  }

  await sql`
    INSERT INTO tenant_manifests (
      tenant_id, batch_id, bid, manifest_type, row_count, inserted_count, duplicate_count, rejected_count, content_hash, import_status, errors_json
    ) VALUES (
      ${batch.tenant_id}, ${batch.id}, ${bid}, 'txt', ${manifest.rows.length}, ${inserted}, 0, 0, ${manifest.contentHash}, 'imported', '[]'::jsonb
    )
  `;

  return json({ ok: true, batch: bid, imported: inserted, duplicates: 0, totalParsed: manifest.rows.length });
}
