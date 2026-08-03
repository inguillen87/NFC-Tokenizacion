export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../lib/auth";
import { ensureAuditLogsSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { effectiveTenantFilter } from "../../../lib/admin-tenant-filter";

function escapeCsv(val: unknown) {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "audit.read");
  if (auth) return auth;
  await ensureAuditLogsSchema();

  const url = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantSlug = effectiveTenantFilter({ forcedTenantSlug, requestedTenantSlug: url.searchParams.get("tenant") });
  const actor = (url.searchParams.get("actor") || "").trim();
  const action = (url.searchParams.get("action") || "").trim();
  const resourceType = (url.searchParams.get("resourceType") || url.searchParams.get("resource_type") || "").trim();
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  // Date range filter
  const start = url.searchParams.get("start") || url.searchParams.get("startDate") || "";
  const end = url.searchParams.get("end") || url.searchParams.get("endDate") || "";
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const startIso = startDate && !Number.isNaN(startDate.getTime()) ? startDate.toISOString() : null;
  const endIso = endDate && !Number.isNaN(endDate.getTime()) ? endDate.toISOString() : null;

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 1000);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  const rows = await sql/*sql*/`
    SELECT
      al.id,
      al.action,
      al.resource_type,
      al.resource_id,
      al.before_hash,
      al.after_hash,
      al.ip_address::text AS ip_address,
      al.user_agent,
      al.request_id,
      al.created_at,
      u.email AS actor_email,
      u.full_name AS actor_name,
      t.slug AS tenant_slug,
      t.name AS tenant_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_id
    LEFT JOIN tenants t ON t.id = al.tenant_id
    WHERE (${tenantSlug} = '' OR t.slug = ${tenantSlug})
      AND (${actor} = '' OR u.email ILIKE ${`%${actor}%`} OR u.id::text = ${actor})
      AND (${action} = '' OR al.action = ${action})
      AND (${resourceType} = '' OR al.resource_type = ${resourceType})
      AND (${startIso}::timestamptz IS NULL OR al.created_at >= ${startIso}::timestamptz)
      AND (${endIso}::timestamptz IS NULL OR al.created_at <= ${endIso}::timestamptz)
    ORDER BY al.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  if (format === "csv") {
    const headers = [
      "ID",
      "Timestamp",
      "Actor Email",
      "Actor Name",
      "Tenant Slug",
      "Action",
      "Resource Type",
      "Resource ID",
      "Before Hash",
      "After Hash",
      "IP Address",
      "User Agent",
      "Request ID"
    ];
    const csvRows = [headers.join(",")];
    for (const row of rows) {
      csvRows.push([
        escapeCsv(row.id),
        escapeCsv(row.created_at),
        escapeCsv(row.actor_email),
        escapeCsv(row.actor_name),
        escapeCsv(row.tenant_slug),
        escapeCsv(row.action),
        escapeCsv(row.resource_type),
        escapeCsv(row.resource_id),
        escapeCsv(row.before_hash),
        escapeCsv(row.after_hash),
        escapeCsv(row.ip_address),
        escapeCsv(row.user_agent),
        escapeCsv(row.request_id)
      ].join(","));
    }
    
    return new Response(csvRows.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="audit-logs-${tenantSlug || "global"}.csv"`,
        "cache-control": "no-store"
      }
    });
  }

  return json({ ok: true, count: rows.length, rows });
}
