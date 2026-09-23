import type { DashboardSession } from "./session";
import { dashboardCanOpenDestination } from "./dashboard-destination-policy";
import { resolveDashboardTenantScope } from "./dashboard-tenant-scope-policy";
import { canReadRecallWorkspace } from "./recall-workspace";
import { canUseEpcisIntake } from "./epcis-intake-access";
import { traceRequestScopeAllowed } from "./batch-traceability-access";

export const BATCH_WORKSPACE_VIEWS = ["overview", "passport", "production", "channels", "traceability", "intake", "recalls"] as const;
export type BatchWorkspaceView = typeof BATCH_WORKSPACE_VIEWS[number];
type Session = Pick<DashboardSession, "role" | "permissions" | "deniedPermissions" | "tenantSlug" | "isDemo">;
export type BatchWorkspaceNavigationModel = {
  bid: string; tenant: string; listHref: string | null;
  reason: "ready" | "invalid_context" | "tenant_required" | "scope_mismatch" | "access_denied";
  items: { view: BatchWorkspaceView; href: string | null; current: boolean; blocked: "demo" | "permission" | null }[];
};
function validBid(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && value.trim() === value
    && ![".", ".."].includes(value) && !/[\u0000-\u001f\u007f-\u009f/\\%?#]/.test(value);
}
function validTenant(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value);
}
/** Only allowlisted same-application routes. Never inherit arbitrary query data or return URLs. */
export function batchWorkspaceHref(bid: unknown, tenant: unknown, view: BatchWorkspaceView = "overview"): string | null {
  if (!validBid(bid) || !validTenant(tenant) || !BATCH_WORKSPACE_VIEWS.includes(view)) return null;
  try {
    const suffix = view === "overview" ? "" : `/${view}`;
    return `/batches/${encodeURIComponent(bid)}${suffix}?${new URLSearchParams({ tenant })}`;
  } catch { return null; }
}
export function buildBatchWorkspaceNavigation(bid: unknown, tenant: unknown, current: BatchWorkspaceView, session: Session): BatchWorkspaceNavigationModel {
  const unavailable = (reason: BatchWorkspaceNavigationModel["reason"]): BatchWorkspaceNavigationModel => ({ bid: "", tenant: "", listHref: null, reason, items: [] });
  if (tenant === "") return unavailable("tenant_required");
  if (!batchWorkspaceHref(bid, tenant, current)) return unavailable("invalid_context");
  const expectedTenant = tenant as string, expectedBid = bid as string;
  try {
    // The server's existing scope policy is reused, not replaced by a UI grant.
    if (resolveDashboardTenantScope(session, expectedTenant).tenantSlug !== expectedTenant) return unavailable("scope_mismatch");
  } catch { return unavailable("scope_mismatch"); }
  if (!dashboardCanOpenDestination("batches", session)) return unavailable("access_denied");
  const traceAllowed = traceRequestScopeAllowed(session, expectedTenant);
  const allowed = { overview: true, passport: !session.isDemo, production: !session.isDemo, channels: !session.isDemo,
    traceability: traceAllowed, intake: traceAllowed && canUseEpcisIntake(session), recalls: canReadRecallWorkspace(session) };
  return { bid: expectedBid, tenant: expectedTenant, listHref: `/batches?${new URLSearchParams({ tenant: expectedTenant })}`, reason: "ready",
    items: BATCH_WORKSPACE_VIEWS.map(view => ({ view, href: allowed[view] ? batchWorkspaceHref(expectedBid, expectedTenant, view) : null,
      current: view === current, blocked: allowed[view] ? null : session.isDemo ? "demo" : "permission" })) };
}
