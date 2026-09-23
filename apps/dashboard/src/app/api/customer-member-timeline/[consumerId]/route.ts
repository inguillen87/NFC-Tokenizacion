export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readTicketResponse } from "../../../../lib/ticket-request-deadline";
import { productUrls } from "@product/config";
import {
  DashboardTenantScopeError,
  resolveDashboardTenantScope,
} from "../../../../lib/dashboard-tenant-scope-policy";
import {
  parseCustomerMemberTimelinePayload,
  validCustomerMemberTimelineConsumerId,
  validCustomerMemberTimelineCursor,
  validCustomerMemberTimelineTenant,
} from "../../../../lib/customer-member-timeline";
import {
  dashboardHighImpactPermissionMatches,
  dashboardPermissionMatches,
} from "../../../../lib/permission-policy";
import { getDashboardSessionCredential } from "../../../../lib/session";

const NO_STORE_HEADERS = { "cache-control": "private, no-store, max-age=0" };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function safeUpstreamStatus(status: number) {
  if (status === 403) return { status: 403, reason: "customer_timeline_access_denied" };
  if (status === 404) return { status: 404, reason: "customer_timeline_member_not_found" };
  if (status === 400 || status === 422) return { status: 400, reason: "customer_timeline_request_invalid" };
  // A transient upstream authentication rejection must not invalidate or clear
  // the independently validated dashboard session in the browser.
  if (status === 401) return { status: 502, reason: "customer_timeline_upstream_session_rejected" };
  return { status: 503, reason: "customer_timeline_unavailable" };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ consumerId: string }> },
) {
  const url = new URL(request.url);
  const queryKeys = [...url.searchParams.keys()];
  if (
    queryKeys.some((key) => key !== "tenant" && key !== "cursor")
    || url.searchParams.getAll("tenant").length !== 1
    || url.searchParams.getAll("cursor").length > 1
  ) {
    return json({ ok: false, reason: "customer_timeline_request_invalid" }, 400);
  }

  const requestedTenant = String(url.searchParams.get("tenant") || "").trim().toLowerCase();
  const cursor = url.searchParams.get("cursor");
  const { consumerId: rawConsumerId } = await params;
  const consumerId = String(rawConsumerId || "").trim().toLowerCase();
  if (!validCustomerMemberTimelineTenant(requestedTenant)) {
    return json({ ok: false, reason: "customer_timeline_tenant_invalid" }, 400);
  }
  if (!validCustomerMemberTimelineConsumerId(consumerId)) {
    return json({ ok: false, reason: "customer_timeline_consumer_invalid" }, 400);
  }
  if (cursor !== null && !validCustomerMemberTimelineCursor(cursor)) {
    return json({ ok: false, reason: "customer_timeline_cursor_invalid" }, 400);
  }

  let credential;
  try {
    credential = await getDashboardSessionCredential({ persistRotation: true });
  } catch {
    return json({ ok: false, reason: "dashboard_session_unavailable" }, 503);
  }
  if (!credential?.session) {
    return json({ ok: false, reason: "dashboard_session_required" }, 401);
  }

  const { session } = credential;
  const canReadPii = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "consumers.read_pii",
    session.deniedPermissions,
  );
  const canReadIncidents = dashboardPermissionMatches(
    session.permissions,
    "incidents:read",
    session.deniedPermissions,
  );
  if (!canReadPii || !canReadIncidents) {
    return json({ ok: false, reason: "customer_timeline_permissions_required" }, 403);
  }

  let tenantScope;
  try {
    tenantScope = resolveDashboardTenantScope(session, requestedTenant);
  } catch (error) {
    if (error instanceof DashboardTenantScopeError) {
      return json({ ok: false, reason: error.code }, 403);
    }
    throw error;
  }
  if (!tenantScope.tenantSlug || tenantScope.tenantSlug !== requestedTenant) {
    return json({ ok: false, reason: "tenant_scope_invalid" }, 403);
  }

  if (session.isDemo || !credential.bearerToken) {
    return json({ ok: false, reason: "customer_timeline_durable_source_required" }, 403);
  }

  const upstream = new URL(
    `/admin/consumer-network/member/${encodeURIComponent(consumerId)}/timeline`,
    productUrls.api,
  );
  upstream.searchParams.set("tenant", tenantScope.tenantSlug);
  if (cursor) upstream.searchParams.set("cursor", cursor);

  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (request.signal.aborted) cancel();
  else request.signal.addEventListener("abort", cancel, { once: true });
  const read = await readTicketResponse(fetch, upstream.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${credential.bearerToken}`, accept: "application/json" },
    cache: "no-store", redirect: "error",
  }, controller).catch(() => null).finally(() => request.signal.removeEventListener("abort", cancel));
  if (!read) return json({ ok: false, reason: "customer_timeline_unavailable" }, 503);
  const { response, body: payload } = read;
  if (!response.ok) {
    const safe = safeUpstreamStatus(response.status);
    return json({ ok: false, reason: safe.reason }, safe.status);
  }

  const parsed = parseCustomerMemberTimelinePayload(payload, {
    tenant: tenantScope.tenantSlug,
    consumerId,
  });
  if (!parsed) {
    return json({ ok: false, reason: "customer_timeline_payload_invalid" }, 502);
  }

  return json({
    ok: true,
    tenant: tenantScope.tenantSlug,
    consumerId,
    order: "desc",
    items: parsed.items,
    page: { hasMore: parsed.hasMore, nextCursor: parsed.nextCursor },
    partial: parsed.partial,
    sourceErrors: parsed.sourceErrors,
  }, 200);
}
