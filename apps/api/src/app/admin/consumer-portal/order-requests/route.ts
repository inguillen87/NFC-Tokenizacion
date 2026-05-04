export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";

function cleanTenant(value: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = error instanceof Error ? error.message : String(error || "");
  return code === "42P01" || /relation .* does not exist|does not exist/i.test(message);
}

async function listOrderRequests(tenant: string) {
  if (tenant) {
    return sql/*sql*/`
      SELECT o.*, t.slug AS tenant_slug, c.email, c.phone, p.title AS product_title
      FROM tenants t
      JOIN marketplace_order_requests o ON o.tenant_id = t.id
      JOIN consumers c ON c.id = o.consumer_id
      LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
      WHERE t.slug = ${tenant}
      ORDER BY o.created_at DESC
      LIMIT 500
    `;
  }

  return sql/*sql*/`
    SELECT o.*, t.slug AS tenant_slug, c.email, c.phone, p.title AS product_title
    FROM tenants t
    JOIN marketplace_order_requests o ON o.tenant_id = t.id
    JOIN consumers c ON c.id = o.consumer_id
    LEFT JOIN marketplace_products p ON p.id = o.marketplace_product_id
    ORDER BY o.created_at DESC
    LIMIT 500
  `;
}

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const scope = getAdminTenantScope(req);
  const tenant = scope.forcedTenantSlug || cleanTenant(new URL(req.url).searchParams.get("tenant"));

  await ensureConsumerPortalSchema();
  try {
    const rows = await listOrderRequests(tenant);
    return json({ ok: true, tenant: tenant || "all", items: rows });
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureConsumerPortalSchema();
    const rows = await listOrderRequests(tenant);
    return json({ ok: true, tenant: tenant || "all", items: rows, recoveredSchema: true });
  }
}
