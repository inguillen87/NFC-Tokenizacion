export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
export async function GET(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const tenantWallets = await sql/*sql*/`
    SELECT t.slug, t.name, m.points_balance, m.lifetime_points
    FROM tenant_consumer_memberships m
    JOIN tenants t ON t.id = m.tenant_id
    WHERE m.consumer_id = ${consumer.id}
    ORDER BY m.points_balance DESC
  `;
  const networkWallet = await sql/*sql*/`
    SELECT points_balance, lifetime_points
    FROM consumer_reward_wallets
    WHERE consumer_id = ${consumer.id} AND tenant_id IS NULL AND network_scope = 'nexid_network'
    LIMIT 1
  `;
  return json({ ok: true, tenantWallets, networkWallet: networkWallet[0] || { points_balance: 0, lifetime_points: 0, enabled: false } });
}
