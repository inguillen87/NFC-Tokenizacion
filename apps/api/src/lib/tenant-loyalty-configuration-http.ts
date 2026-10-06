import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { resolveCampaignDraftTenant } from "./campaign-drafts";
import { sql } from "./db";
import { ConfigurationError, parseConfigurationWrite, readConfiguration, writeConfiguration } from "./tenant-loyalty-configuration";
const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store, max-age=0" } });
export function createConfigurationHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, write: boolean) {
    try {
      const auth = await deps.authorize(req, write ? "rewards:write" : "rewards:read");
      if (auth) { const response = new Response(auth.body, auth); response.headers.set("cache-control", "private, no-store, max-age=0"); return response; }
      const principal = deps.principal(req), requested = new URL(req.url).searchParams.get("tenant");
      const tenant = await resolveCampaignDraftTenant(principal.scope === "super_admin" ? requested : principal.tenantSlug, principal, deps.query);
      if (!write) return json({ ok: true, tenant: tenant.slug, ...await readConfiguration(tenant, deps.query) });
      let raw: unknown;
      try { raw = await readBoundedJsonBody(req, 48 * 1024); }
      catch (e) { throw new ConfigurationError(e instanceof RequestBodyTooLargeError ? "configuration_body_too_large" : "configuration_invalid", e instanceof RequestBodyTooLargeError ? 413 : 400); }
      const input = parseConfigurationWrite(raw);
      return json({ ok: true, tenant: tenant.slug, ...await writeConfiguration(tenant, principal.userId, input, deps.query) });
    } catch (e) {
      const status = e instanceof ConfigurationError ? e.status : typeof recordError(e).status === "number" ? recordError(e).status as number : 503;
      return json({ ok: false, reason: e instanceof ConfigurationError ? e.message : status === 503 ? "configuration_unavailable" : "configuration_tenant_required" }, status);
    }
  }
  return { GET: (req: Request) => handle(req, false), POST: (req: Request) => handle(req, true) };
}
function recordError(e: unknown): {status?:unknown} { return e && typeof e === "object" ? e : {}; }
