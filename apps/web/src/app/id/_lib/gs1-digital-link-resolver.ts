export const GS1_DIGITAL_LINK_TRUST_LEVEL = "GS1_IDENTITY_RESOLVED";
export const GS1_DIGITAL_LINK_AUTH_LEVEL = "NOT_CRYPTOGRAPHICALLY_AUTHENTICATED";
export const GS1_RESOLVER_VERSION = "1.2.0";
export const GS1_LINKSET_MEDIA_TYPE = "application/linkset+json";
export const GS1_LINKSET_CONTEXT = `https://ref.gs1.org/standards/resolver/${GS1_RESOLVER_VERSION}/linkset-context`;

const GS1_VOCABULARY = "https://ref.gs1.org/voc/";
const NEXID_REL_NAMESPACE = "https://nexid.lat/rel/";
const DEFAULT_LINK_REL = `${GS1_VOCABULARY}defaultLink`;
const PRODUCT_INFO_REL = `${GS1_VOCABULARY}pip`;
const TRACEABILITY_REL = `${GS1_VOCABULARY}traceability`;
export const NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL = `${NEXID_REL_NAMESPACE}offline-public-certificate`;
export const NEXID_DPP_REL = `${NEXID_REL_NAMESPACE}digital-product-passport`;
export const NEXID_PRODUCT_REL = `${NEXID_REL_NAMESPACE}product`;
export const NEXID_LOT_REL = `${NEXID_REL_NAMESPACE}lot`;
export const NEXID_SERIAL_REL = `${NEXID_REL_NAMESPACE}serial`;
export const NEXID_TECHNICAL_SHEET_REL = `${NEXID_REL_NAMESPACE}technical-sheet`;
export const NEXID_SAFETY_SHEET_REL = `${NEXID_REL_NAMESPACE}safety-sheet`;
export const NEXID_SUPPORT_REL = `${NEXID_REL_NAMESPACE}support`;
export const NEXID_RECALL_STATUS_REL = `${NEXID_REL_NAMESPACE}recall-status`;
const SUPPORTED_RELATIONS = new Map([
  ["gs1:defaultlink", DEFAULT_LINK_REL],
  [DEFAULT_LINK_REL.toLowerCase(), DEFAULT_LINK_REL],
  ["gs1:pip", PRODUCT_INFO_REL],
  [PRODUCT_INFO_REL.toLowerCase(), PRODUCT_INFO_REL],
  ["gs1:traceability", TRACEABILITY_REL],
  [TRACEABILITY_REL.toLowerCase(), TRACEABILITY_REL],
  ["nexid:offlinecertificate", NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL],
  [NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL.toLowerCase(), NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL],
  ["nexid:dpp", NEXID_DPP_REL],
  ["nexid:digitalproductpassport", NEXID_DPP_REL],
  [NEXID_DPP_REL.toLowerCase(), NEXID_DPP_REL],
  ["nexid:product", NEXID_PRODUCT_REL],
  [NEXID_PRODUCT_REL.toLowerCase(), NEXID_PRODUCT_REL],
  ["nexid:lot", NEXID_LOT_REL],
  [NEXID_LOT_REL.toLowerCase(), NEXID_LOT_REL],
  ["nexid:serial", NEXID_SERIAL_REL],
  [NEXID_SERIAL_REL.toLowerCase(), NEXID_SERIAL_REL],
  ["nexid:technicalsheet", NEXID_TECHNICAL_SHEET_REL],
  [NEXID_TECHNICAL_SHEET_REL.toLowerCase(), NEXID_TECHNICAL_SHEET_REL],
  ["nexid:safetysheet", NEXID_SAFETY_SHEET_REL],
  [NEXID_SAFETY_SHEET_REL.toLowerCase(), NEXID_SAFETY_SHEET_REL],
  ["nexid:support", NEXID_SUPPORT_REL],
  [NEXID_SUPPORT_REL.toLowerCase(), NEXID_SUPPORT_REL],
  ["nexid:recallstatus", NEXID_RECALL_STATUS_REL],
  [NEXID_RECALL_STATUS_REL.toLowerCase(), NEXID_RECALL_STATUS_REL],
]);

const RESOLVER_QUERY_KEYS = new Set([
  "linktype",
  "qr",
  "channel",
  "source",
  "carrier",
  "trust_level",
  "authentication_level",
  "gtin",
  "lot",
  "serial",
  "tenant",
  "bid",
  "gs1_registry_id",
]);
const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "authorization",
  "bearer",
  "code",
  "password",
  "secret",
  "signature",
  "token",
]);

export type Gs1DigitalLinkResolverParams = {
  gtin: string;
  lot?: string | null;
  serial?: string | null;
};

type ValidGs1Identity = { gtin: string; lot: string; serial: string };

export type Gs1RegistryResolution = {
  id: string;
  gtin: string;
  lot: string;
  serial: string;
  tenantSlug: string;
  bid: string;
  displayName: string | null;
  publicLinks?: {
    technicalSheet?: string | null;
    safetySheet?: string | null;
    support?: string | null;
    recallStatus?: string | null;
  };
};

export type Gs1RegistryLookup = (
  identity: ValidGs1Identity,
) => Promise<{ status: "found"; registry: Gs1RegistryResolution } | { status: "not_found" } | { status: "unavailable" }>;

function cleanPathValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function isValidGtin14(value: unknown) {
  const gtin = cleanPathValue(value);
  if (!/^\d{14}$/.test(gtin)) return false;
  const expected = Number(gtin[13]);
  let sum = 0;
  for (let index = 0; index < 13; index += 1) {
    sum += Number(gtin[index]) * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === expected;
}

function isValidQualifier(value: string) {
  return value.length >= 1 && value.length <= 20 && /^[\x21-\x7E]+$/.test(value) && !/[\/?#]/.test(value);
}

export function validateGs1DigitalLinkIdentity(params: Gs1DigitalLinkResolverParams) {
  const identity: ValidGs1Identity = {
    gtin: cleanPathValue(params.gtin),
    lot: cleanPathValue(params.lot),
    serial: cleanPathValue(params.serial),
  };
  if (!isValidGtin14(identity.gtin)) {
    return { ok: false as const, reason: "GTIN must be a valid 14-digit GTIN including its check digit." };
  }
  if (params.lot != null && !isValidQualifier(identity.lot)) {
    return { ok: false as const, reason: "AI 10 batch/lot must contain 1 to 20 printable path-safe characters." };
  }
  if (params.serial != null && !isValidQualifier(identity.serial)) {
    return { ok: false as const, reason: "AI 21 serial must contain 1 to 20 printable path-safe characters." };
  }
  return { ok: true as const, identity };
}

function appendSafeQueryParams(incoming: URL, target: URL) {
  for (const [key, value] of incoming.searchParams) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || RESOLVER_QUERY_KEYS.has(normalized) || SENSITIVE_QUERY_KEYS.has(normalized)) continue;
    target.searchParams.append(key, value);
  }
}

export function buildGs1DigitalLinkSunUrl(
  requestUrl: string | URL,
  params: Gs1DigitalLinkResolverParams,
  registry?: Gs1RegistryResolution | null,
) {
  const incoming = new URL(String(requestUrl));
  const target = new URL("/sun", incoming.origin);
  const gtin = cleanPathValue(params.gtin);
  const lot = cleanPathValue(params.lot);
  const serial = cleanPathValue(params.serial);

  appendSafeQueryParams(incoming, target);
  target.searchParams.set("qr", "1");
  target.searchParams.set("channel", "qr");
  target.searchParams.set("source", "gs1");
  target.searchParams.set("carrier", "gs1_digital_link");
  target.searchParams.set("trust_level", GS1_DIGITAL_LINK_TRUST_LEVEL);
  target.searchParams.set("authentication_level", GS1_DIGITAL_LINK_AUTH_LEVEL);
  if (gtin) target.searchParams.set("gtin", gtin);
  if (lot) target.searchParams.set("lot", lot);
  if (serial) target.searchParams.set("serial", serial);
  if (registry) {
    target.searchParams.set("tenant", registry.tenantSlug);
    target.searchParams.set("bid", registry.bid);
    target.searchParams.set("gs1_registry_id", registry.id);
  }
  return target;
}

export function buildOfflinePublicCertificateViewerUrl(
  requestUrl: string | URL,
  params: Gs1DigitalLinkResolverParams,
) {
  const incoming = new URL(String(requestUrl));
  const target = new URL("/offline/certificate", incoming.origin);
  target.searchParams.set("gtin", cleanPathValue(params.gtin));
  const lot = cleanPathValue(params.lot);
  const serial = cleanPathValue(params.serial);
  if (lot) target.searchParams.set("lot", lot);
  if (serial) target.searchParams.set("serial", serial);
  return target;
}

function canonicalAnchor(requestUrl: string | URL) {
  const anchor = new URL(String(requestUrl));
  anchor.search = "";
  anchor.hash = "";
  if (anchor.pathname.length > 1) anchor.pathname = anchor.pathname.replace(/\/+$/, "");
  return anchor.toString();
}

function canonicalIdentityUrl(
  requestUrl: string | URL,
  params: Gs1DigitalLinkResolverParams,
  level: "product" | "lot" | "serial",
) {
  const incoming = new URL(String(requestUrl));
  const prefix = incoming.pathname.startsWith("/id/") ? "/id" : "";
  const gtin = encodeURIComponent(cleanPathValue(params.gtin));
  const lot = cleanPathValue(params.lot);
  const serial = cleanPathValue(params.serial);
  let pathname = `${prefix}/01/${gtin}`;
  if ((level === "lot" || level === "serial") && lot) pathname += `/10/${encodeURIComponent(lot)}`;
  if (level === "serial" && serial) pathname += `/21/${encodeURIComponent(serial)}`;
  return new URL(pathname, incoming.origin).toString();
}

function linkEntry(href: string, title = "NexID digital product passport") {
  return {
    href,
    title,
    hreflang: ["es"],
    type: "text/html",
    fwqs: false,
    public: true,
  };
}

function withFragment(href: string, fragment: string) {
  const target = new URL(href);
  target.hash = fragment;
  return target.toString();
}

export function buildGs1Linkset(
  requestUrl: string | URL,
  params: Gs1DigitalLinkResolverParams,
  registry?: Gs1RegistryResolution | null,
) {
  const href = buildGs1DigitalLinkSunUrl(requestUrl, params, registry).toString();
  const offlineCertificateHref = buildOfflinePublicCertificateViewerUrl(requestUrl, params).toString();
  const resource: Record<string, unknown> = {
    anchor: canonicalAnchor(requestUrl),
    description: "Identidad encontrada. El QR no autentica criptograficamente el producto; usa NFC para confirmar autenticidad.",
    [DEFAULT_LINK_REL]: [linkEntry(href)],
    [PRODUCT_INFO_REL]: [linkEntry(href)],
    [TRACEABILITY_REL]: [linkEntry(href)],
    [NEXID_DPP_REL]: [linkEntry(href, "NexID digital product passport")],
    [NEXID_PRODUCT_REL]: [linkEntry(canonicalIdentityUrl(requestUrl, params, "product"), "GS1 product identity")],
    [NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL]: [linkEntry(offlineCertificateHref, "NexID signed public offline certificate")],
  };
  const lot = cleanPathValue(params.lot);
  const serial = cleanPathValue(params.serial);
  if (lot) resource[NEXID_LOT_REL] = [linkEntry(canonicalIdentityUrl(requestUrl, params, "lot"), "GS1 lot identity")];
  if (serial) resource[NEXID_SERIAL_REL] = [linkEntry(canonicalIdentityUrl(requestUrl, params, "serial"), "GS1 serial identity")];
  const configured = registry?.publicLinks || {};
  resource[NEXID_TECHNICAL_SHEET_REL] = [linkEntry(configured.technicalSheet || withFragment(href, "technical-sheet"), "Technical product sheet")];
  resource[NEXID_SAFETY_SHEET_REL] = [linkEntry(configured.safetySheet || withFragment(href, "safety-sheet"), "Safety data sheet")];
  resource[NEXID_SUPPORT_REL] = [linkEntry(configured.support || withFragment(href, "support"), "Product support")];
  resource[NEXID_RECALL_STATUS_REL] = [linkEntry(configured.recallStatus || withFragment(href, "recall-status"), "Recall and product status")];
  return {
    linkset: [resource],
  };
}

export function buildGs1ResolverDescription(requestUrl: string | URL) {
  const incoming = new URL(String(requestUrl));
  const resolverRoot = incoming.hostname.toLowerCase().startsWith("id.")
    ? incoming.origin
    : new URL("/id", incoming.origin).toString().replace(/\/$/, "");
  return {
    name: "NexID GS1 Digital Link Resolver",
    resolverRoot,
    supportedPrimaryKeys: ["01"],
    supportedLinkType: [
      { namespace: GS1_VOCABULARY, prefix: "gs1:" },
      { namespace: NEXID_REL_NAMESPACE, prefix: "nexid:" },
    ],
    linkTypeDefaultCanBeLinkset: false,
    jsonLdContextLocation: GS1_LINKSET_CONTEXT,
  };
}

const BASE_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "Accept, Accept-Language",
  "access-control-max-age": "86400",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-nexid-gs1-resolver-profile": `foundation-${GS1_RESOLVER_VERSION}`,
  vary: "Accept, Accept-Language",
};

function response(body: BodyInit | null, status: number, headers: Record<string, string> = {}, head = false) {
  return new Response(head ? null : body, { status, headers: { ...BASE_HEADERS, ...headers } });
}

function problem(status: number, title: string, detail: string, head = false) {
  return response(JSON.stringify({ type: "about:blank", title, status, detail }), status, { "content-type": "application/problem+json; charset=utf-8" }, head);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function accepts(request: Request, mediaType: string) {
  return String(request.headers.get("accept") || "").toLowerCase().includes(mediaType.toLowerCase());
}

function linksetResponse(request: Request, linkset: ReturnType<typeof buildGs1Linkset>, head = false) {
  const contextHeader = `<${GS1_LINKSET_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`;
  if (accepts(request, "application/ld+json")) {
    return response(JSON.stringify({ "@context": GS1_LINKSET_CONTEXT, ...linkset }), 200, { "content-type": "application/ld+json; charset=utf-8", link: contextHeader }, head);
  }
  if (accepts(request, GS1_LINKSET_MEDIA_TYPE) || accepts(request, "application/json")) {
    return response(JSON.stringify(linkset), 200, { "content-type": `${GS1_LINKSET_MEDIA_TYPE}; charset=utf-8`, link: contextHeader }, head);
  }
  const links = Object.entries(linkset.linkset[0])
    .filter(([relation, value]) => relation.startsWith("http") && Array.isArray(value))
    .map(([relation, value]) => {
      const item = (value as Array<{ href: string; title: string }>)[0];
      return `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a><small>${escapeHtml(relation)}</small></li>`;
    })
    .join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NexID GS1 links</title></head><body><main><h1>Recursos del producto</h1><p>La identidad GS1/QR no equivale a autenticación criptográfica NFC.</p><ul>${links}</ul></main></body></html>`;
  return response(html, 200, { "content-type": "text/html; charset=utf-8", link: contextHeader }, head);
}

function registryApiBase() {
  const configured = String(process.env.NEXID_GS1_REGISTRY_API_URL || "").trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const allowedProtocol = url.protocol === "https:"
      || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
    if (!allowedProtocol || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export const lookupGs1RegistryIdentity: Gs1RegistryLookup = async (identity) => {
  const apiBase = registryApiBase();
  if (!apiBase) return { status: "unavailable" };
  const query = new URLSearchParams({ gtin: identity.gtin });
  if (identity.lot) query.set("lot", identity.lot);
  if (identity.serial) query.set("serial", identity.serial);
  try {
    const response = await fetch(`${apiBase}/public/gs1/resolve?${query.toString()}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable" };
    const payload = await response.json() as { ok?: unknown; registry?: Partial<Gs1RegistryResolution> };
    const registry = payload.registry;
    if (payload.ok !== true || !registry
      || registry.gtin !== identity.gtin
      || String(registry.lot || "") !== identity.lot
      || String(registry.serial || "") !== identity.serial
      || !/^[0-9a-f-]{36}$/i.test(String(registry.id || ""))
      || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(String(registry.tenantSlug || ""))
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(String(registry.bid || ""))) {
      return { status: "unavailable" };
    }
    const readPublicLink = (key: keyof NonNullable<Gs1RegistryResolution["publicLinks"]>) => {
      const raw = registry.publicLinks?.[key];
      if (!raw) return null;
      try {
        const url = new URL(String(raw));
        return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
      } catch {
        return null;
      }
    };
    return {
      status: "found",
      registry: {
        id: String(registry.id),
        gtin: identity.gtin,
        lot: identity.lot,
        serial: identity.serial,
        tenantSlug: String(registry.tenantSlug),
        bid: String(registry.bid),
        displayName: registry.displayName ? String(registry.displayName).slice(0, 240) : null,
        publicLinks: {
          technicalSheet: readPublicLink("technicalSheet"),
          safetySheet: readPublicLink("safetySheet"),
          support: readPublicLink("support"),
          recallStatus: readPublicLink("recallStatus"),
        },
      },
    };
  } catch {
    return { status: "unavailable" };
  }
};

export async function resolveGs1DigitalLink(
  request: Request,
  params: Gs1DigitalLinkResolverParams,
  options: { head?: boolean; registryLookup?: Gs1RegistryLookup } = {},
) {
  const head = Boolean(options.head);
  const validated = validateGs1DigitalLinkIdentity(params);
  if (!validated.ok) return problem(400, "Invalid GS1 Digital Link", validated.reason, head);

  const resolved = await (options.registryLookup || lookupGs1RegistryIdentity)(validated.identity);
  if (resolved.status === "not_found") {
    return problem(404, "GS1 identity not found", "The identifier is syntactically valid but is not registered.", head);
  }
  if (resolved.status !== "found") {
    return response(JSON.stringify({ type: "about:blank", title: "GS1 registry unavailable", status: 503 }), 503, {
      "content-type": "application/problem+json; charset=utf-8",
      "retry-after": "5",
    }, head);
  }

  const requestUrl = new URL(request.url);
  const requestedType = String(requestUrl.searchParams.get("linkType") || "").trim();
  if (requestedType.toLowerCase() === "linkset" || requestedType.toLowerCase() === "all" || accepts(request, GS1_LINKSET_MEDIA_TYPE) || accepts(request, "application/json") || accepts(request, "application/ld+json")) {
    return linksetResponse(request, buildGs1Linkset(requestUrl, validated.identity, resolved.registry), head);
  }

  if (requestedType && !SUPPORTED_RELATIONS.has(requestedType.toLowerCase())) {
    return problem(404, "GS1 link type not found", `No link is available for linkType=${requestedType}.`, head);
  }

  const normalizedType = SUPPORTED_RELATIONS.get(requestedType.toLowerCase()) || DEFAULT_LINK_REL;
  const linkset = buildGs1Linkset(requestUrl, validated.identity, resolved.registry);
  const selected = linkset.linkset[0][normalizedType];
  const location = Array.isArray(selected) && selected[0] && typeof selected[0] === "object"
    ? String((selected[0] as { href?: unknown }).href || "")
    : "";
  if (!location) return problem(404, "GS1 link type not found", `No link is configured for linkType=${requestedType}.`, head);
  return response(null, 307, { location }, head);
}

export function gs1OptionsResponse() {
  return response(null, 204, { allow: "GET, HEAD, OPTIONS", "cache-control": "public, max-age=86400" });
}

export function gs1ResolverDescriptionResponse(request: Request, options: { head?: boolean } = {}) {
  return response(JSON.stringify(buildGs1ResolverDescription(request.url)), 200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=3600",
  }, Boolean(options.head));
}
