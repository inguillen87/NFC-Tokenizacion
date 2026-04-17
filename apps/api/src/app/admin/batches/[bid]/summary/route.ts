export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../../lib/auth';
import { json } from '../../../../../lib/http';
import { sql } from '../../../../../lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const rows = await sql`
    SELECT
      b.bid,
      b.status,
      t.slug AS tenant_slug,
      COALESCE(b.sdm_config->>'chip_model', '') AS chip_model,
      COALESCE(b.sdm_config->>'sku', '') AS sku,
      COALESCE(NULLIF(b.sdm_config->>'requested_quantity', ''), '0')::int AS requested_quantity,
      COUNT(tags.id)::int AS imported_tags,
      COUNT(tags.id) FILTER (WHERE tags.status='active')::int AS active_tags,
      COUNT(tags.id) FILTER (WHERE tags.status='inactive')::int AS inactive_tags,
      (b.meta_key_ct IS NOT NULL) AS has_meta_key,
      (b.file_key_ct IS NOT NULL) AS has_file_key
    FROM batches b
    JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN tags ON tags.batch_id = b.id
    WHERE b.bid = ${bid}
    GROUP BY b.id, t.slug
    LIMIT 1
  `;

  if (!rows[0]) return json({ ok: false, reason: 'batch not found' }, 404);
  return json({ ok: true, batch: rows[0] });
}
