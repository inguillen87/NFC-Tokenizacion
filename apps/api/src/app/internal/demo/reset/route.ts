export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { checkAdmin } from '../../../../lib/auth';
import { json } from '../../../../lib/http';
import { sql } from '../../../../lib/db';

const DEMO_TENANT_SLUG = 'demobodega';
const DEMO_BATCH_ID = 'DEMO-2026-02';
const RESET_CONFIRMATION = `RESET ${DEMO_TENANT_SLUG}/${DEMO_BATCH_ID}`;

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const demoEnabled = String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
  const productionWriteEnabled = String(process.env.DEMO_ALLOW_PROD_DATA_WRITE || '').toLowerCase() === 'true';
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!demoEnabled || (isProduction && !productionWriteEnabled)) {
    return json({ ok: false, reason: 'demo_reset_disabled' }, 403);
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (
    String(body.tenant_slug || '').trim().toLowerCase() !== DEMO_TENANT_SLUG
    || String(body.bid || '').trim().toUpperCase() !== DEMO_BATCH_ID
    || String(body.confirm || '').trim() !== RESET_CONFIRMATION
  ) {
    return json({ ok: false, reason: 'reset_confirmation_required', expected: RESET_CONFIRMATION }, 400);
  }

  const tenant = (await sql`SELECT id FROM tenants WHERE slug=${DEMO_TENANT_SLUG} LIMIT 1`)[0];
  if (!tenant) return json({ ok: false, reason: 'demo_tenant_not_found' }, 404);
  const batch = (await sql`SELECT id FROM batches WHERE tenant_id=${tenant.id} AND bid=${DEMO_BATCH_ID} LIMIT 1`)[0];
  if (!batch) return json({ ok: false, reason: 'demo_batch_not_found' }, 404);

  const deleted = await sql/*sql*/`
    DELETE FROM events
    WHERE tenant_id=${tenant.id}
      AND batch_id=${batch.id}
      AND LOWER(COALESCE(source, ''))='demo'
    RETURNING id
  `;
  return json({
    ok: true,
    run_id: crypto.randomUUID(),
    tenant_slug: DEMO_TENANT_SLUG,
    bid: DEMO_BATCH_ID,
    deleted_events: deleted.length,
    preserved: ['tenant', 'batch', 'tags', 'crm'],
  });
}
