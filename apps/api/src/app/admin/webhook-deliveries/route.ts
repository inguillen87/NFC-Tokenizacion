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

const DELIVERY_STATUSES = new Set(["pending", "processing", "retry_scheduled", "delivered", "dead_letter"]);
const EVENT_NAME_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const ENDPOINT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
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
    const status = String(searchParams.get("status") || "").trim().toLowerCase();
    const eventName = String(searchParams.get("eventName") || "").trim().toLowerCase();
    const endpointId = String(searchParams.get("endpointId") || "").trim();
    if ((status && !DELIVERY_STATUSES.has(status))
      || (eventName && !EVENT_NAME_PATTERN.test(eventName))
      || (endpointId && !ENDPOINT_ID_PATTERN.test(endpointId))) {
      return json({ ok: false, reason: "webhook_delivery_filters_invalid" }, 400, { "cache-control": "no-store" });
    }

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
          wd.attempt_cycle_count,
          wd.manual_replay_count,
          wd.next_attempt_at,
          wd.last_attempt_at,
          wd.last_error,
          wd.created_at,
          wd.delivered_at,
          latest_attempt.latency_ms AS latest_latency_ms,
          latest_attempt.outcome AS latest_attempt_outcome,
          latest_attempt.request_id AS latest_request_id
        FROM webhook_deliveries wd
        JOIN webhook_endpoints we ON we.id = wd.endpoint_id
        JOIN tenants tn ON tn.id = we.tenant_id
        LEFT JOIN LATERAL (
          SELECT attempt.latency_ms, attempt.outcome, attempt.request_id
          FROM webhook_delivery_attempts attempt
          WHERE attempt.delivery_id = wd.id
          ORDER BY attempt.attempt_number DESC
          LIMIT 1
        ) latest_attempt ON true
        WHERE we.tenant_id = ${tenant.id}::uuid
          AND (${status || null}::text IS NULL OR wd.status = ${status || null})
          AND (${eventName || null}::text IS NULL OR wd.event_name = ${eventName || null})
          AND (${endpointId || null}::uuid IS NULL OR wd.endpoint_id = ${endpointId || null}::uuid)
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
          wd.attempt_cycle_count,
          wd.manual_replay_count,
          wd.next_attempt_at,
          wd.last_attempt_at,
          wd.last_error,
          wd.created_at,
          wd.delivered_at,
          latest_attempt.latency_ms AS latest_latency_ms,
          latest_attempt.outcome AS latest_attempt_outcome,
          latest_attempt.request_id AS latest_request_id
        FROM webhook_deliveries wd
        JOIN webhook_endpoints we ON we.id = wd.endpoint_id
        JOIN tenants tn ON tn.id = we.tenant_id
        LEFT JOIN LATERAL (
          SELECT attempt.latency_ms, attempt.outcome, attempt.request_id
          FROM webhook_delivery_attempts attempt
          WHERE attempt.delivery_id = wd.id
          ORDER BY attempt.attempt_number DESC
          LIMIT 1
        ) latest_attempt ON true
        WHERE (${status || null}::text IS NULL OR wd.status = ${status || null})
          AND (${eventName || null}::text IS NULL OR wd.event_name = ${eventName || null})
          AND (${endpointId || null}::uuid IS NULL OR wd.endpoint_id = ${endpointId || null}::uuid)
        ORDER BY wd.created_at DESC
        LIMIT ${limit}
      `;

    return json(rows.map((row) => safeWebhookEndpointProjection(row)), 200, { "cache-control": "no-store" });
  } catch (error) {
    const failure = webhookLifecycleFailure(error);
    return json({ ok: false, reason: failure.reason, required_migration: "requiredMigration" in failure ? failure.requiredMigration : undefined }, failure.status);
  }
}
