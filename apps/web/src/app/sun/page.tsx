import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, ShieldCheck, Store, WalletCards, AlertTriangle } from "lucide-react";
import { CtaActions } from "./cta-actions";
import { FreshHandoffUrlCleaner } from "./fresh-handoff-url-cleaner";
import { OnboardDemoButton } from "./onboard-demo-button";
import { SunProductHeroStage, type SunVisualKind } from "./sun-product-hero-stage";
import { TapPrecisionTelemetry } from "./tap-precision-telemetry";
import { QREngagementSuite } from "./qr-engagement-suite";
import { productUrls } from "@product/config";
import { BrandLockup, DeviceSignatureBadge, EmptyState, GlobalOpsMap, KeyValueSpec, LocaleSwitcher, ThemeToggle, TimelineRail } from "@product/ui";
import type { GlobalOpsPoint, GlobalOpsRoute } from "@product/ui";
import { getWebI18n } from "../../lib/locale";
import { resolveProductAssetProfile, summarizeAssetReadiness } from "../../lib/product-asset-bank";

function apiBase(params?: Record<string, string | string[] | undefined>) {
  const override = typeof params?.api === "string" ? params.api.trim() : "";
  if (override) {
    try {
      const parsed = new URL(override);
      if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && parsed.protocol === "http:") {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid debug overrides and use the configured API.
    }
  }
  return productUrls.api;
}

const KNOWN_ORIGIN_COORDS: Array<{ match: RegExp; lat: number; lng: number }> = [
  { match: /(demo bodega|bodega demo)/i, lat: -33.2095, lng: -69.1211 },
  { match: /(mendoza|valle de uco|finca altamira)/i, lat: -33.2095, lng: -69.1211 },
  { match: /(san rafael)/i, lat: -34.6177, lng: -68.3301 },
  { match: /(cafayate|salta)/i, lat: -26.0729, lng: -65.9761 },
  { match: /(patagonia|rio negro)/i, lat: -39.033, lng: -67.583 },
];

const KNOWN_TAP_COORDS: Array<{ match: RegExp; lat: number; lng: number }> = [
  { match: /(san martin|san martín).*?(ar|argentina|buenos aires)|^(san martin|san martín)$/i, lat: -34.5744, lng: -58.5358 },
  { match: /(buenos aires|caba|palermo|recoleta|puerto madero)/i, lat: -34.6037, lng: -58.3816 },
  { match: /(sao paulo|são paulo|brasil|brazil)/i, lat: -23.5558, lng: -46.6396 },
  { match: /(santiago|chile)/i, lat: -33.4489, lng: -70.6693 },
  { match: /(miami|florida|estados unidos|united states|usa)/i, lat: 25.7617, lng: -80.1918 },
  { match: /(zurich|zürich|suiza|switzerland)/i, lat: 47.3769, lng: 8.5417 },
  { match: /(new york|nyc|manhattan)/i, lat: 40.7128, lng: -74.006 },
];

type ProductState =
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER"
  | "VALID_MANUAL_OPENED"
  | "REPLAY_SUSPECT"
  | "INVALID"
  | "UNKNOWN_BATCH"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE";

type SunRightsPolicy = {
  vertical?: string | null;
  verticalLabel?: string | null;
  category?: string | null;
  conditionState?: string | null;
  claimMode?: string | null;
  marketplaceMode?: string | null;
  tokenizationPolicy?: string | null;
  requirements?: string[];
  canClaimPublicly?: boolean;
  canTokenize?: boolean;
  requiresReview?: boolean;
  statusTitle?: string | null;
  statusSummary?: string | null;
  consumerCopy?: string | null;
  enterpriseCopy?: string | null;
  recommendedNextStep?: string | null;
};

type SunCarrierFields = {
  carrierProfileCode?: string | null;
  carrier_profile_code?: string | null;
  carrierLabel?: string | null;
  carrier_label?: string | null;
  carrierSecurityLevel?: number | null;
  carrier_security_level?: number | null;
  carrierConsumerCopy?: string | null;
  carrier_consumer_copy?: string | null;
};

type SunContract = {
  ok?: boolean;
  eventId?: string | null;
  status?: SunCarrierFields & {
    code?: string;
    label?: string;
    tone?: "good" | "warn" | "risk";
    summary?: string;
    reason?: string;
    productState?: string | null;
    tamperSupported?: boolean;
    tamperStatus?: "CLOSED" | "OPENED" | "UNKNOWN" | string;
    tamperReason?: string | null;
    encPlainStatusByte?: string | null;
  };
  identity?: SunCarrierFields & { bid?: string | null; uid?: string | null; uidMasked?: string | null; readCounter?: number | null; tagStatus?: string | null; scanCount?: number | null; eventId?: string | null; tenantSlug?: string | null; tenantId?: string | null };
  tenant?: { id?: string | null; slug?: string | null; name?: string | null; vertical?: string | null; productLabel?: string | null; clubName?: string | null; tokenizationMode?: string | null };
  condition?: SunCarrierFields & { state?: string | null; label?: string | null; summary?: string | null; claimMode?: string | null; tokenizationPolicy?: string | null; marketplaceMode?: string | null; recommendedNextStep?: string | null; requirements?: string[] };
  rightsPolicy?: SunRightsPolicy;
  product?: { 
    name?: string | null; 
    winery?: string | null; 
    region?: string | null; 
    varietal?: string | null; 
    vintage?: string | null; 
    harvestYear?: number | null; 
    barrelMonths?: number | null; 
    storage?: string | null; 
    category?: string | null; 
    vertical?: string | null; 
    sku?: string | null; 
    gtin?: string | null; 
    imageUrl?: string | null; 
    image_url?: string | null; 
    photoUrl?: string | null; 
    photo_url?: string | null; 
    media?: Record<string, unknown> | null;
    notes?: string | null;
    tasting_notes?: string | null;
    maridaje?: string | null;
    serving?: string | null;
    alcohol?: string | null;
    altitude?: string | null;
    oakType?: string | null;
  };
  provenance?: {
    origin?: string | null;
    firstVerified?: { at?: string | null; city?: string | null; country?: string | null };
    lastVerifiedLocation?: { at?: string | null; city?: string | null; country?: string | null; result?: string | null };
    timelineSummary?: Array<{ at?: string | null; result?: string | null; city?: string | null; country?: string | null; device?: string | null; lat?: number | null; lng?: number | null }>;
  };
  iot?: { 
    wineryLocation?: string | null; 
    wineryCoordinates?: { lat?: number | null; lng?: number | null } | null;
    sensorSnapshot?: {
      cellarTemperature?: string | null;
      humidity?: string | null;
      lightExposure?: string | null;
      transitShock?: string | null;
    } | null;
  };
  tapContext?: {
    city?: string | null;
    country?: string | null;
    lat?: number | null;
    lng?: number | null;
    localTime?: string | null;
    utcTime?: string | null;
    timezone?: string | null;
    timezoneLabel?: string | null;
    timezoneOffset?: string | null;
    locationSource?: string | null;
    accuracyM?: number | null;
  };
  tokenization?: { status?: string | null; network?: string | null; txHash?: string | null; tokenId?: string | null; requestId?: string | null; anchorHash?: string | null; reason?: string | null; nextAttemptAt?: string | null; lastError?: string | null };
  tag_tamper?: { available?: boolean; status?: "closed" | "opened" | "invalid" | "unknown" | "not_available" | string; raw?: string | null };
  cta?: {
    claimOwnership?: boolean;
    registerWarranty?: boolean;
    provenance?: boolean;
    tokenize?: boolean;
    clubName?: string | null;
    registerUrl?: string | null;
    portalUrl?: string | null;
    marketplaceUrl?: string | null;
    rewardsUrl?: string | null;
  };
  allowedActions?: string[];
  blockedActions?: string[];
  trustSignals?: { antiReplay?: boolean; tamperRisk?: boolean; tamperStatus?: string | null; tamperSupported?: boolean; lastEventResult?: string | null };
  tapSecurity?: { replayDetected?: boolean; freshTap?: boolean; tokenizationEligible?: boolean; policy?: string | null; commercialPolicy?: string | null; conditionState?: string | null; claimMode?: string | null; marketplaceMode?: string | null; requirements?: string[]; reason?: string | null; snapshot?: boolean; actionability?: string | null; requiresFreshTapForCommercialActions?: boolean };
  snapshot?: { mode?: string | null; diagnosticId?: number | string | null; traceId?: string | null; createdAt?: string | null; expiresAt?: string | null; requiresFreshTap?: boolean; commercialActions?: string | null };
  quality?: { score?: number | null; tier?: string | null };
  verdict?: string | null;
  riskLevel?: string | null;
  troubleshooting?: string[];
  technical?: SunCarrierFields & { raw?: { piccDataPrefix?: string; encPrefix?: string; cmacPrefix?: string } };
};

function fmtDate(value?: string | null, timezone?: string | null) {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || undefined });
}

function resolveOriginCoordinates(input: Array<string | null | undefined>) {
  const blob = input.filter(Boolean).join(" · ");
  const match = KNOWN_ORIGIN_COORDS.find((item) => item.match.test(blob));
  return match ? { lat: match.lat, lng: match.lng } : null;
}

function resolveKnownTapCoordinates(input: Array<string | null | undefined>) {
  const blob = input.filter(Boolean).join(" - ");
  const match = KNOWN_TAP_COORDS.find((item) => item.match.test(blob));
  return match ? { lat: match.lat, lng: match.lng } : null;
}

function haversineKm(fromLat?: number | null, fromLng?: number | null, toLat?: number | null, toLng?: number | null) {
  if (fromLat == null || fromLng == null || toLat == null || toLng == null) return null;
  const radiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)} km`;
}

function policyLabel(value?: string | null) {
  const raw = String(value || "").replace(/_/g, " ").trim();
  if (!raw) return "No configurado";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function mapHref(lat?: number | null, lng?: number | null) {
  if (!isUsableCoordinate(lat, lng)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function isUsableCoordinate(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return false;
  return !(Number(lat) === 0 && Number(lng) === 0);
}

function resolveSunVisualKind(result: SunContract): SunVisualKind {
  const text = [
    result.product?.name,
    result.product?.category,
    result.product?.vertical,
    result.tenant?.vertical,
    result.tenant?.productLabel,
    result.rightsPolicy?.vertical,
    result.rightsPolicy?.verticalLabel,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/(sneaker|zapatilla|shoe|runner|calzado|footwear)/i.test(text)) return "sneaker";
  if (/(apparel|ropa|prenda|campera|jacket|remera|hoodie|textil|fashion|moda)/i.test(text)) return "apparel";
  if (/(ticket|entrada|pass|qr)/i.test(text)) return "ticket";
  if (/(bracelet|brazalete|pulsera|evento|event|vip access)/i.test(text)) return "bracelet";
  if (/(seed|semilla|agro|bolsa|saco|packet)/i.test(text)) return "seeds";
  if (/(perfume|fragancia|fragrance|parfum)/i.test(text)) return "perfume";
  if (/(tubo|tube|dermo|serum)/i.test(text)) return "creamTube";
  if (/(crema|cream|cosmetic|cosmetica|cosmetico|jar|frasco)/i.test(text)) return "creamJar";
  return "wine";
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function demoProductFromParams(params: Record<string, string | string[] | undefined>) {
  const requestedProduct = readParam(params, "product") || readParam(params, "productName") || readParam(params, "name");
  const requestedVertical = readParam(params, "vertical") || readParam(params, "category");
  const text = `${requestedProduct} ${requestedVertical}`.toLowerCase();

  if (/(sneaker|zapatilla|shoe|runner|calzado|footwear)/i.test(text)) {
    return { name: requestedProduct || "Drop Runner 37Z", vertical: "zapatilla", category: "Calzado premium" };
  }
  if (/(apparel|ropa|prenda|campera|jacket|remera|hoodie|textil|fashion|moda)/i.test(text)) {
    return { name: requestedProduct || "Prenda premium conectada", vertical: "moda", category: "Indumentaria" };
  }
  if (/(bracelet|brazalete|pulsera|evento|event|vip access)/i.test(text)) {
    return { name: requestedProduct || "Acceso verificado", vertical: "eventos", category: "Acceso fisico" };
  }
  if (/(ticket|entrada|pass|qr)/i.test(text)) {
    return { name: requestedProduct || "Entrada certificada", vertical: "eventos", category: "Ticket NFC" };
  }
  if (/(seed|semilla|agro|bolsa|saco|packet)/i.test(text)) {
    return { name: requestedProduct || "Sobre semilla certificada", vertical: "agro", category: "Agro" };
  }
  if (/(perfume|fragancia|fragrance|parfum)/i.test(text)) {
    return { name: requestedProduct || "Perfume premium", vertical: "perfume", category: "Fragancia" };
  }
  if (/(skincare|serum|dermo|crema|cream|cosmetic|cosmetica|cosmetico|jar|frasco)/i.test(text)) {
    return { name: requestedProduct || "Set skincare premium", vertical: "skincare", category: "Dermocosmetica" };
  }

  return { name: requestedProduct || "Gran Reserva Malbec", vertical: requestedVertical || "vino", category: requestedVertical || "Vino" };
}

function sunFallbackResult(params: Record<string, string | string[] | undefined>, isDemoPreview: boolean): SunContract {
  const bidParam = typeof params.bid === "string" ? params.bid : "";
  if (!isDemoPreview) {
    return {
      ok: false,
      status: {
        code: "SUN_UPSTREAM_UNAVAILABLE",
        label: "Verificacion pendiente",
        tone: "warn",
        summary: "No pudimos contactar la API de SUN en este momento.",
        reason: "api_unavailable",
        productState: "NOT_REGISTERED",
        tamperSupported: true,
        tamperStatus: "UNKNOWN",
      },
      identity: {
        bid: bidParam || null,
        uid: null,
        scanCount: 0,
        tenantSlug: null,
      },
      product: {
        name: "Producto conectado",
        winery: "Tenant pendiente",
        region: "Origen pendiente",
        varietal: "N/A",
      },
      provenance: { origin: "Sin datos de origen", timelineSummary: [] },
      tapContext: undefined,
      tag_tamper: { available: true, status: "unknown" },
      troubleshooting: ["La API de validacion no respondio. Reintentá el tap o revisá conectividad/API."],
    };
  }

  const demoProduct = demoProductFromParams(params);

  return {
    ok: true,
    status: {
      code: "AUTH_OK",
      label: "Auténtico, sello abierto",
      tone: "good",
      summary: "SUN validado con TagTamper y trazabilidad de origen.",
      reason: "demo_preview",
      productState: "VALID_OPENED",
      tamperSupported: true,
      tamperStatus: "OPENED",
    },
    identity: {
      bid: "BALMEC-2026-02",
      uid: "04A7****1090",
      readCounter: 7,
      tagStatus: "active",
      scanCount: 7,
      eventId: "demo-sun-preview",
      tenantSlug: "demobodega",
    },
    product: {
      name: demoProduct.name,
      winery: "Bodega Balmec",
      region: "Valle de Uco, Mendoza",
      varietal: demoProduct.vertical === "vino" ? "Malbec" : demoProduct.category,
      vintage: "2021",
      barrelMonths: 12,
      storage: "Cava 16C",
      category: demoProduct.category,
      vertical: demoProduct.vertical,
    },
    provenance: {
      origin: "Valle de Uco, Mendoza",
      firstVerified: { at: "2026-04-24T14:00:00.000Z", city: "Tunuyan", country: "AR" },
      lastVerifiedLocation: { at: "2026-05-01T18:30:00.000Z", city: "Buenos Aires", country: "AR", result: "VALID_OPENED" },
      timelineSummary: [
        { at: "2026-05-01T18:30:00.000Z", result: "VALID_OPENED", city: "Buenos Aires", country: "AR", device: "mobile", lat: -34.6037, lng: -58.3816 },
        { at: "2026-04-30T22:20:00.000Z", result: "VALID_CLOSED", city: "Santiago", country: "CL", device: "mobile", lat: -33.4489, lng: -70.6693 },
      ],
    },
    iot: {
      wineryLocation: "Valle de Uco, Mendoza",
      wineryCoordinates: { lat: -33.2095, lng: -69.1211 },
    },
    tapContext: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
    tokenization: { status: "sandbox_ready", network: "Polygon Amoy", txHash: null, tokenId: null },
    tag_tamper: { available: true, status: "opened", raw: "4F4F" },
    cta: { claimOwnership: true, registerWarranty: true, provenance: true, tokenize: true },
    troubleshooting: [],
    technical: { raw: { piccDataPrefix: "04A7", encPrefix: "4F4F", cmacPrefix: "SUN" } },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "SUN Passport · nexID",
    openGraph: {
      title: "SUN Passport · nexID",
      images: [{ url: `/opengraph-image?surface=sun&campaign=enterprise&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "SUN Passport · nexID",
      images: [`/twitter-image?surface=sun&campaign=enterprise&locale=${encodeURIComponent(locale)}`],
    },
  };
}

export default async function SunPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { locale, locales } = await getWebI18n();
  const isQrScan = params.qr === "1" || params.channel === "qr";
  const query = new URLSearchParams();
  ["v", "bid", "picc_data", "enc", "cmac"].forEach((key) => {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  });

  const snapshotId = typeof params.snapshot === "string" ? params.snapshot.trim() : "";
  const snapshotTrace = typeof params.trace === "string" ? params.trace.trim() : "";
  const freshToken = typeof params.fresh === "string"
    ? params.fresh.trim()
    : typeof params.fresh_token === "string"
      ? params.fresh_token.trim()
      : "";
  const resolvedApiBase = apiBase(params);

  let result: SunContract;
  let snapshotResult: SunContract | null = null;
  let isDemoPreview = false;

  if (isQrScan) {
    const requestedProduct = readParam(params, "product") || readParam(params, "productName") || "Gran Reserva Malbec";
    const requestedWinery = readParam(params, "winery") || readParam(params, "brand") || "Bodega Balmec";
    const requestedTenant = readParam(params, "tenant") || "demobodega";
    const incomingHeaders = await headers();
    const qrQuery = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) qrQuery.set(key, value.trim());
    });
    qrQuery.set("qr", "1");
    if (!qrQuery.get("tenant")) qrQuery.set("tenant", requestedTenant);
    if (!qrQuery.get("product")) qrQuery.set("product", requestedProduct);
    if (!qrQuery.get("winery")) qrQuery.set("winery", requestedWinery);
    const forwardedHeaders = new Headers();
    forwardedHeaders.set("accept", "application/json");
    ["user-agent", "accept-language", "x-forwarded-for", "x-real-ip", "x-vercel-ip-city", "x-vercel-ip-country", "x-vercel-ip-latitude", "x-vercel-ip-longitude"].forEach((key) => {
      const value = incomingHeaders.get(key);
      if (value) forwardedHeaders.set(key, value);
    });
    const apiQrResult = await fetch(`${resolvedApiBase}/sun?${qrQuery.toString()}`, {
      headers: forwardedHeaders,
      cache: "no-store",
    })
      .then((res) => res.ok ? res.json() : null)
      .catch(() => null) as SunContract | null;
    result = apiQrResult || {
      ok: true,
      status: {
        code: "QR_UNVERIFIED",
        label: "QR / SDK engagement",
        tone: "warn",
        summary: "Canal de bajo costo para ficha, CRM, analitica, leads y fidelizacion. No es prueba criptografica NFC ni activa propiedad automaticamente.",
        reason: "qr_sdk_engagement",
        productState: "NOT_REGISTERED",
        tamperSupported: false,
      },
      identity: {
        bid: "QR-SCAN",
        uid: null,
        scanCount: 1,
        tenantSlug: requestedTenant,
      },
      product: {
        name: requestedProduct,
        winery: requestedWinery,
        region: "Mendoza, Argentina",
        varietal: "N/A",
      },
      provenance: { origin: "Mendoza, Argentina", timelineSummary: [] },
      tapContext: undefined,
      tag_tamper: { available: false, status: "not_available" },
      cta: { claimOwnership: false, registerWarranty: false, provenance: false, tokenize: false },
      troubleshooting: [],
    };
  } else {
    snapshotResult = snapshotId && snapshotTrace
      ? await fetch(`${resolvedApiBase}/sun/snapshot/${encodeURIComponent(snapshotId)}?trace=${encodeURIComponent(snapshotTrace)}${freshToken ? `&fresh=${encodeURIComponent(freshToken)}` : ""}`, { cache: "no-store" })
        .then((res) => res.ok ? res.json() : null)
        .then((payload) => payload?.contract || null)
        .catch(() => null) as SunContract | null
      : null;
    isDemoPreview = query.toString().length === 0 && !snapshotId;
    const response = snapshotResult ? null : await fetch(`${resolvedApiBase}/sun?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    const parsedResult = response?.ok
      ? await response.json().catch(() => null) as SunContract | null
      : null;
    result = snapshotResult || parsedResult || sunFallbackResult(params, isDemoPreview);
  }

  // Proactively fetch loyalty overview if we know the tenant
  let loyaltyData = null;
  if (result.ok && result.identity?.tenantSlug) {
    const memKey = "anonymous"; // using anonymous mode for the public passport
    loyaltyData = await fetch(`${resolvedApiBase}/mobile/loyalty/overview?tenantSlug=${result.identity.tenantSlug}&memberKey=${memKey}`, { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => null);
  }

  const bid = String(result.identity?.bid || params.bid || "");
  const uid = String(result.identity?.uid || "");
  const uidMasked = String(result.identity?.uidMasked || result.identity?.uid || "");
  const statusCode = String(result.status?.code || "").toUpperCase();
  const statusReason = String(result.status?.reason || "").toLowerCase();
  const productState = String(result.status?.productState || "").toUpperCase();
  const ttStatus = String(result.tag_tamper?.status || "").toLowerCase();
  const blockedActions = result.blockedActions || [];
  const allowedActions = result.allowedActions || [];
  const rightsPolicy = result.rightsPolicy || {};
  const condition = result.condition || {};
  const conditionState = String(rightsPolicy.conditionState || condition.state || result.tapSecurity?.conditionState || "");
  const rightsTitle = String(rightsPolicy.statusTitle || condition.label || "");
  const rightsSummary = String(rightsPolicy.consumerCopy || rightsPolicy.statusSummary || condition.summary || "");
  const rightsEnterpriseCopy = String(rightsPolicy.enterpriseCopy || "");
  const rightsRequirements = Array.isArray(rightsPolicy.requirements)
    ? rightsPolicy.requirements
    : Array.isArray(condition.requirements)
      ? condition.requirements
      : [];
  const claimModeLabel = policyLabel(rightsPolicy.claimMode || condition.claimMode || result.tapSecurity?.claimMode);
  const tokenPolicyLabel = policyLabel(rightsPolicy.tokenizationPolicy || condition.tokenizationPolicy || result.tapSecurity?.commercialPolicy || result.tapSecurity?.policy);
  const marketplaceModeLabel = policyLabel(rightsPolicy.marketplaceMode || condition.marketplaceMode || result.tapSecurity?.marketplaceMode);
  const verticalLabel = String(rightsPolicy.verticalLabel || result.product?.category || result.tenant?.vertical || result.product?.vertical || "Producto fisico");
  const trustSignals = result.trustSignals || {};
  const snapshotMode = String(result.snapshot?.mode || "");
  const tapActionability = String(result.tapSecurity?.actionability || "");
  const isFreshHandoff = snapshotMode === "fresh_handoff" || tapActionability === "fresh_handoff";
  const isSnapshotView = Boolean((snapshotResult && !isFreshHandoff) || result.snapshot?.mode === "historical" || result.snapshot?.requiresFreshTap || (result.tapSecurity?.snapshot && !isFreshHandoff));
  const isReplay = Boolean(result.tapSecurity?.replayDetected)
    || statusCode === "REPLAY_SUSPECT"
    || productState === "REPLAY_SUSPECT"
    || statusReason.includes("replay")
    || statusReason.includes("copied url")
    || trustSignals.antiReplay === false;
  const isVerifiedOpenedState = ["OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(statusCode)
    || productState === "VALID_OPENED"
    || productState === "VALID_OPENED_PREVIOUSLY"
    || productState === "VALID_MANUAL_OPENED"
    || ttStatus === "opened"
    || ttStatus === "opened_previously";
  const isCommercialBlocked = blockedActions.some((action) => ["claim", "save", "join", "warranty", "rewards", "tokenization"].includes(action));
  const verdictName = String(result.verdict || "").toLowerCase();
  const isTamperRisk = Boolean(trustSignals.tamperRisk)
    || result.status?.tone === "risk"
    || statusCode === "TAMPER_RISK"
    || productState === "TAMPER_RISK"
    || verdictName === "tampered";
  const conditionStateName = conditionState.toLowerCase();
  const isSunProfileMismatch = statusCode === "SUN_PROFILE_MISMATCH"
    || verdictName === "sun_profile_mismatch"
    || ["sun_profile_mismatch", "blocked_sun_profile_mismatch"].includes(conditionStateName)
    || statusReason.includes("uid length invalid")
    || statusReason.includes("cmac mismatch")
    || statusReason.includes("picc_data bad length")
    || statusReason.includes("invalid_sun_payload")
    || statusReason.includes("sun_crypto_failed")
    || statusReason.includes("crypto_decode_failed");
  const hasAuthenticTone = result.status?.tone === "good" || (result.status?.tone === "warn" && isVerifiedOpenedState);
  const isTechnicallyAuthentic = result.ok !== false
    && !isReplay
    && !isTamperRisk
    && !isSunProfileMismatch
    && (hasAuthenticTone || ["VALID", "AUTH_OK"].includes(statusCode) || isVerifiedOpenedState || verdictName === "valid" || verdictName === "valid_opened");
  const isActionableTap = isTechnicallyAuthentic && !isCommercialBlocked;
  const isFreshCommercialTap = isActionableTap && (isFreshHandoff || !isSnapshotView);
  const isValid = isTechnicallyAuthentic && !isVerifiedOpenedState && ["VALID", "AUTH_OK"].includes(statusCode);
  const isRiskBlocked = isReplay || isTamperRisk || isSunProfileMismatch || !isTechnicallyAuthentic;
  const showEngagementSuite = (isQrScan || isFreshCommercialTap || isVerifiedOpenedState) && !isRiskBlocked && !isSnapshotView;
  const troubleshooting = result.troubleshooting || [];
  const canAutoOnboard = String(result.status?.reason || "").toLowerCase().includes("unknown batch") && /^DEMO-[A-Z0-9-]{3,40}$/.test(bid);
  const timelinePoints = (result.provenance?.timelineSummary || [])
    .map((item) => {
      const city = item.city || "Unknown city";
      const country = item.country || "--";
      const knownCoords = resolveKnownTapCoordinates([city, country, `${city}, ${country}`]);
      const hasEventCoords = isUsableCoordinate(item.lat, item.lng);
      const lat = hasEventCoords ? Number(item.lat) : knownCoords?.lat;
      const lng = hasEventCoords ? Number(item.lng) : knownCoords?.lng;
      if (lat == null || lng == null) return null;
      return {
        city,
        country,
        lat,
        lng,
        scans: 1,
        risk: String(item.result || "").toLowerCase().includes("replay") || String(item.result || "").toLowerCase().includes("tamper") ? 1 : 0,
        status: item.result || "REVIEW",
        lastSeen: item.at || undefined,
        source: hasEventCoords ? "tap_timeline" : "tap_city_geocenter",
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const resolvedOriginCoords = result.iot?.wineryCoordinates?.lat != null && result.iot?.wineryCoordinates?.lng != null
    ? { lat: Number(result.iot.wineryCoordinates.lat), lng: Number(result.iot.wineryCoordinates.lng) }
    : resolveOriginCoordinates([
      result.iot?.wineryLocation,
      result.product?.winery,
      result.product?.region,
      result.provenance?.origin,
      result.provenance?.firstVerified?.city,
      result.provenance?.firstVerified?.country,
    ]);
  const wineryPoint = resolvedOriginCoords
    ? [{
      city: result.product?.winery || "Bodega",
      country: result.provenance?.firstVerified?.country || "AR",
      lat: Number(resolvedOriginCoords.lat),
      lng: Number(resolvedOriginCoords.lng),
      scans: 1,
      risk: 0,
      status: "ORIGIN",
      source: "winery_origin",
    }]
    : [];
  const hasCurrentTapCoords = isUsableCoordinate(result.tapContext?.lat, result.tapContext?.lng);
  const currentTapFallbackCoords = hasCurrentTapCoords
    ? null
    : resolveKnownTapCoordinates([
      result.tapContext?.city,
      result.tapContext?.country,
      result.provenance?.lastVerifiedLocation?.city,
      result.provenance?.lastVerifiedLocation?.country,
      result.provenance?.timelineSummary?.[0]?.city,
      result.provenance?.timelineSummary?.[0]?.country,
    ]);
  const currentTapLat = hasCurrentTapCoords ? Number(result.tapContext?.lat) : currentTapFallbackCoords?.lat;
  const currentTapLng = hasCurrentTapCoords ? Number(result.tapContext?.lng) : currentTapFallbackCoords?.lng;
  const currentTapCity = result.tapContext?.city || result.provenance?.lastVerifiedLocation?.city || result.provenance?.timelineSummary?.[0]?.city || "Tap";
  const currentTapCountry = result.tapContext?.country || result.provenance?.lastVerifiedLocation?.country || result.provenance?.timelineSummary?.[0]?.country || "--";
  const currentTapPoint = currentTapLat != null && currentTapLng != null
    ? [{
      city: currentTapCity,
      country: currentTapCountry,
      lat: currentTapLat,
      lng: currentTapLng,
      scans: 1,
      risk: isRiskBlocked ? 1 : 0,
      status: result.status?.code || "REVIEW",
      source: hasCurrentTapCoords ? "current_mobile_tap" : "current_tap_city_geocenter",
    }]
    : [];
  const orderedTimelinePoints = [...timelinePoints].reverse();
  const rawMapRoutes: Array<{
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    label?: string;
    tone: "warn" | "info";
  }> = [
    ...(wineryPoint.length && orderedTimelinePoints.length ? [{ fromLat: wineryPoint[0].lat, fromLng: wineryPoint[0].lng, toLat: orderedTimelinePoints[0].lat, toLng: orderedTimelinePoints[0].lng, label: "Origen de bodega → primer evento registrado", tone: "info" as const }] : []),
    ...(wineryPoint.length && !orderedTimelinePoints.length && currentTapPoint.length ? [{ fromLat: wineryPoint[0].lat, fromLng: wineryPoint[0].lng, toLat: currentTapPoint[0].lat, toLng: currentTapPoint[0].lng, label: "Origen del producto → tap actual", tone: currentTapPoint[0].risk > 0 ? "warn" as const : "info" as const }] : []),
    ...(orderedTimelinePoints.length > 1 ? orderedTimelinePoints.slice(1).map((point, idx) => ({ fromLat: orderedTimelinePoints[idx].lat, fromLng: orderedTimelinePoints[idx].lng, toLat: point.lat, toLng: point.lng, tone: point.risk > 0 ? "warn" as const : "info" as const })) : []),
    ...(orderedTimelinePoints.length && currentTapPoint.length ? [{ fromLat: orderedTimelinePoints[orderedTimelinePoints.length - 1].lat, fromLng: orderedTimelinePoints[orderedTimelinePoints.length - 1].lng, toLat: currentTapPoint[0].lat, toLng: currentTapPoint[0].lng, label: "Último evento → tap actual", tone: currentTapPoint[0].risk > 0 ? "warn" as const : "info" as const }] : []),
  ];
  const filteredMapRoutes = rawMapRoutes.filter((route) => (haversineKm(route.fromLat, route.fromLng, route.toLat, route.toLng) || 0) >= 1);
  const originToCurrentTapRoute = wineryPoint.length && currentTapPoint.length
    ? {
      fromLat: wineryPoint[0].lat,
      fromLng: wineryPoint[0].lng,
      toLat: currentTapPoint[0].lat,
      toLng: currentTapPoint[0].lng,
      label: "Origen del producto -> tap actual",
      tone: currentTapPoint[0].risk > 0 ? "warn" as const : "info" as const,
    }
    : null;
  const mapRoutes = filteredMapRoutes.length
    ? filteredMapRoutes
    : originToCurrentTapRoute && (haversineKm(originToCurrentTapRoute.fromLat, originToCurrentTapRoute.fromLng, originToCurrentTapRoute.toLat, originToCurrentTapRoute.toLng) || 0) >= 1
      ? [originToCurrentTapRoute]
      : [];
  const originToTapDistance = wineryPoint.length && currentTapPoint.length
    ? haversineKm(wineryPoint[0].lat, wineryPoint[0].lng, currentTapPoint[0].lat, currentTapPoint[0].lng)
    : null;
  const originMapHref = wineryPoint.length ? mapHref(wineryPoint[0].lat, wineryPoint[0].lng) : "";
  const tapMapHref = currentTapPoint.length ? mapHref(currentTapPoint[0].lat, currentTapPoint[0].lng) : "";
  const originDisplay = wineryPoint.length
    ? `${wineryPoint[0].city}, ${wineryPoint[0].country}`
    : result.provenance?.origin || result.product?.region || "Origen no informado";
  const tapDisplay = currentTapPoint.length
    ? `${currentTapPoint[0].city}, ${currentTapPoint[0].country}`
    : result.provenance?.lastVerifiedLocation?.city
      ? `${result.provenance.lastVerifiedLocation.city}, ${result.provenance.lastVerifiedLocation.country || "--"}`
      : "Tap actual no geolocalizado";
  const rawLocationSource = String(result.tapContext?.locationSource || "").toLowerCase();
  const accuracyM = Number(result.tapContext?.accuracyM);
  const hasAccuracy = Number.isFinite(accuracyM) && accuracyM > 0;
  const tapLocationPrecisionLabel = rawLocationSource === "browser_gps"
    ? `GPS telefono${hasAccuracy ? ` (${Math.round(accuracyM)} m)` : ""}`
    : rawLocationSource === "ip_geo"
      ? "IP aproximada"
      : rawLocationSource.includes("error") || rawLocationSource.includes("denied")
        ? "GPS no autorizado"
        : hasCurrentTapCoords
          ? "Coordenada reportada"
          : currentTapFallbackCoords
            ? "Centro de ciudad aproximado"
            : "Sin ubicacion";
  const distanceDisplay = fmtDistance(originToTapDistance);
  const dynamicTastingNotes = result.product?.notes || result.product?.tasting_notes || "Entrada dulce y carnosa, con taninos maduros y redondos. Final persistente con toques de cacao y frutos negros.";
  const dynamicMaridaje = result.product?.maridaje || "Carnes rojas asadas, pastas con salsas trufadas o quesos curados.";
  const dynamicTemp = result.iot?.sensorSnapshot?.cellarTemperature || "15.2°C";
  const dynamicHumidity = result.iot?.sensorSnapshot?.humidity || "62%";
  const dynamicLight = result.iot?.sensorSnapshot?.lightExposure || "Low / protected";
  const dynamicShock = result.iot?.sensorSnapshot?.transitShock || "No critical shocks detected";
  const mapUid = uid || uidMasked || bid || "sun-public-tap";
  const mapTenant = String(result.identity?.tenantSlug || "public");
  const mapProductName = result.product?.name || result.identity?.bid || "Producto verificado";
  const mapTimelineSummary = result.provenance?.timelineSummary || [];
  const firstMapSeenAt = result.provenance?.firstVerified?.at || mapTimelineSummary[mapTimelineSummary.length - 1]?.at || "";
  const lastMapSeenAt = result.provenance?.lastVerifiedLocation?.at || mapTimelineSummary[0]?.at || "";
  const opsMapPoints: GlobalOpsPoint[] = [
    ...wineryPoint.map((point, index) => ({
      id: `origin-${mapUid}-${index}`,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      scans: Math.max(1, Number(result.identity?.scanCount || 1)),
      risk: 0,
      verdict: "ORIGIN",
      tenantSlug: mapTenant,
      lastSeen: firstMapSeenAt || new Date(0).toISOString(),
      uid: mapUid,
      device: "producer",
      role: "origin" as const,
      productName: mapProductName,
    })),
    ...orderedTimelinePoints.map((point, index) => ({
      id: `timeline-${mapUid}-${index}`,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      scans: Math.max(1, point.scans || 1),
      risk: point.risk,
      verdict: point.status,
      tenantSlug: mapTenant,
      lastSeen: point.lastSeen || new Date(index + 1).toISOString(),
      uid: mapUid,
      device: "mobile",
      role: "hub" as const,
      productName: mapProductName,
    })),
    ...currentTapPoint.map((point, index) => ({
      id: `current-tap-${mapUid}-${index}`,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      scans: Math.max(1, Number(result.identity?.scanCount || 1)),
      risk: point.risk,
      verdict: point.status,
      tenantSlug: mapTenant,
      lastSeen: lastMapSeenAt || new Date().toISOString(),
      uid: mapUid,
      device: "mobile",
      role: "tap" as const,
      productName: mapProductName,
    })),
  ];
  const opsMapRoutes: GlobalOpsRoute[] = mapRoutes.map((route, index) => ({
    id: `sun-route-${mapUid}-${index}`,
    fromLat: route.fromLat,
    fromLng: route.fromLng,
    toLat: route.toLat,
    toLng: route.toLng,
    uid: mapUid,
    risk: route.tone === "warn" ? 1 : 0,
    taps: Math.max(1, Number(result.identity?.scanCount || orderedTimelinePoints.length || 1)),
    firstSeenAt: firstMapSeenAt,
    lastSeenAt: lastMapSeenAt,
    fromLabel: index === 0 ? originDisplay : undefined,
    toLabel: index === mapRoutes.length - 1 ? tapDisplay : undefined,
    productName: route.label || mapProductName,
  }));
  const livePillLabel = isQrScan ? "QR / SDK" : isFreshHandoff ? "Tap fisico activo" : isSnapshotView ? "Consulta segura" : "Tap SUN";

  const securityTone = isValid
    ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
    : isVerifiedOpenedState && isTechnicallyAuthentic
      ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : isSunProfileMismatch
        ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : "border-rose-300/20 bg-rose-500/10 text-rose-100";
  const apiQualityScore = Number(result.quality?.score);
  const baseTrustScore = Number.isFinite(apiQualityScore)
    ? apiQualityScore
    : isValid
      ? 94
      : isVerifiedOpenedState && isTechnicallyAuthentic
        ? 84
        : isTechnicallyAuthentic
          ? 76
          : 48;
  const currentRiskPenalty = isSunProfileMismatch
    ? 44
    : isReplay
      ? 35
      : isTamperRisk
        ? 30
        : 0;
  const stateScoreCap = isSunProfileMismatch
    ? 58
    : isReplay || isTamperRisk
      ? 62
      : isVerifiedOpenedState
        ? 84
        : 100;
  const trustScore = Math.max(
    0,
    Math.min(
      stateScoreCap,
      baseTrustScore
        - currentRiskPenalty
        + (result.tokenization?.status ? 4 : 0)
        + ((result.identity?.scanCount || 0) > 3 ? 2 : 0),
    ),
  );
  const trustTone =
    trustScore >= 85 ? "text-emerald-200" : trustScore >= 65 ? "text-amber-200" : "text-rose-200";
  const timelineCount = result.provenance?.timelineSummary?.length || 0;
  const timelineCities = new Set((result.provenance?.timelineSummary || []).map((item) => `${item.city || "Unknown"}|${item.country || "--"}`)).size;
  const lastEventAt = result.provenance?.timelineSummary?.[0]?.at || result.provenance?.lastVerifiedLocation?.at || null;
  const localTapTimeLabel = result.tapContext?.localTime || (lastEventAt ? fmtDate(lastEventAt, result.tapContext?.timezone) : "");
  const statusDotClass = isSnapshotView
    ? "sun-status-dot--warn"
    : isValid
    ? "sun-status-dot--good"
    : isSunProfileMismatch
      ? "sun-status-dot--warn"
    : isReplay
      ? "sun-status-dot--replay"
      : isTamperRisk || result.status?.tone === "risk"
        ? "sun-status-dot--risk"
        : "sun-status-dot--warn";
  const pulseClass = isSnapshotView
    ? "bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.75)]"
    : isSunProfileMismatch
    ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
    : isRiskBlocked
    ? "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]"
    : isVerifiedOpenedState
      ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
      : "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]";
  const statusHeadline = isSunProfileMismatch
    ? "No pudimos validar esta lectura."
    : ttStatus === "closed" || productState === "VALID_CLOSED"
    ? "Autenticidad confirmada. Sello intacto."
    : ttStatus === "opened" || ttStatus === "opened_previously" || productState === "VALID_OPENED" || productState === "VALID_OPENED_PREVIOUSLY"
      ? "Producto auténtico, pero el sello ya fue abierto."
    : ttStatus === "invalid"
      ? "TagTamper no inicializado o configuración inválida."
    : productState === "VALID_MANUAL_OPENED"
      ? "Autenticidad confirmada. Sello marcado como abierto por operador."
    : productState === "VALID_OPENED"
      ? "Producto auténtico, pero el sello ya fue abierto."
    : productState === "VALID_UNKNOWN_TAMPER" || ttStatus === "not_available"
        ? "Autenticidad confirmada. Estado de apertura no disponible."
        : result.status?.code === "REPLAY_SUSPECT"
          ? "Este payload ya fue usado. Escaneá físicamente la etiqueta para generar una nueva lectura."
          : result.status?.tone === "good"
            ? "Autenticidad verificada"
            : result.status?.tone === "risk"
              ? "Se detectaron señales de riesgo"
              : "Validación en revisión";
  const displayRiskLevelLabel = isQrScan
    ? "Engagement QR"
    : isFreshHandoff
    ? "Tap accionable"
    : isSnapshotView
    ? "Consulta segura"
    : isSunProfileMismatch
    ? "Batch tecnico bloqueado"
    : isRiskBlocked
    ? "Riesgo alto"
    : isVerifiedOpenedState
      ? "Riesgo bajo | sello abierto"
      : trustScore >= 85
        ? "Riesgo bajo"
        : trustScore >= 65
          ? "Riesgo moderado"
          : "Riesgo alto";
  const displayStatusHeadline = isQrScan
    ? "Ficha publica QR / SDK"
    : rightsTitle || (isVerifiedOpenedState && isTechnicallyAuthentic
    ? "Producto auténtico. El sello de la botella ya fue abierto."
    : statusHeadline);
  const reportProblemHref = "/?contact=sales&intent=sun_mobile#contact-modal";
  const recommendedAction = isFreshCommercialTap
    ? { label: "Ver ficha y opciones", href: "#consumer-choice", helper: rightsPolicy.recommendedNextStep || "No hace falta registrarse para leer la ficha. Contacto, club, garantia y propiedad son pasos opt-in separados." }
    : isSnapshotView
      ? { label: "Ver ficha", href: "#product-info", helper: "Consulta segura: autenticidad y trazabilidad quedan visibles. Acciones sensibles requieren otro tap fisico." }
    : isSunProfileMismatch
      ? { label: "Avisar a soporte", href: reportProblemHref, helper: "El producto y el lote quedan visibles. Garantia, club o tokenizacion esperan el perfil SUN correcto o el payload del proveedor." }
    : trustScore >= 65
      ? { label: "Ver detalles de trazabilidad", href: "#geo-trace", helper: "Revisá ruta y consistencia antes de guardar." }
      : { label: "Reportar y reintentar tap", href: reportProblemHref, helper: "Señal de riesgo alta. Escaneá físicamente de nuevo." };
  const tenantSlug = String(result.identity?.tenantSlug || "").trim();
  const telemetryEndpoint = `${resolvedApiBase.replace(/\/$/, "")}/sun/context`;
  const marketplaceHref = tenantSlug ? `/me/marketplace?tenant=${encodeURIComponent(tenantSlug)}` : "/me/marketplace";
  const eventId = String(result.identity?.eventId || result.eventId || "").trim();
  const localizeHref = (href?: string | null) => {
    const raw = String(href || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return raw;
    }
  };
  const tapParams = new URLSearchParams({ fromTap: "1" });
  if (tenantSlug) tapParams.set("tenant", tenantSlug);
  if (eventId) tapParams.set("eventId", eventId);
  const withTapQuery = (path: string, action: string) => {
    const [pathWithoutHash, hash = ""] = path.split("#");
    const [pathname, existingQuery = ""] = pathWithoutHash.split("?");
    const nextParams = new URLSearchParams(existingQuery);
    tapParams.forEach((value, key) => {
      if (!nextParams.has(key)) nextParams.set(key, value);
    });
    nextParams.set("action", action);
    return `${pathname}?${nextParams.toString()}${hash ? `#${hash}` : ""}`;
  };
  const registerHref = localizeHref(result.cta?.registerUrl) || withTapQuery("/me", "register");
  const walletHref = withTapQuery("/me/wallet", "wallet");
  const rewardsHref = localizeHref(result.cta?.rewardsUrl) || withTapQuery("/me/rewards", "rewards");
  const tapMarketplaceHref = localizeHref(result.cta?.marketplaceUrl) || withTapQuery(marketplaceHref, "marketplace");
  const certificateHref = !isQrScan && /^\d+$/.test(eventId) ? `/certificado/${encodeURIComponent(eventId)}` : "";
  const blockedTapReason = isQrScan
    ? "QR informativo: podes leer, consultar al sommelier o dejar contacto. Garantia, wallet, NFT y propiedad requieren compra validada o NFC seguro."
    : isFreshCommercialTap
    ? ""
    : isSnapshotView
      ? "Consulta guardada: ficha y trazabilidad visibles. Beneficios sensibles requieren un nuevo tap fisico."
    : isSunProfileMismatch
      ? "Producto, lote y bodega detectados. Las acciones premium quedan protegidas hasta que la marca cargue el perfil SUN correcto del batch o registre el payload fisico del proveedor."
    : isReplay
      ? "Replay detectado: por seguridad necesitas un nuevo tap fisico para garantia, club o tokenizacion."
    : "Este tap no habilita acciones sensibles. Necesitas un tap valido y fresco para continuar.";
  const protectedBannerTitle = isSnapshotView
    ? "Consulta segura"
    : isSunProfileMismatch
      ? "Producto detectado, activacion pendiente"
    : isReplay
      ? "Replay bloqueado"
      : "Accion protegida";
  const protectedBannerCopy = isSnapshotView
    ? "Autenticidad y trazabilidad visibles. Puntos, club, garantia y tokenizacion quedan protegidos hasta un nuevo tap fisico."
    : isSunProfileMismatch
      ? "El lote fue detectado como Bodega Balmec, pero la lectura SUN no descifra a un UID autorizado. Hay que corregir claves/layout o registrar el payload fisico del proveedor."
    : isReplay
      ? "La URL/SUN ya fue usada. Conservamos la evidencia y pedimos un nuevo tap fisico para acciones comerciales."
      : "Por seguridad, este producto no puede guardarse en la coleccion ni sumar puntos con esta lectura.";
  const protectedBannerClass = isReplay || isTamperRisk
    ? "border-red-500/30 bg-red-950/20 text-red-100"
    : isSnapshotView
      ? "border-sky-300/25 bg-sky-500/10 text-sky-50"
    : isSunProfileMismatch
      ? "border-amber-300/30 bg-amber-500/10 text-amber-50"
      : "border-amber-300/25 bg-amber-500/10 text-amber-50";
  const journeySteps = [
    { id: "scan", label: "Tap NFC", done: true },
    { id: "verify", label: "Verificación", done: Boolean(result.status?.label) },
    { id: "ficha", label: "Ficha", done: true },
    { id: "optin", label: "Opt-in", done: false },
  ];
  const sealOpened = ttStatus === "opened" || ttStatus === "opened_previously" || productState === "VALID_OPENED" || productState === "VALID_OPENED_PREVIOUSLY" || productState === "VALID_MANUAL_OPENED";
  const sealClosed = ttStatus === "closed" || productState === "VALID_CLOSED";
  const rawCarrierProfileCode = String(
    result.status?.carrierProfileCode ||
      result.status?.carrier_profile_code ||
      result.identity?.carrierProfileCode ||
      result.identity?.carrier_profile_code ||
      result.condition?.carrierProfileCode ||
      result.condition?.carrier_profile_code ||
      result.technical?.carrierProfileCode ||
      result.technical?.carrier_profile_code ||
      "",
  ).toLowerCase();
  const carrierLabels: Record<string, string> = {
    qr_basic: "QR comun",
    gs1_digital_link: "QR GS1 Digital Link",
    ntag213: "NTAG213",
    ntag215: "NTAG215",
    ntag216: "NTAG216",
    ntag424_dna: "NTAG 424 DNA",
    ntag424_dna_tt: "NTAG 424 DNA TT",
  };
  const carrierLabel = isQrScan
    ? "QR / SDK"
    : result.status?.carrierLabel ||
    result.status?.carrier_label ||
    result.identity?.carrierLabel ||
    result.identity?.carrier_label ||
    result.condition?.carrierLabel ||
    result.condition?.carrier_label ||
    result.technical?.carrierLabel ||
    result.technical?.carrier_label ||
    carrierLabels[rawCarrierProfileCode] ||
    (result.status?.tamperSupported || result.tag_tamper?.available
      ? "NTAG 424 DNA TT"
      : result.technical?.raw
        ? "NTAG 424 DNA"
        : "QR / NFC");
  const isCryptoCarrier = !isQrScan && (
    rawCarrierProfileCode === "ntag424_dna" ||
    rawCarrierProfileCode === "ntag424_dna_tt" ||
    (!rawCarrierProfileCode && Boolean(result.technical?.raw || result.status?.tamperSupported || result.tag_tamper?.available))
  );
  const isTamperCarrier = !isQrScan && (
    rawCarrierProfileCode === "ntag424_dna_tt" ||
    (!rawCarrierProfileCode && Boolean(result.status?.tamperSupported || result.tag_tamper?.available))
  );
  const rawCarrierConsumerCopy = (
    result.status?.carrierConsumerCopy ||
    result.status?.carrier_consumer_copy ||
    result.condition?.carrierConsumerCopy ||
    result.condition?.carrier_consumer_copy ||
    ""
  ) as unknown;
  const carrierConsumerCopy = typeof rawCarrierConsumerCopy === "string"
    ? rawCarrierConsumerCopy
    : rawCarrierConsumerCopy && typeof rawCarrierConsumerCopy === "object"
      ? String(
          (rawCarrierConsumerCopy as { body?: unknown }).body
          || (rawCarrierConsumerCopy as { headline?: unknown }).headline
          || (rawCarrierConsumerCopy as { disclaimer?: unknown }).disclaimer
          || (rawCarrierConsumerCopy as { summary?: unknown }).summary
          || (rawCarrierConsumerCopy as { title?: unknown }).title
          || "",
        )
      : "";
  const tokenStatus = String(result.tokenization?.status || "none");
  const normalizedTokenStatus = tokenStatus.toLowerCase();
  const tokenNetwork = result.tokenization?.network || "Polygon Amoy";
  const tokenTx = String(result.tokenization?.txHash || "");
  const tokenId = String(result.tokenization?.tokenId || "");
  const hasOnChainTx = Boolean(tokenTx && !tokenTx.toUpperCase().includes("DEMO") && normalizedTokenStatus !== "sandbox_ready");
  const hasOnChainProof = hasOnChainTx || Boolean(tokenId && (normalizedTokenStatus === "minted" || normalizedTokenStatus === "anchored"));
  const tokenPending = ["pending", "processing", "requested", "mint_pending_retry", "pending_retry"].some((value) => normalizedTokenStatus.includes(value));
  const tokenFailed = normalizedTokenStatus === "failed" || normalizedTokenStatus === "mint_failed";
  const tokenBlocked = normalizedTokenStatus.startsWith("blocked");
  const tokenStatusDisplay = hasOnChainProof
    ? tokenId
      ? `Minted #${tokenId}`
      : "Minted on-chain"
    : tokenPending
      ? "Mint pendiente"
      : tokenFailed
        ? "Mint en revision"
        : tokenBlocked
          ? "Bloqueado"
          : normalizedTokenStatus.includes("sandbox") || normalizedTokenStatus.includes("simulated")
            ? "Sandbox"
            : "Sin token";
  const tokenStatusBadgeClass = hasOnChainProof
    ? "bg-emerald-500/15 text-emerald-100"
    : tokenPending
      ? "bg-amber-500/15 text-amber-100"
      : tokenFailed
        ? "bg-rose-500/15 text-rose-100"
        : tokenBlocked
          ? "bg-slate-800 text-slate-300"
          : "bg-cyan-500/10 text-cyan-100";
  const tokenExplorerHref = hasOnChainTx ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(tokenTx)}` : "";
  const nftDisplayTitle = hasOnChainProof
    ? "NFT certificado en blockchain"
    : tokenPending
      ? "NFT solicitado, mint en cola"
      : tokenBlocked
        ? "NFT protegido por politica"
        : "NFT listo para activar";
  const nftDisplayCopy = hasOnChainProof
    ? "El producto ya tiene una prueba on-chain asociada. Beneficios, wallet o propiedad se activan solo con flujo opt-in."
    : tokenPending
      ? "La solicitud quedo guardada. El minter de Polygon puede completar el anclaje sin que el consumidor pierda el recorrido."
      : tokenBlocked
        ? "Mostramos la prueba de autenticidad, pero el mint queda bloqueado hasta tener un tap fresco y apto."
        : "Si la marca lo habilita y el comprador valida la compra, el producto puede sumar certificado NFT/sandbox, wallet, club o marketplace.";
  const replayDecisionText = isSunProfileMismatch
    ? "Producto y lote detectados. La activacion comercial queda pendiente porque el perfil SUN del batch no coincide con la lectura fisica registrada."
    : isReplay
    ? "Replay detectado: esta URL/SUN ya fue usada. Garantia, rewards y tokenizacion quedan bloqueados hasta un nuevo tap fisico."
    : isSnapshotView
      ? "Consulta segura: la prueba queda disponible para revisar y compartir. Para sumar puntos, activar garantia o mintear, toca otra vez la etiqueta."
    : isValid
      ? rightsSummary || (isCryptoCarrier
        ? "Lectura fresca: UID, contador SUN y CMAC pasan la politica anti-replay."
        : "Lectura fresca: identidad registrada y trazabilidad declarada por plataforma.")
      : isVerifiedOpenedState && isTechnicallyAuthentic
        ? rightsSummary || "Autenticidad confirmada. El sello de la botella ya fue abierto (descorchado). Podés registrar la botella como tuya, sumar puntos y acceder al club de beneficios."
        : rightsSummary || "Lectura de control: la verificación técnica de autenticidad se mantiene activa, pero se restringen algunas acciones comerciales.";
  const tokenEvidenceLabel = hasOnChainProof
    ? `On-chain ${tokenNetwork}`
    : tokenPending
      ? "Polygon en cola"
      : tokenFailed
        ? "Mint requiere revision"
        : tokenBlocked
      ? "Bloqueada por politica del tap"
          : normalizedTokenStatus.includes("sandbox") || normalizedTokenStatus.includes("simulated")
            ? "Sandbox, sin promesa on-chain"
            : "Sin anclaje on-chain";
  const sealLabel = sealClosed ? "Sello intacto" : sealOpened ? "Sello abierto" : "Sello no informado";
  const chainLabel = tokenEvidenceLabel;
  const productName = result.product?.name || "Producto Verificado";
  const productImageUrl = result.product?.imageUrl || result.product?.image_url || result.product?.photoUrl || result.product?.photo_url || null;
  const productMedia = (result.product?.media && typeof result.product.media === "object" ? result.product.media : {}) as Record<string, unknown>;
  const productGalleryUrls = Array.isArray(productMedia.galleryUrls)
    ? productMedia.galleryUrls.map((item) => String(item || "").trim()).filter(Boolean)
    : Array.isArray(productMedia.gallery_urls)
      ? productMedia.gallery_urls.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  const requestedBrandDisplay = readParam(params, "winery") || readParam(params, "brand") || "";
  const assetProfile = resolveProductAssetProfile({
    tenantSlug: result.tenant?.slug || result.identity?.tenantSlug,
    brandName: requestedBrandDisplay || result.product?.winery || result.tenant?.name || result.tenant?.slug,
    productName,
    bid: result.identity?.bid,
    vertical: result.product?.vertical || result.rightsPolicy?.vertical || verticalLabel,
    category: result.product?.category || result.rightsPolicy?.category,
    imageUrl: productImageUrl,
    labelImageUrl: String(productMedia.labelImageUrl || productMedia.label_image_url || ""),
    modelUrl: String(productMedia.modelUrl || productMedia.model_url || productMedia.glbUrl || productMedia.glb_url || ""),
    galleryUrls: productGalleryUrls,
    sku: result.product?.sku || result.product?.gtin,
  });
  const assetReadinessLabel = summarizeAssetReadiness(assetProfile);
  const productVisualKind = (assetProfile.visualKind || resolveSunVisualKind(result)) as SunVisualKind;
  const productDisplayName = assetProfile.productName || productName;
  const engagementWineryName = requestedBrandDisplay || result.product?.winery || "Bodega Premium";
  const engagementTenantSlug = readParam(params, "tenant") || tenantSlug || "demobodega";
  const productHeroImageUrl = assetProfile.primaryImageUrl || productImageUrl;
  const productVisualState = (isReplay || isRiskBlocked)
    ? "blocked"
    : (sealOpened || isVerifiedOpenedState)
      ? "opened"
      : "idle";
  const trustCopy = isSunProfileMismatch
    ? "La prueba se conserva y cualquier lector ve producto, bodega, lote y trazabilidad. Garantia, club, marketplace y NFT esperan el perfil SUN correcto o el payload fisico registrado."
    : isReplay
    ? "Anti-replay activo: el tap queda como evidencia, no como permiso comercial."
    : isSnapshotView
      ? "Consulta segura: autenticidad visible y trazabilidad preservada. Las acciones comerciales requieren otro tap fisico."
    : isFreshHandoff
      ? "Lectura fisica recien validada: ficha publica, ruta y opciones opt-in disponibles mientras el handoff sigue fresco."
    : isVerifiedOpenedState && isTechnicallyAuthentic
      ? "Apertura verificada: el sello cambio de estado, pero la identidad SUN sigue siendo valida y accionable."
    : isFreshCommercialTap
      ? "Lectura fresca, identidad consistente y lote activo."
    : trustScore >= 65
      ? "Lectura revisable: conviene mirar ruta y estado del sello antes de activar beneficios."
      : "Lectura de riesgo: no habilitamos acciones sensibles hasta repetir el tap.";
  const effectiveTrustCopy = !isReplay && !isSnapshotView && rightsSummary ? rightsSummary : trustCopy;
  const rightsModeCards = [
    { label: "Rubro", value: verticalLabel },
    { label: "Ownership", value: claimModeLabel },
    { label: "Token", value: tokenPolicyLabel },
    { label: "Marketplace", value: marketplaceModeLabel },
  ];
  const rightsRequirementsPreview = rightsRequirements.slice(0, 4);
  const handoffCopy = isQrScan
    ? "Ficha QR: contenido y CRM, sin propiedad automatica."
    : isFreshHandoff
    ? "Tap fisico fresco: acciones habilitadas con prueba SUN y token temporal."
    : isSnapshotView
    ? "Consulta segura: prueba visible, acciones comerciales bloqueadas."
    : isDemoPreview
      ? "Vista demo del passport SUN para probar el flujo sin etiqueta fisica."
      : "Validacion directa desde parametros SUN.";
  const carrierEducation = [
    { code: "qr_basic", name: "QR comun", mode: "Contenido", body: "Abre una URL para contenido, leads, marketplace y analytics. Bajo costo, pero puede copiarse con una foto." },
    { code: "gs1_digital_link", name: "QR GS1 Digital Link", mode: "Retail", body: "GTIN, lote, serie y vencimiento para retail/exportacion. Profesionaliza trazabilidad, no es anti-clon por si solo." },
    { code: "ntag213", name: "NTAG213", mode: "Tap web", body: "NFC economico para tap-to-web, garantias basicas y medicion. Sin SUN dinamico." },
    { code: "ntag215", name: "NTAG215", mode: "UID", body: "UID + reglas server-side para eventos, credenciales y productos de valor medio. No es cripto premium." },
    { code: "ntag216", name: "NTAG216", mode: "Memoria", body: "Mas memoria para journeys, payload local y activaciones con control operativo." },
    { code: "ntag424_dna", name: "NTAG 424 DNA", mode: "SUN/SDM", body: "Cada tap genera datos dinamicos verificables contra replay, clones y URLs reutilizadas." },
    { code: "ntag424_dna_tt", name: "424 DNA TT", mode: "Tamper", body: "Suma estado fisico del sello: cerrado, abierto o no inicializado para botellas y packaging premium." },
    { name: "QR comun", mode: "Contenido", body: "Abre una URL y sirve para campañas simples. Es barato, pero se puede copiar o reenviar." },
    { name: "NTAG215", mode: "Tap UX", body: "Mejora velocidad y serializacion para eventos, credenciales y activaciones con reglas server-side." },
    { name: "NTAG 424 DNA", mode: "SUN/SDM", body: "Cada tap genera datos dinamicos verificables contra replay, clones y URLs reutilizadas." },
    { name: "424 DNA TT", mode: "Tamper", body: "Suma estado fisico del sello: cerrado, abierto o no inicializado para botellas y packaging premium." },
  ];
  const activeCarrierIndex = rawCarrierProfileCode === "ntag424_dna_tt"
    ? 6
    : rawCarrierProfileCode === "ntag424_dna"
      ? 5
      : rawCarrierProfileCode === "ntag216"
        ? 4
        : rawCarrierProfileCode === "ntag215"
          ? 3
          : rawCarrierProfileCode === "ntag213"
            ? 2
            : rawCarrierProfileCode === "gs1_digital_link"
              ? 1
        : isTamperCarrier
          ? 6
        : isCryptoCarrier
            ? 5
            : 0;

  const tenantDisplayName = requestedBrandDisplay || result.tenant?.name || result.product?.winery || result.tenant?.slug || result.identity?.tenantSlug || "Bodega Premium";
  const batchDisplay = bid || result.identity?.bid || "Batch activo";
  const productLine = [result.product?.region, result.product?.varietal || result.product?.category || verticalLabel]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" · ");
  const visibleUid = uidMasked || (uid ? `${uid.slice(0, 4)}****${uid.slice(-4)}` : "UID protegido");
  const productFirstTone = isQrScan
    ? "visible"
    : isFreshCommercialTap
    ? "ready"
    : isSunProfileMismatch
      ? "setup"
      : isRiskBlocked
        ? "review"
        : "visible";
  const productFirstStatusTitle = isQrScan
    ? "Ficha QR del producto"
    : isFreshCommercialTap
    ? "Ficha del producto lista"
    : isSunProfileMismatch
      ? "Producto y lote identificados"
      : isRiskBlocked
        ? "Producto visible, acciones protegidas"
        : "Producto autentico";
  const productFirstStatusBody = isQrScan
    ? "Canal de bajo costo para informar, captar leads, medir interes y activar fidelizacion. No prueba autenticidad criptografica NFC ni activa propiedad automaticamente."
    : isFreshCommercialTap
    ? "La lectura esta fresca: podes ver producto, bodega, lote, ruta y certificado sin registrarte. Contacto, club o garantia son opt-in."
    : isSunProfileMismatch
      ? "La bodega, el producto y el batch existen. La prueba queda visible, pero club, garantia, marketplace y NFT siguen protegidos hasta cargar el perfil SUN correcto o registrar el payload fisico del proveedor."
      : isRiskBlocked
        ? "Mostramos el producto y la trazabilidad disponible, pero pedimos otro tap fisico antes de habilitar acciones comerciales."
        : "La prueba se puede compartir y revisar. Para activar beneficios sensibles, usa un tap fresco desde la etiqueta fisica.";
  const productFirstSpecs = [
    { label: "Tenant", value: tenantDisplayName },
    { label: "Producto", value: productDisplayName },
    { label: "Lote", value: batchDisplay },
    { label: isQrScan ? "Canal" : "Chip", value: carrierLabel },
    { label: "UID", value: visibleUid },
    { label: "Origen", value: originDisplay },
    { label: "Tap", value: tapDisplay },
    { label: "Distancia", value: distanceDisplay },
  ].filter((item) => item.value);
  const productFirstBadges = [
    isQrScan ? "Ficha QR" : "Producto real",
    batchDisplay,
    carrierLabel,
    isQrScan ? "Sin propiedad automatica" : isFreshCommercialTap ? "Ficha abierta" : "Acciones protegidas",
  ].filter(Boolean);

  const friendlyStageTitle = isQrScan
    ? "Ficha publica del producto"
    : isSunProfileMismatch
    ? "Activacion pendiente del batch"
    : isRiskBlocked
    ? "Necesitamos un nuevo tap fisico"
    : isSnapshotView
      ? "Consulta segura del producto"
      : isVerifiedOpenedState
        ? "Producto autentico. Sello abierto"
        : "Producto autentico";
  const friendlyStageBody = isQrScan
    ? "El QR permite leer informacion, hablar con el sommelier IA, dejar feedback o contacto opcional. Garantia, wallet, NFT y propiedad exigen compra validada o tap NFC seguro."
    : isSunProfileMismatch
    ? "El producto se muestra porque la bodega y el lote estan reconocidos. Para habilitar club, garantia, marketplace o NFT falta alinear el perfil SUN del lote o registrar el payload real del proveedor."
    : isRiskBlocked
    ? "Vemos la prueba, pero no habilitamos garantia, club ni NFT con una lectura sospechosa o repetida."
    : isSnapshotView
      ? "La autenticidad y la ruta se pueden revisar. Para activar beneficios sensibles, toca de nuevo la etiqueta."
      : isVerifiedOpenedState
        ? "El producto es real y la apertura quedo registrada. Podés leer la ficha; asociarlo a una cuenta es opcional y separado."
        : "La lectura es fresca. Primero lees la ficha; si queres, despues dejas contacto o acreditas compra.";
  const primaryPostTapAction = isQrScan
    ? { label: "Abrir sommelier IA", href: "#qr-engagement", tone: "trace" }
    : isSunProfileMismatch
    ? { label: "Avisar a soporte", href: reportProblemHref, tone: "trace" }
    : isFreshCommercialTap
      ? { label: "Ver trivia y beneficios", href: showEngagementSuite ? "#qr-engagement" : "#consumer-choice", tone: "trace" }
      : isSnapshotView
        ? { label: "Hacer nuevo tap fisico", href: "#fresh-tap-required", tone: "fresh" }
        : isRiskBlocked
          ? { label: "Reintentar tap fisico", href: reportProblemHref, tone: "risk" }
          : { label: "Ver ruta de confianza", href: "#geo-trace", tone: "trace" };
  const simpleJourneySteps = [
    {
      label: isQrScan ? "Producto informado" : "Producto autentico",
      detail: isQrScan ? "QR / SDK" : isSunProfileMismatch ? "Batch detectado" : isTechnicallyAuthentic ? "Verificado" : "En revision",
      state: isQrScan ? "done" : isSunProfileMismatch ? "warn" : isTechnicallyAuthentic ? "done" : "warn",
    },
    {
      label: isQrScan ? "Origen declarado" : "Origen visible",
      detail: originToTapDistance != null ? distanceDisplay : "Sin geo",
      state: originToTapDistance != null ? "done" : "warn",
    },
    {
      label: "Contacto opcional",
      detail: isQrScan ? "Opt-in" : isFreshCommercialTap ? "Disponible" : "Nuevo tap",
      state: isQrScan ? "ready" : isFreshCommercialTap ? "ready" : "locked",
    },
    {
      label: "Comprador verificado",
      detail: isSunProfileMismatch ? "Bloqueado" : isFreshCommercialTap ? "Con prueba" : "Protegido",
      state: isFreshCommercialTap ? "ready" : "locked",
    },
  ];
  const friendlyTrustFactors = isQrScan
    ? [
      { label: "Ficha abierta", ok: true },
      { label: "Tenant identificado", ok: Boolean(tenantSlug) },
      { label: "Lote informado", ok: Boolean(batchDisplay) },
      { label: "Lead opt-in", ok: true },
      { label: "Propiedad protegida", ok: true },
      { label: "NFC premium pendiente", ok: false },
    ]
    : [
      { label: "Tap fresco", ok: isFreshCommercialTap },
      { label: "Perfil SUN correcto", ok: !isSunProfileMismatch },
      { label: "Chip valido", ok: isTechnicallyAuthentic },
      { label: "Sello coherente", ok: !isTamperRisk },
      { label: "Ruta razonable", ok: originToTapDistance != null },
      { label: "Riesgo bajo", ok: !isRiskBlocked && trustScore >= 65 },
    ];
  const passportStorySteps = [
    {
      label: "Nacio",
      title: result.product?.region || result.provenance?.origin || "Origen registrado",
      body: "La marca cargo lote, producto y reglas antes de salir al canal.",
    },
    {
      label: "Viajo",
      title: `${originDisplay} -> ${tapDisplay}`,
      body: `${distanceDisplay} de ruta de confianza entre origen y tap actual.`,
    },
    {
      label: isQrScan ? "Se consulto" : "Se verifico",
      title: isQrScan ? "Ficha QR abierta" : isTechnicallyAuthentic ? "Producto real" : "Lectura en revision",
      body: isQrScan ? "La marca recibe telemetria, ubicacion aproximada y senales de interes sin exigir registro." : isTechnicallyAuthentic ? "El chip y la politica del tenant sostienen la autenticidad." : "El sistema conserva evidencia, pero protege acciones sensibles.",
    },
    {
      label: "Ahora",
      title: isQrScan ? "Siguiente paso opcional" : isFreshCommercialTap ? "Ficha publica abierta" : "Acciones protegidas",
      body: isQrScan ? "Si la persona compro, puede verificar compra o tocar NFC seguro. Si solo esta mirando en gondola, puede leer sin reclamar nada." : isFreshCommercialTap ? "El lector puede informarse sin registrarse. Si compro, activa garantia o beneficios con prueba separada." : "Repeti el tap fisico para activar garantia, beneficios o certificado.",
    },
  ];


  return (
    <main className="min-h-screen bg-[#060813] text-slate-100 flex flex-col items-center py-4 sm:py-8 px-4 font-sans relative overflow-hidden pb-32">
      <FreshHandoffUrlCleaner enabled={Boolean(isFreshHandoff && freshToken)} />
      
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[500px] bg-gradient-to-b from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Telemetry data collection component */}
      <TapPrecisionTelemetry
        endpoint={telemetryEndpoint}
        enabled={!isQrScan && !isSnapshotView && Boolean(eventId)}
        bid={bid}
        uid={uid || null}
        eventId={eventId || null}
        readCounter={typeof result.identity?.readCounter === "number" ? result.identity.readCounter : null}
        contextStatus={result.status?.code || null}
      />

      <div className="w-full max-w-[430px] z-10 space-y-5 mx-auto">
        
        {/* Modern minimal top bar */}
        <header className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-2">
            <BrandLockup size={36} variant="ripple" theme="dark" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {isQrScan ? "qr passport" : "nfc passport"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher value={locale} options={locales as any} />
            <ThemeToggle />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/5 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${pulseClass} animate-pulse`} />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">{livePillLabel}</span>
            </div>
          </div>
        </header>

        {/* 1. Main Authenticity Banner (Glassmorphism & Glowing border) */}
        <section 
          className={`relative rounded-3xl border border-white/10 p-6 backdrop-blur-2xl shadow-2xl overflow-hidden bg-gradient-to-br ${
            isValid 
              ? "from-emerald-950/40 via-slate-900/60 to-emerald-950/20 shadow-emerald-950/20" 
              : isVerifiedOpenedState && isTechnicallyAuthentic
                ? "from-amber-950/40 via-slate-900/60 to-amber-950/20 shadow-amber-950/20"
                : isSunProfileMismatch
                  ? "from-amber-950/40 via-slate-900/60 to-amber-950/20 shadow-amber-950/20"
                  : "from-rose-950/40 via-slate-900/60 to-rose-950/20 shadow-rose-950/20"
          }`}
        >
          {/* Status color glow */}
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-25 pointer-events-none ${
            isValid 
              ? "bg-emerald-500" 
              : isVerifiedOpenedState && isTechnicallyAuthentic
                ? "bg-amber-500"
                : isSunProfileMismatch
                  ? "bg-amber-500"
                  : "bg-rose-500"
          }`} />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Massive status icon */}
            <div className="relative mb-4">
              <div className={`w-20 h-20 rounded-full border-4 border-slate-900 flex items-center justify-center text-3xl shadow-inner relative z-10 ${
                isValid 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : isVerifiedOpenedState && isTechnicallyAuthentic
                    ? "bg-amber-500/10 text-amber-400"
                    : isSunProfileMismatch
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-rose-500/10 text-rose-400"
              }`}>
                {isValid ? "✓" : isVerifiedOpenedState && isTechnicallyAuthentic ? "⚠️" : isSunProfileMismatch ? "⚠️" : "❌"}
              </div>
              <div className={`absolute -inset-1 rounded-full blur-md opacity-30 ${
                isValid 
                  ? "bg-emerald-500 animate-pulse" 
                  : isVerifiedOpenedState && isTechnicallyAuthentic
                    ? "bg-amber-500"
                    : isSunProfileMismatch
                      ? "bg-amber-500"
                      : "bg-rose-500"
              }`} />
            </div>

            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${
              isValid
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : isVerifiedOpenedState && isTechnicallyAuthentic
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                  : isSunProfileMismatch
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                    : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            }`}>
              {isQrScan
                ? "QR / Ficha Informativa"
                : isValid
                  ? "AUTÉNTICO & INTACTO"
                  : isVerifiedOpenedState && isTechnicallyAuthentic
                    ? "AUTÉNTICO & SELLO ABIERTO"
                    : isReplay
                      ? "REPLAY / ENLACE REUTILIZADO"
                      : isSunProfileMismatch
                        ? "PERFIL DESALINEADO"
                        : "ALERTA DE SEGURIDAD"}
            </span>

            <h2 className="text-lg font-black text-white leading-snug tracking-tight mb-2">
              {displayStatusHeadline}
            </h2>
            <p className="text-xs text-slate-300 max-w-[340px] leading-relaxed">
              {replayDecisionText}
            </p>

            {/* Quick status dots for mobile */}
            <div className="mt-4 w-full border-t border-white/5 pt-4 grid grid-cols-3 gap-2">
              <div className="text-center">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Chip NFC</span>
                <span className="text-[11px] font-bold text-slate-300 mt-0.5 block">{carrierLabel}</span>
              </div>
              <div className="text-center border-x border-white/5">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Sello Físico</span>
                <span className={`text-[11px] font-bold mt-0.5 block ${sealClosed ? "text-emerald-400" : "text-amber-400"}`}>{sealLabel}</span>
              </div>
              <div className="text-center">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Confianza</span>
                <span className={`text-[11px] font-bold mt-0.5 block ${trustTone}`}>{trustScore}/100</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Premium Product Profile Card */}
        <section id="product-info" className="rounded-3xl border border-white/5 bg-slate-950 p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col items-center">
            
            {/* Floating Premium Image */}
            <div className="w-full h-64 relative mb-4 rounded-2xl overflow-hidden bg-slate-900/30 flex items-center justify-center">
              {productHeroImageUrl ? (
                <img 
                  src={productHeroImageUrl} 
                  alt={productDisplayName}
                  className="max-h-full max-w-full object-contain transform hover:scale-[1.05] transition-transform duration-500" 
                />
              ) : (
                <SunProductHeroStage
                  kind={productVisualKind}
                  productName={productDisplayName}
                  imageUrl={productHeroImageUrl}
                  originDisplay={originDisplay}
                  tapDisplay={tapDisplay}
                  distanceDisplay={distanceDisplay}
                  state={productVisualState}
                  originLat={wineryPoint[0]?.lat}
                  originLng={wineryPoint[0]?.lng}
                  tapLat={currentTapPoint[0]?.lat}
                  tapLng={currentTapPoint[0]?.lng}
                />
              )}
            </div>

            <div className="text-center w-full">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
                {tenantDisplayName}
              </span>
              <h1 className="text-2xl font-black text-white leading-tight mt-1 tracking-tight">
                {productDisplayName}
              </h1>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                {productLine || verticalLabel}
              </p>
            </div>

            {/* Spec grid for fast reading */}
            <div className="w-full mt-5 bg-slate-900/40 rounded-2xl border border-white/5 p-4 grid grid-cols-2 gap-3 text-left">
              <div>
                <span className="text-[9px] uppercase text-slate-500 block">Lote / Batch</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">{batchDisplay}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-slate-500 block">UID del Tag</span>
                <span className="text-xs font-mono text-slate-200 mt-0.5 block">{visibleUid}</span>
              </div>
              <div className="border-t border-white/5 pt-2.5">
                <span className="text-[9px] uppercase text-slate-500 block">Origen</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">{originDisplay}</span>
              </div>
              <div className="border-t border-white/5 pt-2.5">
                <span className="text-[9px] uppercase text-slate-500 block">Lectura</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">{tapDisplay}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Core Action Buttons (Authena/Qliktag Style - Large, Touch-Friendly) */}
        <section id="consumer-choice" className="space-y-3">
          
          {/* Main Action Block: Claim/Warranty/Rewards */}
          {isFreshCommercialTap ? (
            <div className="grid grid-cols-1 gap-2.5">
              
              {/* Option to claim / verify purchase */}
              <Link 
                href={registerHref} 
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-[1.01] transition-transform active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5" />
                  <div className="text-left">
                    <span className="block font-black leading-none text-slate-950">Registrar Propiedad / Garantía</span>
                    <span className="text-[10px] font-medium text-slate-900 mt-0.5 block">Activar beneficios y comprobar compra</span>
                  </div>
                </div>
                <span className="text-lg">➔</span>
              </Link>

              {/* Option to join loyalty club */}
              <Link 
                href={rewardsHref} 
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-slate-900 border border-white/10 text-white font-bold text-sm shadow-md hover:scale-[1.01] transition-transform active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌟</span>
                  <div className="text-left">
                    <span className="block font-black leading-none text-white">Unirse al Club de la Marca</span>
                    <span className="text-[10px] font-normal text-slate-400 mt-0.5 block">Sumar 10 puntos de bienvenida</span>
                  </div>
                </div>
                <span className="text-lg text-slate-400">➔</span>
              </Link>

              {/* Option to view brand catalog / marketplace */}
              <Link 
                href={tapMarketplaceHref} 
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-slate-900 border border-white/10 text-white font-bold text-sm shadow-md hover:scale-[1.01] transition-transform active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <Store className="h-5 w-5 text-amber-400" />
                  <div className="text-left">
                    <span className="block font-black leading-none text-white">Ver más productos de la marca</span>
                    <span className="text-[10px] font-normal text-slate-400 mt-0.5 block">Explorar colección y promociones</span>
                  </div>
                </div>
                <span className="text-lg text-slate-400">➔</span>
              </Link>

              {/* Option to view public certificate */}
              {certificateHref && (
                <Link 
                  href={certificateHref} 
                  className="flex items-center justify-between w-full p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-sm shadow-md hover:scale-[1.01] transition-transform active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📜</span>
                    <div className="text-left">
                      <span className="block font-black leading-none text-purple-200">Ver Certificado Digital</span>
                      <span className="text-[10px] font-normal text-purple-400 mt-0.5 block">Comprobar autenticidad en blockchain</span>
                    </div>
                  </div>
                  <span className="text-lg text-purple-400">➔</span>
                </Link>
              )}

              {/* Wallet/MetaMask integrations */}
              <Link 
                href={walletHref} 
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-slate-900 border border-white/10 text-white font-bold text-sm shadow-md hover:scale-[1.01] transition-transform active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <WalletCards className="h-5 w-5 text-indigo-400" />
                  <div className="text-left">
                    <span className="block font-black leading-none text-white">Conectar Wallet Web3</span>
                    <span className="text-[10px] font-normal text-slate-400 mt-0.5 block">Ver tokens digitales y sandbox</span>
                  </div>
                </div>
                <span className="text-lg text-slate-400">➔</span>
              </Link>

            </div>
          ) : (
            // Disabled state with clear message
            <div className={`p-5 rounded-2xl border text-center ${protectedBannerClass}`}>
              <h3 className="text-sm font-bold text-white mb-1.5">{protectedBannerTitle}</h3>
              <p className="text-xs opacity-85 mb-3">{protectedBannerCopy}</p>
              {isSnapshotView ? (
                <a href="#fresh-tap-required" className="block w-full py-3 rounded-xl bg-sky-500/10 border border-sky-500/25 hover:bg-sky-500/20 text-sky-200 text-xs font-bold transition-all">
                  Escanear etiqueta física nuevamente
                </a>
              ) : (
                <Link href={reportProblemHref} className="block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors">
                  Reportar problema / Avisar a soporte
                </Link>
              )}
            </div>
          )}

          {/* Secure CTAs actions integration */}
          {bid && (uid || eventId) && (
            <div className="pt-1">
              <CtaActions
                bid={bid}
                uid={uid}
                eventId={eventId}
                freshToken={freshToken}
                canExecute={isFreshCommercialTap}
                tapState={isSnapshotView || isRiskBlocked ? "blocked" : isVerifiedOpenedState ? "opened" : "valid"}
                rightsPolicy={result.rightsPolicy || result.condition}
              />
            </div>
          )}

          {/* Sommelier and trivia for QR or verified NFC taps */}
          {showEngagementSuite && (
            <div id="qr-engagement">
              <QREngagementSuite
                wineryName={engagementWineryName}
                productName={productDisplayName}
                tenantSlug={engagementTenantSlug}
                eventId={eventId || null}
                bid={bid || null}
              />
            </div>
          )}

          {canAutoOnboard && (
            <div className="pt-2">
              <OnboardDemoButton bid={bid} />
            </div>
          )}
        </section>

        {/* 4. Traceability, Map & Cold Chain history */}
        <section className="rounded-3xl border border-white/5 bg-slate-900/30 p-5 backdrop-blur-md shadow-lg space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
              Trazabilidad e Inteligencia
            </span>
            <h3 className="text-base font-black text-white mt-1">Ruta de Confianza & Origen</h3>
          </div>

          {/* Interactive OpsMap */}
          <div id="geo-trace" className="rounded-2xl overflow-hidden border border-white/5 bg-slate-950 p-2 shadow-inner">
            {opsMapPoints.length ? (
              <GlobalOpsMap
                title="Ruta del Producto"
                subtitle="Origen, tap y recorrido del producto"
                points={opsMapPoints}
                routes={opsMapRoutes}
                mode="demo"
                selectedPointId={opsMapPoints.find((point) => point.role === "tap")?.id || opsMapPoints[0]?.id}
                playbackEnabled
              />
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Sin coordenadas de geolocalización para este tap.
              </div>
            )}
          </div>

          {/* Quick Trace Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 rounded-xl border border-white/5 p-2">
              <span className="text-[8px] uppercase text-slate-500 block">Eventos</span>
              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{timelineCount}</span>
            </div>
            <div className="bg-slate-950/60 rounded-xl border border-white/5 p-2">
              <span className="text-[8px] uppercase text-slate-500 block">Distancia</span>
              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{fmtDistance(originToTapDistance)}</span>
            </div>
            <div className="bg-slate-950/60 rounded-xl border border-white/5 p-2">
              <span className="text-[8px] uppercase text-slate-500 block">Último Tap</span>
              <span className="text-[10px] font-bold text-slate-200 mt-0.5 block truncate">{localTapTimeLabel || "N/A"}</span>
            </div>
          </div>

          {/* Cold Chain Monitoreo IoT (Premium redrawn line) */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900/90 rounded-2xl border border-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-[8px] uppercase tracking-wider text-amber-300 font-bold">Monitoreo IoT en Tránsito</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5 block">Historial de Temperatura</span>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ESTABLE ({dynamicTemp})
              </span>
            </div>

            {/* Sparkline chart SVG */}
            <div className="h-16 w-full relative">
              <svg className="w-full h-full" viewBox="0 0 300 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sensorGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 60 Q 50 20, 100 24 T 200 18 T 300 15 L 300 60 L 0 60 Z" fill="url(#sensorGrad)" />
                <path d="M0 45 Q 50 20, 100 24 T 200 18 T 300 15" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="0" y1="35" x2="300" y2="35" stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
              </svg>
              <div className="absolute right-2 top-0.5 rounded bg-amber-500 px-1 py-0.5 text-[8px] font-black text-slate-950">
                {dynamicTemp}
              </div>
            </div>

            <div className="flex justify-between text-[9px] text-slate-500">
              <span>Humedad: {dynamicHumidity}</span>
              <span>G-Force: {dynamicShock}</span>
            </div>
          </div>

          {/* Cata y Maridaje section (For Wine vertical) */}
          {(result.product?.vertical === "wine" || result.tenant?.vertical === "wine" || productDisplayName.toLowerCase().includes("wine") || productDisplayName.toLowerCase().includes("malbec") || productDisplayName.toLowerCase().includes("reserva")) && (
            <div className="bg-slate-950/40 rounded-2xl border border-white/5 p-4 text-xs space-y-4">
              <div className="space-y-1">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Detalle del Sommelier</span>
                <p className="text-slate-300 italic">
                  "{dynamicTastingNotes}"
                </p>
                <p className="text-[10px] text-amber-300 font-medium pt-1">
                  🍷 Maridaje: {dynamicMaridaje}
                </p>
              </div>

              {/* Perfil Sensorial */}
              <div className="space-y-2.5 pt-3 border-t border-white/5">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Perfil Sensorial</span>
                <div className="space-y-2.5">
                  {[
                    { label: "Cuerpo / Intensidad", val: 85, desc: "Intenso y estructurado" },
                    { label: "Taninos", val: 70, desc: "Sedosos y redondos" },
                    { label: "Acidez", val: 60, desc: "Fresca y equilibrada" },
                    { label: "Roble Francés", val: 75, desc: "12 meses de crianza" },
                    { label: "Fruta Negra", val: 90, desc: "Mora y ciruela madura" },
                  ].map((attr) => (
                    <div key={attr.label} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-medium text-slate-300">
                        <span>{attr.label}</span>
                        <span className="text-slate-500 text-[9px]">{attr.desc}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                          style={{ width: `${attr.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premios y Distinciones */}
              <div className="space-y-2.5 pt-3 border-t border-white/5">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Premios y Sellos</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 text-center flex flex-col justify-center items-center gap-0.5 hover:border-amber-500/40 hover:bg-amber-500/10 transition duration-300">
                    <span className="text-[13px] font-black text-amber-300">95 Pts</span>
                    <span className="text-[7px] text-slate-400 uppercase font-bold tracking-wider leading-none">James Suckling</span>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 text-center flex flex-col justify-center items-center gap-0.5 hover:border-amber-500/40 hover:bg-amber-500/10 transition duration-300">
                    <span className="text-[13px] font-black text-amber-300">Oro</span>
                    <span className="text-[7px] text-slate-400 uppercase font-bold tracking-wider leading-none">Decanter Awards</span>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2 text-center flex flex-col justify-center items-center gap-0.5 hover:border-amber-500/40 hover:bg-amber-500/10 transition duration-300">
                    <span className="text-[11px] font-black text-amber-300">Valle de Uco</span>
                    <span className="text-[7px] text-slate-400 uppercase font-bold tracking-wider leading-none">Origen Certificado</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline points list */}
          <div className="space-y-3 pt-2">
            <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Bitácora de Eventos</span>
            <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-[5px] before:w-[2px] before:bg-slate-800">
              {passportStorySteps.map((step, idx) => (
                <div key={step.label} className="relative text-xs">
                  <div className={`absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${idx === 3 ? pulseClass : "bg-slate-700"}`} />
                  <span className="block text-[9px] font-mono text-slate-500">{step.label}</span>
                  <span className="block font-bold text-slate-200 mt-0.5">{step.title}</span>
                  <p className="text-slate-400 mt-0.5 leading-normal text-[11px]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Technical Specifications (Accordion) */}
        <section>
          <details className="group border border-white/5 rounded-3xl bg-slate-900/20 backdrop-blur-md overflow-hidden transition-all duration-300">
            <summary className="flex items-center justify-between p-5 cursor-pointer font-bold text-xs text-slate-400 uppercase tracking-widest hover:text-slate-200 select-none">
              <span>Especificaciones Técnicas & Cripto</span>
              <span className="transition-transform group-open:rotate-180 duration-300 text-sm">▼</span>
            </summary>
            
            <div className="p-5 pt-0 space-y-4 text-xs border-t border-white/5 bg-slate-950/40">
              
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">UID Físico del Chip</span>
                  <span className="font-mono text-slate-200">{result.identity?.uid || "Oculto / No disponible"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Lote (Batch ID)</span>
                  <span className="font-mono text-slate-200">{bid || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Contador de Lecturas</span>
                  <span className="font-mono text-slate-200">{result.identity?.readCounter ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Firma Criptográfica CMAC</span>
                  <span className="font-mono text-slate-200">{result.technical?.raw?.cmacPrefix || "verificada"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Registro Blockchain</span>
                  <span className="font-semibold text-slate-200">{tokenEvidenceLabel}</span>
                </div>
                {hasOnChainTx && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Hash de Transacción</span>
                    <a 
                      href={tokenExplorerHref} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-cyan-400 font-mono underline hover:text-cyan-300"
                    >
                      {tokenTx.substring(0, 12)}...
                    </a>
                  </div>
                )}
              </div>

              {carrierConsumerCopy && (
                <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 leading-normal text-cyan-200/90 text-[11px]">
                  {carrierConsumerCopy}
                </div>
              )}
            </div>
          </details>
        </section>

      </div>

      {/* Floating sommelier trigger for mobile */}
      {showEngagementSuite && (
        <a 
          href="#qr-engagement" 
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-xs font-black text-white shadow-lg hover:bg-violet-500 active:scale-95 transition-all lg:hidden"
        >
          <span>💬</span> Sommelier IA
        </a>
      )}

      {/* Fixed Bottom Quick Nav Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-3 z-30 lg:hidden">
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-slate-950/80 p-2 backdrop-blur-xl shadow-xl">
          <a href="#product-info" className="flex flex-col items-center justify-center py-1.5 rounded-xl hover:bg-white/5 text-slate-300">
            <span className="text-xs">🍷</span>
            <span className="text-[8px] font-bold mt-0.5">Ficha</span>
          </a>
          <a href={showEngagementSuite ? "#qr-engagement" : "#geo-trace"} className="flex flex-col items-center justify-center py-1.5 rounded-xl hover:bg-white/5 text-slate-300">
            <span className="text-xs">📍</span>
            <span className="text-[8px] font-bold mt-0.5">Ruta</span>
          </a>
          <Link href={tapMarketplaceHref} className="flex flex-col items-center justify-center py-1.5 rounded-xl hover:bg-white/5 text-slate-300">
            <span className="text-xs">🛒</span>
            <span className="text-[8px] font-bold mt-0.5">Comprar</span>
          </Link>
          <a href={showEngagementSuite ? "#qr-engagement" : "#consumer-choice"} className="flex flex-col items-center justify-center py-1.5 rounded-xl hover:bg-white/5 text-slate-300">
            <span className="text-xs">🔒</span>
            <span className="text-[8px] font-bold mt-0.5">Acciones</span>
          </a>
        </div>
      </nav>
    </main>
  );
}
