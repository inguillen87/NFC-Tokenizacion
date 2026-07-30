export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../lib/auth";
import { ensureSdkSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { resolveWebhookTenant, safeWebhookEndpointProjection, webhookLifecycleFailure } from "../../../lib/webhook-lifecycle";
import { checkWebhookPermission } from "../webhooks/policy";

function boundedLimit(value: string | null) {
  const parsed = Number(value || 50);
  return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, 1), 500) : 50;
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "read");
  if (permission) return permission;
  const principal = getAdminPrincipal(req);
  const { searchParams } = new URL(req.url);

  try {
    await ensureSdkSchema();
    const requestedTenant = searchParams.get("tenant");
    const tenant = await resolveWebhookTenant(principal, requestedTenant);
    if ((principal.scope !== "super_admin" || requestedTenant) && !tenant) {
      return json({ ok: false, reason: "tenant_not_found" }, 404);
    }
    const limit = boundedLimit(searchParams.get("limit"));

    const rows = tenant
      ? await sql/*sql*/`
        SELECT
          wd.id,
          tn.slug AS tenant_slug,
          wd.endpoint_id::text AS endpoint_id,
          wd.endpoint_url AS url,
          CASE WHEN we.deleted_at IS NOT NULL THEN 'deleted' WHEN we.enabled THEN 'active' ELSE 'disabled' END AS endpoint_lifecycle_status,
          wd.event_id,
          wd.event_name,
          wd.status,
          wd.status_code,
          wd.ok,
          wd.attempt_count,
          wd.next_attempt_at,
          wd.last_attempt_at,
          wd.last_error,
          wd.created_at,
          wd.delivered_at
        FROM webhook_deliveries wd
        JOIN webhook_endpoints we ON we.id = wd.endpoint_id
        JOIN tenants tn ON tn.id = we.tenant_id
        WHERE we.tenant_id = ${tenant.id}::uuid
        ORDER BY wd.created_at DESC
        LIMIT ${limit}
      `
      : await sql/*sql*/`
        SELECT
          wd.id,
          tn.slug AS tenant_slug,
          wd.endpoint_id::text AS endpoint_id,
          wd.endpoint_url AS url,
          CASE WHEN we.deleted_at IS NOT NULL THEN 'deleted' WHEN we.enabled THEN 'active' ELSE 'disabled' END AS endpoint_lifecycle_status,
          wd.event_id,
          wd.event_name,
          wd.status,
          wd.status_code,
          wd.ok,
          wd.attempt_count,
          wd.next_attempt_at,
          wd.last_attempt_at,
          wd.last_error,
          wd.created_at,
          wd.delivered_at
        FROM webhook_deliveries wd
        JOIN webhook_endpoints we ON we.id = wd.endpoint_id
        JOIN tenants tn ON tn.id = we.tenant_id
        ORDER BY wd.created_at DESC
        LIMIT ${limit}
      `;

    return json(rows.map((row) => safeWebhookEndpointProjection(row)), 200, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}
