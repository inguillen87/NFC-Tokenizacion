import { NextResponse } from "next/server";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import { getDashboardSession, type DashboardSession } from "../../../lib/session";

export type Visibility = "network" | "private";
export type CheckoutMode = "request" | "external" | "direct";

export type MarketplaceItem = {
  id: string;
  emoji: string;
  name: string;
  priceArs: number;
  vertical: string;
  checkout: CheckoutMode;
  visibility: Visibility;
};

type MarketplaceStore = { items: MarketplaceItem[] };
type MarketplaceAuthorization = { session: DashboardSession; tenantSlug: string };

const MAX_BODY_BYTES = 64_000;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const CHECKOUT_MODES = new Set<CheckoutMode>(["request", "external", "direct"]);
const VISIBILITIES = new Set<Visibility>(["network", "private"]);
export const tenantMarketplaceNoStoreHeaders = { "cache-control": "private, no-store, max-age=0" };

const initialItems: MarketplaceItem[] = [
  { id: "balmec-malbec-2022", emoji: "VI", name: "Gran Reserva Malbec 2022", priceArs: 45000, vertical: "Vino Premium", checkout: "request", visibility: "network" },
  { id: "balmec-olive-arbequina", emoji: "OL", name: "Aceite de Oliva Extra Virgen Arbequina", priceArs: 14500, vertical: "Oliva Gourmet", checkout: "direct", visibility: "network" },
  { id: "balmec-experience-private-tasting", emoji: "EX", name: "Cata privada para dos", priceArs: 32000, vertical: "Experiencia", checkout: "request", visibility: "network" },
  { id: "balmec-terroir-box", emoji: "BX", name: "Caja Selección Terroir", priceArs: 120000, vertical: "Caja / Combo", checkout: "request", visibility: "private" },
];

const globalStore = globalThis as typeof globalThis & {
  __tenantMarketplaceStores?: Map<string, MarketplaceStore>;
};
if (!globalStore.__tenantMarketplaceStores) globalStore.__tenantMarketplaceStores = new Map();

export function getTenantMarketplaceStore(tenantSlug: string) {
  const current = globalStore.__tenantMarketplaceStores!.get(tenantSlug);
  if (current) return current;
  const created = { items: tenantSlug === "demobodega" ? initialItems.map((item) => ({ ...item })) : [] };
  globalStore.__tenantMarketplaceStores!.set(tenantSlug, created);
  return created;
}

export function tenantMarketplaceSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function requestedTenant(req: Request, session: DashboardSession) {
  const queryTenant = String(new URL(req.url).searchParams.get("tenant") || "").trim().toLowerCase();
  const sessionTenant = String(session.tenantSlug || "").trim().toLowerCase();
  if (sessionTenant) {
    if (queryTenant && queryTenant !== sessionTenant) return null;
    return TENANT_SLUG_PATTERN.test(sessionTenant) ? sessionTenant : null;
  }
  return TENANT_SLUG_PATTERN.test(queryTenant) ? queryTenant : null;
}

async function authorize(req: Request, permission: "marketplace:read" | "marketplace:write"):
  Promise<MarketplaceAuthorization | { response: NextResponse }> {
  try {
    const session = await getDashboardSession();
    if (!session) {
      return { response: NextResponse.json({ ok: false, reason: "dashboard_session_required" }, { status: 401, headers: tenantMarketplaceNoStoreHeaders }) };
    }
    if (!dashboardPermissionMatches(session.permissions, permission, session.deniedPermissions)) {
      return { response: NextResponse.json({ ok: false, reason: "permission_denied", permission }, { status: 403, headers: tenantMarketplaceNoStoreHeaders }) };
    }
    const tenantSlug = requestedTenant(req, session);
    if (!tenantSlug) {
      return { response: NextResponse.json({ ok: false, reason: "tenant_scope_required" }, { status: 403, headers: tenantMarketplaceNoStoreHeaders }) };
    }
    return { session, tenantSlug };
  } catch {
    return { response: NextResponse.json({ ok: false, reason: "session_upstream_unavailable" }, { status: 503, headers: tenantMarketplaceNoStoreHeaders }) };
  }
}

export function authorizeTenantMarketplaceRead(req: Request) {
  return authorize(req, "marketplace:read");
}

export function authorizeTenantMarketplaceMutation(req: Request) {
  return authorize(req, "marketplace:write");
}

export async function readTenantMarketplacePayload(req: Request) {
  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function normalizeTenantMarketplaceDraft(entry: unknown): Omit<MarketplaceItem, "id"> | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const source = entry as Record<string, unknown>;
  const name = String(source.name || "").trim().slice(0, 160);
  const vertical = String(source.vertical || "").trim().slice(0, 120);
  const emoji = String(source.emoji || "NX").trim().slice(0, 8) || "NX";
  const priceArs = Number(source.priceArs);
  const checkout = String(source.checkout || "request") as CheckoutMode;
  const visibility = String(source.visibility || "network") as Visibility;
  if (!name || !vertical || !Number.isFinite(priceArs) || priceArs < 0 || priceArs > 999_999_999_999) return null;
  if (!CHECKOUT_MODES.has(checkout) || !VISIBILITIES.has(visibility)) return null;
  return { emoji, name, priceArs, vertical, checkout, visibility };
}
