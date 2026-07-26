export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureLoyaltySchema } from "../../../../lib/loyalty-schema";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { getActiveProgram } from "../../../../lib/loyalty-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenantSlug");
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, reason: "unauthorized" }, 401);

  if (!tenantSlug) return json({ ok: false, reason: "missing_tenant" }, 400);

  await ensureLoyaltySchema();
  await ensureConsumerPortalSchema();

  const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  if (!tenantRows[0]) return json({ ok: false, reason: "tenant_not_found" }, 404);
  const tenantId = tenantRows[0].id;

  const program = await getActiveProgram(tenantId);
  if (!program) return json({ ok: false, reason: "no_active_program" }, 404);

  const memberRows = await sql`
    SELECT id, points_balance, status
    FROM loyalty_members
    WHERE tenant_id = ${tenantId}
      AND program_id = ${program.id}
      AND consumer_id = ${consumer.id}
    LIMIT 1
  `;
  const member = memberRows[0] || null;

  const rewards = await sql`SELECT id, title, description, points_cost, type FROM rewards WHERE program_id = ${program.id} AND status = 'active' ORDER BY points_cost ASC LIMIT 5`;

  return json({
    ok: true,
    program: { id: program.id, name: program.name, pointsName: program.points_name },
    member: member ? { id: member.id, pointsBalance: member.points_balance, status: member.status } : null,
    rewards
  });
}
