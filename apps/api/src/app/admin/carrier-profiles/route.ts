export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const rows = await sql/*sql*/`
    SELECT
      code,
      label,
      family,
      security_level,
      cost_band,
      estimated_unit_cost_usd_min,
      estimated_unit_cost_usd_max,
      capabilities,
      recommended_verticals,
      allowed_actions,
      blocked_actions,
      consumer_copy,
      admin_copy,
      default_policy
    FROM carrier_profiles
    ORDER BY security_level ASC, code ASC
  `;

  return json({ ok: true, profiles: rows });
}
