export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdminPermission,
  checkAdminWithPermission,
  getAdminTenantScope,
} from "../../../../../../lib/auth";
import { json } from "../../../../../../lib/http";
import {
  decodeConsumerTimelineCursor,
  listConsumerSignalTimeline,
  validConsumerTimelineConsumerId,
  validConsumerTimelineTenantSlug,
} from "../../../../../../lib/consumer-signal-timeline";

const NO_STORE_HEADERS = { "cache-control": "private, no-store, max-age=0" };

function safeTimelineFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "required_schema_migration_not_applied") return "schema_watermark_unavailable";
  if (message === "DATABASE_URL is not set") return "database_unavailable";
  return "consumer_timeline_unavailable";
}

export async function GET(req: Request, { params }: { params: Promise<{ consumerId: string }> }) {
  const piiAuth = await checkAdminWithPermission(req, "consumers.read_pii");
  if (piiAuth) return piiAuth;
  const incidentAuth = checkAdminPermission(req, "incidents:read");
  if (incidentAuth) return incidentAuth;

  const url = new URL(req.url);
  const requestedTenant = String(url.searchParams.get("tenant") || "").trim().toLowerCase();
  if (!requestedTenant) {
    return json({ ok: false, reason: "consumer_timeline_tenant_required" }, 400, NO_STORE_HEADERS);
  }
  if (!validConsumerTimelineTenantSlug(requestedTenant)) {
    return json({ ok: false, reason: "consumer_timeline_tenant_invalid" }, 400, NO_STORE_HEADERS);
  }

  const tenantScope = getAdminTenantScope(req);
  if (
    (tenantScope.scope === "tenant_admin" || tenantScope.scope === "tenant_operator" || tenantScope.scope === "reseller")
    && (!tenantScope.forcedTenantSlug || tenantScope.forcedTenantSlug !== requestedTenant)
  ) {
    return json({ ok: false, reason: "consumer_timeline_tenant_forbidden" }, 403, NO_STORE_HEADERS);
  }

  const { consumerId: rawConsumerId } = await params;
  const consumerId = String(rawConsumerId || "").trim().toLowerCase();
  if (!validConsumerTimelineConsumerId(consumerId)) {
    return json({ ok: false, reason: "consumer_timeline_consumer_invalid" }, 400, NO_STORE_HEADERS);
  }

  let cursor;
  try {
    cursor = decodeConsumerTimelineCursor(url.searchParams.get("cursor"));
  } catch {
    return json({ ok: false, reason: "consumer_timeline_cursor_invalid" }, 400, NO_STORE_HEADERS);
  }

  try {
    const timeline = await listConsumerSignalTimeline({
      tenantSlug: requestedTenant,
      consumerId,
      cursor,
    });
    if (!timeline.memberFound) {
      return json({ ok: false, reason: "consumer_timeline_member_not_found" }, 404, NO_STORE_HEADERS);
    }
    return json({
      ok: true,
      tenant: requestedTenant,
      consumerId,
      order: "desc",
      items: timeline.items,
      page: timeline.page,
      partial: timeline.partial,
      sourceErrors: timeline.sourceErrors,
    }, 200, NO_STORE_HEADERS);
  } catch (error) {
    return json({ ok: false, reason: safeTimelineFailure(error) }, 503, NO_STORE_HEADERS);
  }
}
