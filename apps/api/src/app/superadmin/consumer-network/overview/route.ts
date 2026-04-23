export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const rows = await sql/*sql*/`
    SELECT
      (SELECT COUNT(*)::int FROM consumers) AS consumers,
      (SELECT COUNT(*)::int FROM tenant_consumer_memberships) AS memberships,
      (SELECT COUNT(*)::int FROM marketplace_brand_profiles WHERE visible_in_network = true) AS brands,
      (SELECT COUNT(*)::int FROM marketplace_products WHERE status = 'active') AS products,
      (SELECT COUNT(*)::int FROM marketplace_order_requests) AS order_requests
  `;
  return json({ ok: true, overview: rows[0] });
}
