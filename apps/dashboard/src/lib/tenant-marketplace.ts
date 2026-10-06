export type CatalogKind = "brand" | "product";
export type CatalogAction = "save_draft" | "publish" | "withdraw";
export type CatalogBrand = { id: string; status: string; display_name: string; slug: string; vertical: string; description: string | null; country: string | null; city: string | null; visible_in_network: boolean; updatedAt: string | null };
export type CatalogProduct = { id: string; status: string; title: string; description: string | null; vertical: string; category: string | null; image_url: string | null; price_amount: string | null; price_currency: string | null; external_checkout_url: string | null; request_to_buy_enabled: boolean; age_gate_required: boolean; updatedAt: string | null };
export type CatalogResource = CatalogBrand | CatalogProduct;
export const CATALOG_PROTOCOL = "nexid.tenant-marketplace-catalog.v1";
export type TenantCatalog = { ok: true; protocol: typeof CATALOG_PROTOCOL; tenant: string; brand: CatalogBrand | null; items: CatalogProduct[]; hasMore: boolean };
export type CatalogFields = { title: string; description: string; vertical: string; category: string; imageUrl: string; priceAmount: string; priceCurrency: string; externalCheckoutUrl: string; requestEnabled: "" | "true" | "false"; ageGateRequired: "" | "true" | "false"; displayName: string; brandSlug: string; country: string; city: string };
export const blankCatalogFields: CatalogFields = { title: "", description: "", vertical: "", category: "", imageUrl: "", priceAmount: "", priceCurrency: "", externalCheckoutUrl: "", requestEnabled: "", ageGateRequired: "", displayName: "", brandSlug: "", country: "", city: "" };
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum;
const nullableText = (value: unknown, maximum: number) => value === null || text(value, maximum);
export function catalogManaged(resource: CatalogResource) { return ["draft", "active", "withdrawn"].includes(resource.status); }
export function isCatalogResource(kind: CatalogKind, value: unknown): value is CatalogResource {
  if (!record(value) || !text(value.id, 64) || !uuid.test(value.id as string) || !text(value.status, 32) || !(value.status as string).trim() || !text(value.updatedAt, 200) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.updatedAt as string) || !text(value.vertical, 40)) return false;
  if (kind === "brand") return text(value.display_name, 160) && text(value.slug, 120) && nullableText(value.description, 6000) && nullableText(value.country, 80) && nullableText(value.city, 120) && typeof value.visible_in_network === "boolean";
  return text(value.title, 160) && nullableText(value.description, 6000) && nullableText(value.category, 120) && nullableText(value.image_url, 2048)
    && (value.price_amount === null || typeof value.price_amount === "string" && /^\d{1,10}(?:\.\d{1,2})?$/.test(value.price_amount))
    && (value.price_currency === null ? value.price_amount === null : typeof value.price_currency === "string" && /^[A-Z]{3}$/.test(value.price_currency) && value.price_amount !== null)
    && nullableText(value.external_checkout_url, 2048) && typeof value.request_to_buy_enabled === "boolean" && typeof value.age_gate_required === "boolean";
}
export function parseTenantCatalog(value: unknown, tenant: string): TenantCatalog | null {
  if (!record(value) || value.ok !== true || value.protocol !== CATALOG_PROTOCOL || !tenant || value.tenant !== tenant || typeof value.hasMore !== "boolean" || value.demoMode === true || value.dataSource === "demo"
    || !(value.brand === null || isCatalogResource("brand", value.brand)) || !Array.isArray(value.items) || value.items.length > 100
    || !value.items.every(item => isCatalogResource("product", item)) || new Set(value.items.map(item => item.id)).size !== value.items.length) return null;
  return value as TenantCatalog;
}
export function catalogFieldsOf(resource: CatalogResource, kind: CatalogKind): CatalogFields {
  if (kind === "brand" && "display_name" in resource) return { ...blankCatalogFields, displayName: resource.display_name, brandSlug: resource.slug, vertical: resource.vertical, description: resource.description || "", country: resource.country || "", city: resource.city || "" };
  if (kind === "product" && "title" in resource) return { ...blankCatalogFields, title: resource.title, vertical: resource.vertical, description: resource.description || "", category: resource.category || "", imageUrl: resource.image_url || "", priceAmount: resource.price_amount === null ? "" : String(resource.price_amount), priceCurrency: resource.price_currency || "", externalCheckoutUrl: resource.external_checkout_url || "", requestEnabled: String(resource.request_to_buy_enabled) as "true" | "false", ageGateRequired: String(resource.age_gate_required) as "true" | "false" };
  return { ...blankCatalogFields };
}
export function catalogVisible(brand: CatalogBrand | null) { return brand?.status === "active" && brand.visible_in_network === true; }
export function catalogState(resource: CatalogResource, brand: CatalogBrand | null) {
  return resource.status === "active" ? "title" in resource && !catalogVisible(brand) ? "Publicado · oculto por la marca" : "visible_in_network" in resource && !resource.visible_in_network ? "Publicado · oculto en la red" : "Publicado" : resource.status === "withdrawn" ? "Retirado" : resource.status === "draft" ? "Borrador" : "Revisión autorizada requerida";
}
export function catalogErrorCopy(reason: unknown) {
  if (/^catalog_.*_invalid$/.test(String(reason)) || reason === "catalog_price_pair_invalid") return "Revisá los campos del formulario y las opciones explícitas antes de guardar. Tu formulario se conserva.";
  const copy: Record<string, string> = {
    catalog_revision_conflict: "Cambió la versión guardada. Tu formulario sigue aquí; consultá y compará los cambios antes de continuar.",
    catalog_brand_not_visible: "Publicá la marca con visibilidad en la red antes de publicar este producto.",
    catalog_brand_required: "Guardá y publicá el perfil de la marca antes de publicar productos.",
    catalog_withdraw_required: "Retirá la publicación antes de editar. El producto y sus solicitudes conservan su historial.",
    catalog_brand_not_published: "Publicá la marca con visibilidad en la red antes de publicar este producto.",
    catalog_publish_incomplete: "Completá el nombre y las opciones comerciales de la versión guardada antes de publicarla.",
    catalog_identity_conflict: "Este identificador ya tiene una versión guardada. Tu formulario sigue aquí; consultá y compará el estado antes de continuar.",
    catalog_status_readonly: "Esta versión requiere revisión autorizada. Este editor no puede modificar ni reactivar su estado.",
    catalog_state_not_managed: "Esta versión requiere revisión autorizada. Este editor no puede modificar ni reactivar su estado.",
    catalog_forbidden: "Esta sesión no tiene permiso para esta operación. Conservamos tu formulario.",
    catalog_tenant_required: "Elegí una empresa autorizada para consultar su catálogo.",
    catalog_demo_unavailable: "La demostración no consulta ni modifica el catálogo de clientes.",
    catalog_invalid: "Revisá los campos y elegí explícitamente las opciones comerciales antes de guardar.",
    catalog_body_too_large: "El contenido supera el tamaño permitido. Reducí los textos y reintentá guardar.",
  };
  return copy[String(reason)] || "No pudimos confirmar el catálogo. Tu formulario sigue aquí; reintentá la consulta del estado guardado.";
}
export function catalogPrice(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(cleaned) || Number(cleaned) > 9_999_999_999.99) throw new Error("catalog_invalid");
  return cleaned;
}

export type CatalogCommand = { kind: CatalogKind; action: CatalogAction; id: string; expectedUpdatedAt: string | null; content?: Record<string, unknown>; visible_in_network?: true };
function clean(value: string, maximum: number, required = false, multiline = false) {
  const result = value.trim();
  if (result.length > maximum || required && !result || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(result)) throw new Error("catalog_invalid");
  return result || null;
}
function publicUrl(value: string, image = false) {
  const result = clean(value, 2048);
  if (result === null) return null;
  if (image && /^\/(?:assets|images)\/[A-Za-z\d_./,@-]+$/.test(result) && !result.split('/').includes("..") && !result.includes("//")) return result;
  if (/[\u0000-\u0020\u007f\\]/.test(result)) throw new Error("catalog_invalid");
  try {
    const url = new URL(result), host = url.hostname.toLowerCase();
    const literalIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || host === "localhost" || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') || host.includes(':') || literalIp) throw new Error();
    return url.href;
  }
  catch { throw new Error("catalog_invalid"); }
}
function explicitBoolean(value: string) {
  if (!["true", "false"].includes(value)) throw new Error("catalog_invalid");
  return value === "true";
}
export function catalogContent(kind: CatalogKind, fields: CatalogFields): Record<string, unknown> {
  const vertical = clean(fields.vertical, 40, true);
  if (!vertical || !/^[a-z][a-z0-9_-]*$/.test(vertical)) throw new Error("catalog_invalid");
  const common = { vertical, description: clean(fields.description, 6000, false, true) };
  if (kind === "brand") {
    const slug = clean(fields.brandSlug, 120, true);
    if (!slug || !/^[a-z0-9][a-z0-9._-]*$/.test(slug)) throw new Error("catalog_invalid");
    return { ...common, display_name: clean(fields.displayName, 160) || "", slug, country: clean(fields.country, 80), city: clean(fields.city, 120) };
  }
  const price = catalogPrice(fields.priceAmount), currency = clean(fields.priceCurrency, 3);
  if (price === null ? currency !== null : currency === null || !/^[A-Z]{3}$/.test(currency)) throw new Error("catalog_invalid");
  return { ...common, title: clean(fields.title, 160) || "", category: clean(fields.category, 120), image_url: publicUrl(fields.imageUrl, true),
    price_amount: price, price_currency: currency, external_checkout_url: publicUrl(fields.externalCheckoutUrl),
    request_to_buy_enabled: explicitBoolean(fields.requestEnabled), age_gate_required: explicitBoolean(fields.ageGateRequired) };
}
export function buildCatalogCommand(kind: CatalogKind, action: CatalogAction, resource: CatalogResource, fields: CatalogFields): CatalogCommand {
  if (!["save_draft", "publish", "withdraw"].includes(action) || !uuid.test(resource.id) || !catalogManaged(resource) || (kind === "brand") !== ("display_name" in resource)
    || resource.updatedAt === null && resource.status !== "draft" || resource.updatedAt !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(resource.updatedAt)) throw new Error("catalog_invalid");
  if (action !== "withdraw" && resource.status === "active") throw new Error("catalog_withdraw_required");
  if (action !== "save_draft" && !resource.updatedAt || action === "withdraw" && resource.status !== "active") throw new Error("catalog_invalid");
  const command: CatalogCommand = { kind, action, id: resource.id, expectedUpdatedAt: resource.updatedAt };
  if (action === "save_draft") command.content = catalogContent(kind, fields);
  if (kind === "brand" && action === "publish") command.visible_in_network = true;
  return command;
}
function canonicalContent(value: Record<string, unknown>) {
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, key === "price_amount" && item !== null ? Number(item).toFixed(2) : item]));
}
function savedContent(kind: CatalogKind, resource: CatalogResource): Record<string, unknown> {
  const keys = kind === "brand" ? ["display_name", "slug", "vertical", "description", "country", "city"] : ["title", "description", "vertical", "category", "image_url", "price_amount", "price_currency", "external_checkout_url", "request_to_buy_enabled", "age_gate_required"];
  return Object.fromEntries(keys.map(key => [key, (resource as unknown as Record<string, unknown>)[key]]));
}
/** This confirms the observed end state, without claiming which actor performed the write. */
export function catalogReconciliation(saved: CatalogResource | null, command: CatalogCommand, baseline: CatalogResource): "matches" | "retry_allowed" | "changed" {
  if (!saved) return command.expectedUpdatedAt === null ? "retry_allowed" : "changed";
  if (saved.id !== command.id) return "changed";
  const desiredStatus = command.action === "publish" ? "active" : command.action === "withdraw" ? "withdrawn" : "draft";
  const desired = command.content || savedContent(command.kind, baseline);
  const actual = savedContent(command.kind, saved);
  const visibilityMatches = command.kind !== "brand" || !('visible_in_network' in saved) ? true : saved.visible_in_network === (command.action === "publish");
  if (saved.status === desiredStatus && visibilityMatches && canonicalContent(actual) === canonicalContent(desired)) return "matches";
  return saved.updatedAt === command.expectedUpdatedAt ? "retry_allowed" : "changed";
}
