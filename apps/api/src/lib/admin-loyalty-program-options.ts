import { checkAdmin, checkAdminPermission, getAdminPrincipal } from "./auth";
import { sql } from "./db";

const LIMIT = 100;
const VERSION = "admin-loyalty-program-options.v1";
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const STATUSES = ["draft", "active", "paused", "archived"] as const;
const defaults = { checkAdmin, checkAdminPermission, getAdminPrincipal, query: sql };

const response = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "private, no-store, max-age=0" },
});
const unavailable = () => response({ ok: false, error: "program_options_unavailable" }, 503);

export function createAdminLoyaltyProgramOptionsGet(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  return async (req: Request) => {
    if (req.method !== "GET") return response({ ok: false, error: "method_not_allowed" }, 405);
    try {
      const auth = await deps.checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator"]);
      if (auth) return auth.status === 401
        ? response({ ok: false, error: "unauthorized" }, 401)
        : auth.status === 403 ? response({ ok: false, error: "forbidden" }, 403) : unavailable();
      if (deps.checkAdminPermission(req, "rewards:read")) return response({ ok: false, error: "forbidden" }, 403);

      const query = new URL(req.url).searchParams;
      const requested = query.get("tenant");
      if ([...query.keys()].some(key => key !== "tenant") || query.getAll("tenant").length > 1
        || (requested !== null && !TENANT_SLUG.test(requested))) {
        return response({ ok: false, error: "tenant_selector_invalid" }, 400);
      }

      const principal = deps.getAdminPrincipal(req);
      let tenant: string;
      let tenantId: string | null = null;
      if (principal.scope === "super_admin") {
        if (!requested) return response({ ok: false, error: "tenant_required" }, 400);
        tenant = requested;
      } else {
        if (!principal.tenantSlug || !TENANT_SLUG.test(principal.tenantSlug) || !principal.tenantId
          || !UUID.test(principal.tenantId) || (requested !== null && requested !== principal.tenantSlug)) {
          return response({ ok: false, error: "forbidden" }, 403);
        }
        tenant = principal.tenantSlug;
        tenantId = principal.tenantId;
      }

      // A left lateral join returns one sentinel row for an existing empty tenant.
      // Tenant binding and the bounded ordered page are checked in the same statement.
      const rows = await deps.query`
        SELECT t.slug AS tenant_slug, p.id, p.name, p.status
        FROM public.tenants t
        LEFT JOIN LATERAL (
          SELECT id, name, status
          FROM public.loyalty_programs
          WHERE tenant_id = t.id
          ORDER BY (status = 'active') DESC, name, id
          LIMIT ${LIMIT + 1}
        ) p ON TRUE
        WHERE t.slug = ${tenant} AND t.id = COALESCE(${tenantId}::uuid, t.id)
        ORDER BY (p.status = 'active') DESC, p.name, p.id
      `;
      if (rows.length === 0) return response({ ok: false, error: "tenant_not_found" }, 404);
      if (rows.length > LIMIT + 1 || rows.some(row => row.tenant_slug !== tenant)) return unavailable();

      const programs = [];
      const seen = new Set<string>();
      for (const row of rows) {
        if (rows.length === 1 && row.id === null && row.name === null && row.status === null) break;
        const status = STATUSES.find(value => value === row.status);
        if (typeof row.id !== "string" || !UUID.test(row.id) || seen.has(row.id.toLowerCase())
          || typeof row.name !== "string" || !status) return unavailable();
        seen.add(row.id.toLowerCase());
        programs.push({ id: row.id, name: row.name, status });
      }
      return response({ ok: true, version: VERSION, tenant, programs: programs.slice(0, LIMIT),
        limit: LIMIT, truncated: programs.length > LIMIT });
    } catch {
      return unavailable();
    }
  };
}
