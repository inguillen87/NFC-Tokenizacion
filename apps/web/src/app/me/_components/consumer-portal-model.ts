type ConsumerProduct = { tenant_slug?: string | null; ownership_status?: string | null; ownership_record_status?: string | null };
type ConsumerSessionPayload = { ok?: boolean; authenticated?: boolean } | null | undefined;

export type ConsumerBrand = {
  tenant_id?: string | null;
  slug?: string | null;
  name?: string | null;
  status?: string | null;
  points_balance?: number | null;
  lifetime_points?: number | null;
  tier?: string | null;
  membership_tier?: string | null;
  progress?: number | null;
  membership_progress?: number | null;
  next_milestone?: string | null;
  joined_at?: string | null;
};

export type ConsumerTap = {
  tap_event_id?: number | string | null;
  created_at?: string | null;
  city?: string | null;
  country?: string | null;
  verdict?: string | null;
  tenant_slug?: string | null;
  risk_level?: string | null;
};

export type ConsumerPortalProduct = ConsumerProduct & {
  product_name?: string | null;
  brand_name?: string | null;
  image_url?: string | null;
  bid?: string | null;
  created_at?: string | null;
  first_tap_event_id?: number | string | null;
  latest_tap_event_id?: number | string | null;
  latest_verdict?: string | null;
  latest_city?: string | null;
  latest_country?: string | null;
  latest_tap_at?: string | null;
  tokenization_status?: string | null;
  tokenization_network?: string | null;
  tokenization_tx_hash?: string | null;
  tokenization_token_id?: string | null;
  tokenization_processed_at?: string | null;
};

export type MarketplaceListing = {
  id?: string | null;
  title?: string | null;
  brand?: string | null;
  brand_name?: string | null;
  tenant_slug?: string | null;
  points_price?: number | null;
  cash_price?: number | null;
  price_amount?: number | null;
  stock_status?: string | null;
  status?: string | null;
  request_to_buy_enabled?: boolean | null;
  age_gate_required?: boolean | null;
};

export type BrandNotification = {
  id: string;
  type: "promo" | "tap" | "product";
  title: string;
  detail: string;
  href: string;
  tone: "cyan" | "emerald" | "violet" | "amber";
};

export type BrandEngagement = {
  key: string;
  brand: ConsumerBrand;
  name: string;
  slug: string;
  status: string;
  points: number | null;
  lifetimePoints: number | null;
  tier: string | null;
  progress: number | null;
  nextMilestone: string | null;
  productCount: number;
  claimedCount: number;
  tapCount: number;
  activePromoCount: number;
  unreadCount: number;
  lastActivityLabel: string;
  products: ConsumerPortalProduct[];
  taps: ConsumerTap[];
  listings: MarketplaceListing[];
  notifications: BrandNotification[];
};

export function shouldRedirectToConsumerAuth(session: ConsumerSessionPayload) {
  return !session?.ok || !session?.authenticated;
}

export function resolveMarketplaceTenant(input: { tenantFromQuery?: string; products?: ConsumerProduct[] }) {
  const tenantFromQuery = String(input.tenantFromQuery || "").trim();
  if (tenantFromQuery) return tenantFromQuery;
  const products = Array.isArray(input.products) ? input.products : [];
  const preferredOwned = products.find((item) => String(item.ownership_record_status || item.ownership_status || "").toLowerCase() === "claimed");
  return String(preferredOwned?.tenant_slug || products[0]?.tenant_slug || "").trim();
}

export function ownershipTone(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "claimed") return "success";
  if (normalized === "blocked_replay" || normalized === "revoked" || normalized === "disputed") return "danger";
  return "neutral";
}

function normalizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function firstUseful(...values: unknown[]) {
  return String(values.find((value) => String(value || "").trim()) || "").trim();
}

function dateValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatPortalDate(value: unknown) {
  const timestamp = dateValue(value);
  if (timestamp === null) return "sin fecha";
  return new Date(timestamp).toISOString().slice(0, 10);
}

function productKey(item: ConsumerPortalProduct) {
  return normalizeKey(firstUseful(item.tenant_slug, item.brand_name));
}

function tapKey(item: ConsumerTap) {
  return normalizeKey(item.tenant_slug);
}

function listingKey(item: MarketplaceListing) {
  return normalizeKey(firstUseful(item.tenant_slug, item.brand_name, item.brand));
}

function optionalFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isClaimed(item: ConsumerPortalProduct) {
  return String(item.ownership_record_status || item.ownership_status || "").toLowerCase() === "claimed";
}

function isListingLive(item: MarketplaceListing) {
  const status = String(item.stock_status || item.status || "").toLowerCase();
  if (!status) return false;
  return status !== "out_of_stock" && status !== "paused" && status !== "archived";
}

function notificationId(prefix: string, value: unknown, index: number) {
  return `${prefix}-${String(value || index).replace(/[^a-zA-Z0-9_-]/g, "") || index}`;
}

function buildNotifications(input: {
  slug: string;
  products: ConsumerPortalProduct[];
  taps: ConsumerTap[];
  listings: MarketplaceListing[];
}) {
  const notifications: BrandNotification[] = [];
  input.listings.filter(isListingLive).slice(0, 2).forEach((listing, index) => {
    const points = Number(listing.points_price || 0);
    notifications.push({
      id: notificationId("promo", listing.id || listing.title, index),
      type: "promo",
      title: listing.title ? `Nuevo beneficio: ${listing.title}` : "Nuevo beneficio publicado",
      detail: points ? `${points} pts disponibles para miembros con passport.` : "Drop disponible para miembros con producto asociado.",
      href: `/me/marketplace?tenant=${encodeURIComponent(input.slug)}`,
      tone: "violet",
    });
  });

  input.taps.slice(0, 1).forEach((tap, index) => {
    notifications.push({
      id: notificationId("tap", tap.tap_event_id || tap.created_at, index),
      type: "tap",
      title: `Tap ${String(tap.verdict || "sin dato").toUpperCase()} registrado`,
      detail: `${firstUseful(tap.city, "Ubicacion no informada")}${tap.country ? `, ${tap.country}` : ""} - ${formatPortalDate(tap.created_at)}`,
      href: "/me/taps",
      tone: String(tap.verdict || "").toLowerCase().includes("valid") ? "emerald" : "amber",
    });
  });

  input.products.filter(isClaimed).slice(0, 1).forEach((product, index) => {
    notifications.push({
      id: notificationId("product", product.bid || product.product_name, index),
      type: "product",
      title: `${product.product_name || "Producto"} guardado en tu passport`,
      detail: `Ownership activo${product.bid ? ` - BID ${product.bid}` : ""}.`,
      href: "/me/products",
      tone: "cyan",
    });
  });

  return notifications.slice(0, 4);
}

export function buildBrandEngagement(input: {
  brands: ConsumerBrand[];
  products: ConsumerPortalProduct[];
  taps: ConsumerTap[];
  listings: MarketplaceListing[];
}) {
  const products = Array.isArray(input.products) ? input.products : [];
  const taps = Array.isArray(input.taps) ? input.taps : [];
  const listings = Array.isArray(input.listings) ? input.listings : [];
  const existingBrands = Array.isArray(input.brands) ? input.brands : [];
  const brandMap = new Map<string, ConsumerBrand>();

  existingBrands.forEach((brand) => {
    const key = normalizeKey(firstUseful(brand.slug, brand.tenant_id, brand.name));
    if (key) brandMap.set(key, brand);
  });

  return Array.from(brandMap.entries()).map(([key, brand]) => {
    const brandKeys = new Set([
      normalizeKey(brand.slug),
      normalizeKey(brand.tenant_id),
      normalizeKey(brand.name),
      key,
    ].filter(Boolean));

    const brandProducts = products.filter((item) => brandKeys.has(productKey(item)));
    const brandTaps = taps.filter((item) => brandKeys.has(tapKey(item)));
    const brandListings = listings.filter((item) => brandKeys.has(listingKey(item)));
    const liveListings = brandListings.filter(isListingLive);
    const claimedCount = brandProducts.filter(isClaimed).length;
    const points = optionalFiniteNumber(brand.points_balance);
    const lifetimePoints = optionalFiniteNumber(brand.lifetime_points);
    const tier = firstUseful(brand.membership_tier, brand.tier) || null;
    const rawProgress = optionalFiniteNumber(brand.membership_progress ?? brand.progress);
    const progress = rawProgress === null ? null : Math.max(0, Math.min(100, rawProgress));
    const nextMilestone = firstUseful(brand.next_milestone) || null;
    const activityDates = [...brandProducts.map((item) => item.created_at), ...brandTaps.map((item) => item.created_at)]
      .map(dateValue)
      .filter((value): value is number => value !== null)
      .sort((a, b) => b - a);
    const slug = firstUseful(brand.slug, brand.tenant_id, key);
    const notifications = buildNotifications({ slug, products: brandProducts, taps: brandTaps, listings: brandListings });

    return {
      key,
      brand,
      name: firstUseful(brand.name, brand.slug, brand.tenant_id, "Marca"),
      slug,
      status: String(brand.status || "not_reported").toLowerCase(),
      points,
      lifetimePoints,
      tier,
      progress,
      nextMilestone,
      productCount: brandProducts.length,
      claimedCount,
      tapCount: brandTaps.length,
      activePromoCount: liveListings.length,
      unreadCount: notifications.length,
      lastActivityLabel: activityDates[0] ? formatPortalDate(activityDates[0]) : formatPortalDate(brand.joined_at),
      products: brandProducts,
      taps: brandTaps,
      listings: brandListings,
      notifications,
    } satisfies BrandEngagement;
  }).sort((a, b) => b.unreadCount - a.unreadCount || b.tapCount - a.tapCount || a.name.localeCompare(b.name));
}

export function flattenBrandNotifications(items: BrandEngagement[]) {
  return items.flatMap((item) => item.notifications.map((notification) => ({ ...notification, brandName: item.name, brandSlug: item.slug })));
}
