export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { normalizeAlertSeverity, normalizeAlertType, resolveAlertsTenant } from "../../../lib/alerts-query";
import { ensureAlertsSchema } from "../../../lib/commercial-runtime-schema";

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = String((error as Error)?.message || "");
  return code === "42P01" || message.includes("does not exist") || message.includes("relation ");
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  await ensureAlertsSchema();
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const { searchParams } = new URL(req.url);
  const tenant = resolveAlertsTenant({ forcedTenantSlug, requestedTenantSlug: searchParams.get("tenant") });
  const severity = normalizeAlertSeverity(searchParams.get("severity"));
  const type = normalizeAlertType(searchParams.get("type"));
  let rows;
  try {
    rows = await sql/*sql*/`
      SELECT a.*, t.slug AS tenant_slug
      FROM security_alerts a
      LEFT JOIN tenants t ON t.id = a.tenant_id
      WHERE (${tenant} = '' OR t.slug = ${tenant})
        AND (${severity} = '' OR a.severity = ${severity})
        AND (${type} = '' OR a.type = ${type})
      ORDER BY a.created_at DESC
      LIMIT 200
    `;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureAlertsSchema();
    rows = await sql/*sql*/`
      SELECT a.*, t.slug AS tenant_slug
      FROM security_alerts a
      LEFT JOIN tenants t ON t.id = a.tenant_id
      WHERE (${tenant} = '' OR t.slug = ${tenant})
        AND (${severity} = '' OR a.severity = ${severity})
        AND (${type} = '' OR a.type = ${type})
      ORDER BY a.created_at DESC
      LIMIT 200
    `;
  }
  return json({ ok: true, items: rows });
}
