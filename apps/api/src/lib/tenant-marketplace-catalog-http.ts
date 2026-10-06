import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { sql } from "./db";
import { CatalogError, TENANT_MARKETPLACE_PROTOCOL, parseCatalogCommand, parseCatalogQuery, readCatalog, resolveCatalogTenant, writeCatalog } from "./tenant-marketplace-catalog";
const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store, max-age=0" } });
export function createCatalogHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, write: boolean) {
    try {
      const denied = await deps.authorize(req, write ? "marketplace:write" : "marketplace:read");
      if (denied) { const response = new Response(denied.body, denied); response.headers.set("cache-control", "private, no-store, max-age=0"); return response; }
      const principal = deps.principal(req);
      if (write && principal.scope !== "tenant_admin" && principal.scope !== "super_admin") return json({ ok: false, reason: "catalog_forbidden" }, 403);
      const filter = parseCatalogQuery(new URL(req.url).searchParams);
      if (write && filter.id !== null) throw new CatalogError("catalog_query_invalid");
      const tenant = await resolveCatalogTenant(filter.tenant, principal, deps.query);
      if (!write) return json({ ok: true, protocol: TENANT_MARKETPLACE_PROTOCOL, tenant: tenant.slug, ...await readCatalog(tenant, deps.query, filter.id) });
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) throw new CatalogError("catalog_content_type_invalid", 415);
      let raw: unknown; try { raw = await readBoundedJsonBody(req, 24 * 1024); }
      catch (e) { throw new CatalogError(e instanceof RequestBodyTooLargeError ? "catalog_body_too_large" : "catalog_body_invalid", e instanceof RequestBodyTooLargeError ? 413 : 400); }
      const command = parseCatalogCommand(raw), item = await writeCatalog(tenant, command, deps.query);
      return json({ ok: true, protocol: TENANT_MARKETPLACE_PROTOCOL, tenant: tenant.slug, kind: command.kind, item });
    } catch (e) {
      return json({ ok: false, reason: e instanceof CatalogError ? e.message : "catalog_unavailable", ...(e instanceof CatalogError && e.currentUpdatedAt ? { currentUpdatedAt: e.currentUpdatedAt } : {}) }, e instanceof CatalogError ? e.status : 503);
    }
  }
  return { GET: (req: Request) => handle(req, false), POST: (req: Request) => handle(req, true) };
}
