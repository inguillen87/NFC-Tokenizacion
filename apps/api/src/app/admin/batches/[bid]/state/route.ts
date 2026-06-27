export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { bid } = await params;
  const { forcedTenantSlug } = getAdminTenantScope(req);

  const batchRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.tenant_id, b.status, b.carrier_profile_code,
        (b.meta_key_ct IS NOT NULL AND b.meta_key_ct <> '') AS has_meta_key,
        (b.file_key_ct IS NOT NULL AND b.file_key_ct <> '') AS has_file_key
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      LIMIT 1
    `
    : await sql/*sql*/`
      SELECT id, tenant_id, status, carrier_profile_code,
        (meta_key_ct IS NOT NULL AND meta_key_ct <> '') AS has_meta_key,
        (file_key_ct IS NOT NULL AND file_key_ct <> '') AS has_file_key
      FROM batches
      WHERE bid = ${bid}
      LIMIT 1
    `;

  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const nextState = String(body.state || body.status || "").trim().toLowerCase();
  
  const validStates = ['draft', 'production_registered', 'active_in_market', 'deprecating', 'archived'];
  if (!validStates.includes(nextState)) {
    return json({ ok: false, reason: "invalid_state", message: `State must be one of: ${validStates.join(', ')}` }, 400);
  }

  // Transition validation: draft -> production_registered requires keys and carrier profile
  if (nextState === 'production_registered') {
    const keysPresent = Boolean(batch.has_meta_key && batch.has_file_key);
    const profilePresent = Boolean(batch.carrier_profile_code);
    if (!keysPresent || !profilePresent) {
      return json({
        ok: false,
        reason: "missing_requirements",
        message: "Cannot transition to 'production_registered' because batch is missing encrypted keys or carrier profile configuration."
      }, 400);
    }
  }

  const updated = await sql/*sql*/`
    UPDATE batches
    SET status = ${nextState}
    WHERE id = ${batch.id}
    RETURNING id, bid, status
  `;

  return json({ ok: true, batch: updated[0] });
}
