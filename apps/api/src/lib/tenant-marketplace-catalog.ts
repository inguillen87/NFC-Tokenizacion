import type { AdminPrincipal } from "./auth";
import type { SqlExecutor } from "./db";

export const TENANT_MARKETPLACE_PROTOCOL = "nexid.tenant-marketplace-catalog.v1";
export type CatalogTenant = { id: string; slug: string };
export class CatalogError extends Error {
  constructor(message: string, public status = 400, public currentUpdatedAt?: string) { super(message); this.name = "CatalogError"; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const has = (v: Record<string, unknown>, k: string) => Object.hasOwn(v, k);
const invalid = (field: string): never => { throw new CatalogError("catalog_" + field + "_invalid"); };
function record(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid("body");
  const r = v as Record<string, unknown>;
  if (Object.keys(r).some(k => !keys.includes(k))) return invalid("fields");
  return r;
}
function text(v: unknown, field: string, max: number, nullable = false, multiline = false) {
  if (nullable && v === null) return null;
  if (typeof v !== "string" || v.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(v)) return invalid(field);
  return v.trim();
}
function vertical(v: unknown) { if (typeof v !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(v)) return invalid("vertical"); return v; }
function boolean(v: unknown, field: string) { if (typeof v !== "boolean") return invalid(field); return v; }
export function catalogUuid(v: unknown): string { if (typeof v !== "string" || !UUID.test(v)) return invalid("id"); return v; }
function publicHost(host: string) {
  const h = host.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.includes(":")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false; // Public DNS links only; no network address shortcuts.
  return true;
}
function link(v: unknown, field: string, image = false) {
  if (v === null) return null;
  if (typeof v !== "string" || !v || v.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(v)) return invalid(field);
  if (image && /^\/(?:assets|images)\/[A-Za-z0-9/_.,@-]+$/.test(v) && !v.split("/").includes("..")) return v;
  let u: URL; try { u = new URL(v); } catch { return invalid(field); }
  if (u.protocol !== "https:" || u.username || u.password || u.hash || u.port || !publicHost(u.hostname)) return invalid(field);
  return u.href;
}
function price(v: unknown) {
  if (v === null) return null;
  if (typeof v !== "string" || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(v)) return invalid("price_amount");
  const [whole, fraction = ""] = v.split(".");
  return whole + "." + fraction.padEnd(2, "0");
}
function timestamp(v: unknown) {
  if (typeof v !== "string" || !STAMP.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v.slice(0, 23) + "Z") return invalid("expected_updated_at");
  return v;
}
const PRODUCT_FIELDS = ["title", "description", "vertical", "category", "image_url", "price_amount", "price_currency", "external_checkout_url", "request_to_buy_enabled", "age_gate_required"];
const BRAND_FIELDS = ["display_name", "slug", "vertical", "description", "country", "city"];
export function parseProductContent(raw: unknown) {
  const v = record(raw, PRODUCT_FIELDS); if (!PRODUCT_FIELDS.every(k => has(v, k))) return invalid("content");
  const amount = price(v.price_amount), currency = v.price_currency;
  if (currency !== null && (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency))) return invalid("price_currency");
  if ((amount === null) !== (currency === null)) return invalid("price_pair");
  return { title: text(v.title, "title", 160) as string, description: text(v.description, "description", 6000, true, true), vertical: vertical(v.vertical), category: text(v.category, "category", 120, true), image_url: link(v.image_url, "image_url", true), price_amount: amount, price_currency: currency as string | null, external_checkout_url: link(v.external_checkout_url, "external_checkout_url"), request_to_buy_enabled: boolean(v.request_to_buy_enabled, "request_to_buy_enabled"), age_gate_required: boolean(v.age_gate_required, "age_gate_required") };
}
export function parseBrandContent(raw: unknown) {
  const v = record(raw, BRAND_FIELDS); if (!BRAND_FIELDS.every(k => has(v, k))) return invalid("content");
  if (typeof v.slug !== "string" || !SLUG.test(v.slug)) return invalid("slug");
  return { display_name: text(v.display_name, "display_name", 160) as string, slug: v.slug, vertical: vertical(v.vertical), description: text(v.description, "description", 6000, true, true), country: text(v.country, "country", 80, true), city: text(v.city, "city", 120, true) };
}
export type ProductContent = ReturnType<typeof parseProductContent>;
export type BrandContent = ReturnType<typeof parseBrandContent>;
export type CatalogCommand = { kind: "product" | "brand"; action: "save_draft" | "publish" | "withdraw"; id: string; expectedUpdatedAt: string | null; content?: ProductContent | BrandContent; visible_in_network?: true };
export function parseCatalogCommand(raw: unknown): CatalogCommand {
  const v = record(raw, ["kind", "action", "id", "expectedUpdatedAt", "content", "visible_in_network"]);
  if (v.kind !== "product" && v.kind !== "brand") return invalid("kind");
  if (v.action !== "save_draft" && v.action !== "publish" && v.action !== "withdraw") return invalid("action");
  const id = catalogUuid(v.id); if (!has(v, "expectedUpdatedAt")) return invalid("expected_updated_at");
  const expectedUpdatedAt = v.expectedUpdatedAt === null ? null : timestamp(v.expectedUpdatedAt);
  if (expectedUpdatedAt === null && v.action !== "save_draft") return invalid("expected_updated_at");
  if (v.action === "save_draft") {
    if (has(v, "visible_in_network")) return invalid("fields");
    return { kind: v.kind, action: v.action, id, expectedUpdatedAt, content: v.kind === "product" ? parseProductContent(v.content) : parseBrandContent(v.content) };
  }
  if (has(v, "content")) return invalid("fields");
  if (v.kind === "brand" && v.action === "publish") { if (v.visible_in_network !== true) return invalid("network_visibility"); }
  else if (has(v, "visible_in_network")) return invalid("fields");
  return { kind: v.kind, action: v.action, id, expectedUpdatedAt, ...(v.kind === "brand" && v.action === "publish" ? { visible_in_network: true as const } : {}) };
}
export function parseCatalogQuery(params: URLSearchParams) {
  for (const k of params.keys()) if (!["tenant", "id"].includes(k) || params.getAll(k).length !== 1) return invalid("query");
  return { tenant: params.get("tenant"), id: params.has("id") ? catalogUuid(params.get("id")) : null };
}
export async function resolveCatalogTenant(requested: string | null, principal: AdminPrincipal, query: SqlExecutor): Promise<CatalogTenant> {
  const bound = principal.scope !== "super_admin";
  const slug = bound ? principal.tenantSlug : requested;
  if (!slug) throw new CatalogError("catalog_tenant_required");
  if (!SLUG.test(slug)) return invalid("tenant");
  if (bound && (!principal.tenantId || !UUID.test(principal.tenantId) || requested !== null && requested !== slug)) throw new CatalogError("catalog_tenant_mismatch", 403);
  const [r] = await query`SELECT id::text, slug FROM tenants WHERE slug = ${slug} LIMIT 1`;
  if (!r) throw new CatalogError("catalog_tenant_not_found", 404);
  if (typeof r.id !== "string" || !UUID.test(r.id) || r.slug !== slug) throw new CatalogError("catalog_unavailable", 503);
  if (bound && r.id !== principal.tenantId) throw new CatalogError("catalog_tenant_mismatch", 403);
  return { id: r.id, slug };
}
function stampRow(row: Record<string, unknown>) { try { return timestamp(row.updatedAt); } catch { throw new CatalogError("catalog_stored_data_invalid", 503); } }
function rowState(row: Record<string, unknown>) { if (typeof row.status !== "string" || !row.status || row.status.length > 32) throw new CatalogError("catalog_stored_data_invalid", 503); return row.status; }
function productRow(row: Record<string, unknown>) {
  try {
    const content = parseProductContent({ ...Object.fromEntries(PRODUCT_FIELDS.map(k => [k, row[k]])), price_amount: row.price_amount === null ? null : String(row.price_amount) });
    return { id: catalogUuid(row.id), ...content, status: rowState(row), updatedAt: stampRow(row) };
  } catch (e) { if (e instanceof CatalogError && e.status === 503) throw e; throw new CatalogError("catalog_stored_data_invalid", 503); }
}
function brandRow(row: Record<string, unknown>) {
  try {
    const content = parseBrandContent(Object.fromEntries(BRAND_FIELDS.map(k => [k, row[k]])));
    return { id: catalogUuid(row.id), ...content, status: rowState(row), visible_in_network: boolean(row.visible_in_network, "network_visibility"), updatedAt: stampRow(row) };
  } catch (e) { if (e instanceof CatalogError && e.status === 503) throw e; throw new CatalogError("catalog_stored_data_invalid", 503); }
}
export async function readCatalog(tenant: CatalogTenant, query: SqlExecutor, id: string | null = null) {
  const [brands, products] = await Promise.all([
    query`SELECT b.*, to_char(b.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt" FROM marketplace_brand_profiles b WHERE b.tenant_id = ${tenant.id}::uuid LIMIT 1`,
    query`SELECT p.*, to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt" FROM marketplace_products p WHERE p.tenant_id = ${tenant.id}::uuid AND (${id}::uuid IS NULL OR p.id = ${id}::uuid) ORDER BY p.updated_at DESC, p.id DESC LIMIT 101`,
  ]);
  return { brand: brands[0] ? brandRow(brands[0]) : null, items: products.slice(0, 100).map(productRow), hasMore: products.length > 100 };
}
async function currentProduct(tenant: CatalogTenant, id: string, query: SqlExecutor) {
  const [r] = await query`SELECT p.*, to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt" FROM marketplace_products p WHERE p.tenant_id = ${tenant.id}::uuid AND p.id = ${id}::uuid LIMIT 1`;
  if (!r) throw new CatalogError("catalog_product_not_found", 404); return productRow(r);
}
async function currentBrand(tenant: CatalogTenant, id: string, query: SqlExecutor) {
  const [r] = await query`SELECT b.*, to_char(b.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt" FROM marketplace_brand_profiles b WHERE b.tenant_id = ${tenant.id}::uuid AND b.id = ${id}::uuid LIMIT 1`;
  if (!r) throw new CatalogError("catalog_brand_not_found", 404); return brandRow(r);
}
function revision(current: { updatedAt: string }, command: CatalogCommand) { if (current.updatedAt !== command.expectedUpdatedAt) throw new CatalogError("catalog_revision_conflict", 409, current.updatedAt); }
function managedState(current: { status: string; updatedAt: string }) {
  if (!["draft", "active", "withdrawn"].includes(current.status)) throw new CatalogError("catalog_state_not_managed", 409, current.updatedAt);
}
export async function writeCatalog(tenant: CatalogTenant, command: CatalogCommand, query: SqlExecutor) {
  const { id, kind, action, expectedUpdatedAt } = command;
  try {
    if (expectedUpdatedAt === null) {
      if (kind === "product") {
        const c = command.content as ProductContent;
        const [r] = await query`INSERT INTO marketplace_products (id, tenant_id, status, title, description, vertical, category, image_url, price_amount, price_currency, external_checkout_url, request_to_buy_enabled, age_gate_required, accepts_rewards, accepts_tenant_points, accepts_network_credits, authenticity_program_badge, featured) VALUES (${id}::uuid, ${tenant.id}::uuid, 'draft', ${c.title}, ${c.description}, ${c.vertical}, ${c.category}, ${c.image_url}, ${c.price_amount}::numeric, ${c.price_currency}, ${c.external_checkout_url}, ${c.request_to_buy_enabled}, ${c.age_gate_required}, false, false, false, false, false) ON CONFLICT DO NOTHING RETURNING *, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`;
        if (!r) throw new CatalogError("catalog_identity_conflict", 409); return productRow(r);
      }
      const c = command.content as BrandContent;
      const [r] = await query`INSERT INTO marketplace_brand_profiles (id, tenant_id, status, display_name, slug, vertical, description, country, city, visible_in_network, accepts_network_credits, featured) VALUES (${id}::uuid, ${tenant.id}::uuid, 'draft', ${c.display_name}, ${c.slug}, ${c.vertical}, ${c.description}, ${c.country}, ${c.city}, false, false, false) ON CONFLICT DO NOTHING RETURNING *, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`;
      if (!r) throw new CatalogError("catalog_identity_conflict", 409); return brandRow(r);
    }
    const current = kind === "product" ? await currentProduct(tenant, id, query) : await currentBrand(tenant, id, query);
    revision(current, command);
    managedState(current);
    if (action === "save_draft" && current.status === "active") throw new CatalogError("catalog_withdraw_required", 409, current.updatedAt);
    if (action === "publish") {
      if (current.status !== "draft" && current.status !== "withdrawn") throw new CatalogError("catalog_state_conflict", 409, current.updatedAt);
      if (kind === "product") {
        const c = current as ReturnType<typeof productRow>;
        if (!c.title || (!c.request_to_buy_enabled && !c.external_checkout_url)) throw new CatalogError("catalog_publish_incomplete", 400);
      } else if (!(current as ReturnType<typeof brandRow>).display_name) throw new CatalogError("catalog_publish_incomplete", 400);
    }
    const desired = action === "publish" ? "active" : action === "withdraw" ? "withdrawn" : "draft";
    if (kind === "product") {
      const c = (action === "save_draft" ? command.content : current) as ProductContent;
      // Match contextual request lock order: brand first, then product. A
      // concurrent brand withdrawal must be rechecked after a row-lock wait.
      const [r] = await query`
        WITH locked_brand AS MATERIALIZED (
          SELECT b.status, b.visible_in_network FROM marketplace_brand_profiles b
          WHERE b.tenant_id = ${tenant.id}::uuid FOR SHARE OF b
        ), locked_product AS MATERIALIZED (
          SELECT p.id FROM marketplace_products p
          CROSS JOIN (SELECT count(*) FROM locked_brand) brand_barrier
          WHERE p.tenant_id = ${tenant.id}::uuid AND p.id = ${id}::uuid
            AND p.updated_at = ${expectedUpdatedAt}::timestamptz
            AND p.status IN ('draft','active','withdrawn')
            AND (${action} <> 'save_draft' OR p.status <> 'active')
            AND (${action} <> 'publish' OR p.status IN ('draft','withdrawn'))
          FOR UPDATE OF p
        )
        UPDATE marketplace_products p SET status = ${desired}, title = ${c.title},
          description = ${c.description}, vertical = ${c.vertical}, category = ${c.category},
          image_url = ${c.image_url}, price_amount = ${c.price_amount}::numeric,
          price_currency = ${c.price_currency}, external_checkout_url = ${c.external_checkout_url},
          request_to_buy_enabled = ${c.request_to_buy_enabled}, age_gate_required = ${c.age_gate_required},
          updated_at = GREATEST(clock_timestamp(), p.updated_at + interval '1 microsecond')
        FROM locked_product held WHERE p.id = held.id AND p.tenant_id = ${tenant.id}::uuid
          AND p.updated_at = ${expectedUpdatedAt}::timestamptz
          AND (${action} <> 'publish' OR EXISTS (
            SELECT 1 FROM locked_brand b WHERE b.status = 'active' AND b.visible_in_network = true
          ))
        RETURNING p.*, to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`;
      if (r) return productRow(r);
      const after = await currentProduct(tenant, id, query); revision(after, command); managedState(after);
      if (action === "publish") throw new CatalogError("catalog_brand_not_published", 409, after.updatedAt);
      throw new CatalogError("catalog_revision_conflict", 409, after.updatedAt);
    }
    const c = (action === "save_draft" ? command.content : current) as BrandContent;
    const [r] = await query`UPDATE marketplace_brand_profiles SET status = ${desired}, display_name = ${c.display_name}, slug = ${c.slug}, vertical = ${c.vertical}, description = ${c.description}, country = ${c.country}, city = ${c.city}, visible_in_network = ${action === "publish"}, updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond') WHERE tenant_id = ${tenant.id}::uuid AND id = ${id}::uuid AND updated_at = ${expectedUpdatedAt}::timestamptz AND status IN ('draft','active','withdrawn') AND (${action} <> 'save_draft' OR status <> 'active') AND (${action} <> 'publish' OR status IN ('draft','withdrawn')) RETURNING *, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`;
    if (r) return brandRow(r);
    const after = await currentBrand(tenant, id, query); revision(after, command); managedState(after); throw new CatalogError("catalog_revision_conflict", 409, after.updatedAt);
  } catch (e) { if (e && typeof e === "object" && "code" in e && e.code === "23505") throw new CatalogError("catalog_identity_conflict", 409); throw e; }
}
