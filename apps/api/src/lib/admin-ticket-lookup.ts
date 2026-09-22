import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { sql, type SqlExecutor } from "./db";
import { json } from "./http";

export const SUPPORT_TICKET_LOOKUP_PROTOCOL = "nexid.support-ticket-lookup.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const headers = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", vary: "Authorization, Cookie" };
type Dependencies = {
  authorize?: typeof checkAdminWithPermission;
  principal?: typeof getAdminPrincipal;
  execute?: SqlExecutor;
};

function text(value: unknown): string | null { return typeof value === "string" ? value : null; }
/** Keep legacy free text as supplied to existing authorized readers. Recognized
 * support envelopes expose only display fields, never their internal bindings. */
export function projectTicketLookupDetail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length <= 20_000 && value.trimStart().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const detail = parsed as Record<string, unknown>;
        if (detail.protocol === "nexid.support-report.v1") {
          if (typeof detail.category !== "string" || !["tap_review", "seal_opened", "product_problem", "other"].includes(detail.category)
            || typeof detail.description !== "string" || !detail.description.trim() || detail.description.length > 1500) return null;
          return JSON.stringify({ protocol: detail.protocol, category: detail.category, description: detail.description });
        }
      }
    } catch { /* Historical malformed JSON remains literal, never interpreted. */ }
  }
  return value;
}

/** Authenticated exact reference lookup. It never loads a latest-N collection,
 * repairs schema, falls back by UID/BID, or expands a tenant principal's scope. */
export async function handleAdminTicketLookup(req: Request, idInput: unknown, dependencies: Dependencies = {}) {
  const fail = (reason: string, status: number) => json({ ok: false, reason }, status, headers);
  try {
    const auth = await (dependencies.authorize || checkAdminWithPermission)(req, "leads.manage");
    if (auth) {
      return fail(auth.status === 401 ? "unauthorized" : auth.status === 403 ? "forbidden" : "ticket_lookup_unavailable", [401, 403].includes(auth.status) ? auth.status : 503);
    }
    const principal = (dependencies.principal || getAdminPrincipal)(req);
    if (typeof idInput !== "string" || !UUID.test(idInput)) return fail("ticket_id_invalid", 400);
    const id = idInput.toLowerCase();
    const selectors = new URL(req.url).searchParams.getAll("tenant");
    if (selectors.length > 1) return fail("ticket_tenant_invalid", 400);
    const selectedTenant = (selectors[0] || "").trim().toLowerCase();
    if (selectedTenant && !SLUG.test(selectedTenant)) return fail("ticket_tenant_invalid", 400);
    const global = principal.scope === "super_admin";
    const principalId = principal.tenantId?.toLowerCase() || null;
    const principalSlug = principal.tenantSlug?.trim().toLowerCase() || null;
    if (!global && (!principalId || !UUID.test(principalId) || !principalSlug || !SLUG.test(principalSlug))) return fail("ticket_tenant_required", 403);
    if (!global && selectedTenant && selectedTenant !== principalSlug) return fail("ticket_not_found", 404);
    const tenantId = global ? null : principalId;
    const tenantSlug = global ? selectedTenant || null : principalSlug;
    const rows = await (dependencies.execute || sql)`
      SELECT ticket.id::text,ticket.title,ticket.detail,ticket.status,ticket.contact,ticket.created_at,
        ticket.source,ticket.category,ticket.locale,ticket.bid,ticket.tap_event_id::text,
        ticket.tenant_id::text,tenant.slug AS tenant_slug,tenant.name AS tenant_name
      FROM tickets ticket LEFT JOIN tenants tenant ON tenant.id=ticket.tenant_id
      WHERE ticket.id=${id}::uuid
        AND (${tenantId}::uuid IS NULL OR ticket.tenant_id=${tenantId}::uuid)
        AND (${tenantSlug}::text IS NULL OR tenant.slug=${tenantSlug})
      LIMIT 2
    `;
    if (rows.length === 0) return fail("ticket_not_found", 404);
    if (rows.length !== 1) return fail("ticket_lookup_unavailable", 503);
    const row = rows[0];
    const createdAt = new Date(row.created_at as string | Date);
    if (row.id !== id || row.created_at === null || !Number.isFinite(createdAt.getTime()) || typeof row.title !== "string" || typeof row.status !== "string"
      || tenantId && row.tenant_id !== tenantId || tenantSlug && row.tenant_slug !== tenantSlug) return fail("ticket_lookup_unavailable", 503);
    if (row.tenant_id !== null && (typeof row.tenant_id !== "string" || !UUID.test(row.tenant_id))) return fail("ticket_lookup_unavailable", 503);
    const projectedDetail = projectTicketLookupDetail(row.detail);
    const detail = projectedDetail?.trim() ? projectedDetail : null;
    const detailState = detail?.trim() ? "available" : typeof row.detail === "string" && row.detail.trim() ? "unavailable" : "not_recorded";
    return json({
      ok: true, protocol: SUPPORT_TICKET_LOOKUP_PROTOCOL,
      scope: { mode: tenantSlug ? "tenant" : "global", tenantId: tenantSlug ? text(row.tenant_id) : null, tenantSlug },
      ticket: {
        id, title: row.title, detail, detail_state: detailState, status: row.status,
        contact: text(row.contact), created_at: createdAt.toISOString(), source: text(row.source), category: text(row.category), locale: text(row.locale),
        bid: text(row.bid), tap_event_id: text(row.tap_event_id), tenant_id: text(row.tenant_id), tenant_slug: text(row.tenant_slug), tenant_name: text(row.tenant_name),
      },
    }, 200, headers);
  } catch { return fail("ticket_lookup_unavailable", 503); }
}
