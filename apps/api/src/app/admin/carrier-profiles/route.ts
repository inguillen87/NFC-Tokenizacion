export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { enterpriseCarrierContract } from "../../../lib/carrier-profiles";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
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

  return json({
    ok: true,
    profiles: rows.map((row) => ({
      ...row,
      enterprise_contract: enterpriseCarrierContract(row.code),
    })),
    aliases: { gs1_qr: "gs1_digital_link" },
  });
}
