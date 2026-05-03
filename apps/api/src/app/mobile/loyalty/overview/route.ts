export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureDefaultLoyaltyProgram, ensureLoyaltySchema } from "../../../../lib/loyalty-schema";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenantSlug");
  const memberKey = searchParams.get("memberKey"); // E.g., IP or authenticated session UUID

  if (!tenantSlug) return json({ ok: false, reason: "missing_tenant" }, 400);

  await ensureLoyaltySchema();
  await ensureConsumerPortalSchema();

  const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  if (!tenantRows[0]) return json({ ok: false, reason: "tenant_not_found" }, 404);
  const tenantId = tenantRows[0].id;

  const program = await ensureDefaultLoyaltyProgram({ tenantId, tenantSlug });
  if (!program) return json({ ok: false, reason: "no_active_program" }, 404);

  let member = null;
  if (memberKey) {
    const memberRows = await sql`SELECT id, points_balance, status FROM loyalty_members WHERE program_id = ${program.id} AND member_key = ${memberKey} LIMIT 1`;
    member = memberRows[0] || null;
  }

  const rewards = await sql`SELECT id, title, description, points_cost, type FROM rewards WHERE program_id = ${program.id} AND status = 'active' ORDER BY points_cost ASC LIMIT 5`;

  return json({
    ok: true,
    program: { id: program.id, name: program.name, pointsName: program.points_name },
    member: member ? { id: member.id, pointsBalance: member.points_balance, status: member.status } : null,
    rewards
  });
}
