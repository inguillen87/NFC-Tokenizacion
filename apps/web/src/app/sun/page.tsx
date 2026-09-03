import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowLeft, ChevronRight, MapPin, MessageCircle, Package, PackageCheck, PackageOpen, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { CtaActions } from "./cta-actions";
import { FreshHandoffUrlCleaner } from "./fresh-handoff-url-cleaner";
import { SunProductHeroStage, type SunVisualKind } from "./sun-product-hero-stage";
import { SunPassportHeader } from "./sun-passport-header";
import { SunLocaleProvider } from "./sun-locale-provider";
import { formatSunDateTime, translateSunUiText, type SunLocale } from "./sun-locale";
import { QREngagementSuite } from "./qr-engagement-suite";
import { PostTapNextStep } from "./post-tap-next-step";
import { SunSectionNav } from "./sun-section-nav";
import { SunServicesHub, type SunPublishedPromotion } from "./sun-services-hub";
import { SunLocationExperience } from "./sun-location-experience";
import type { SunPassportMapLocation } from "./sun-passport-map";
import { SunUpdatesOptIn } from "./sun-updates-opt-in";
import { resolveSunConsumerStatus } from "./sun-consumer-status";
import { OfflinePublicProductCache } from "./offline-public-product-cache";
import { AgroDppExperience } from "./agro-dpp-experience";
import { normalizeAgroDppProfile } from "./agro-dpp-model";
import { resolveCommercialTapFreshness, resolvePostTapQuickActionAvailability } from "./post-tap-policy";
import { fmtDistance, haversineKm } from "./sun-route-distance";
import { resolveSunTtEvidence, type SunTtTechnicalInput } from "./sun-tt-evidence";
import { selectSunTruthCopy, SUN_DEMO_BADGE, SUN_DEMO_COPY } from "./sun-truth-copy";
import { productUrls } from "@product/config";
import { DeviceSignatureBadge, EmptyState, KeyValueSpec, TimelineRail } from "@product/ui";
import { getWebI18n } from "../../lib/locale";
import { resolveProductAssetProfile } from "../../lib/product-asset-bank";
import {
  resolveDemoExperienceAction,
  resolveDemoProductProfile,
} from "../../lib/demo-product-profiles";
import { BrandHomeLink } from "../../components/brand-home-link";

function apiBase(params?: Record<string, string | string[] | undefined>) {
  const override = typeof params?.api === "string" ? params.api.trim() : "";
  // Query-driven loopback routing is a local development aid only. Never let
  // a public SUN URL turn the server or the user's browser into a loopback
  // probe in Preview/Production.
  const localOverrideEnabled = process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV;
  if (override && localOverrideEnabled) {
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
  certificate?: { shareToken?: string | null; url?: string | null };
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
  identity?: SunCarrierFields & { bid?: string | null; displayLot?: string | null; uid?: string | null; uidMasked?: string | null; readCounter?: number | null; tagStatus?: string | null; scanCount?: number | null; eventId?: string | null; tenantSlug?: string | null; tenantId?: string | null };
  tenant?: { id?: string | null; slug?: string | null; name?: string | null; vertical?: string | null; productLabel?: string | null; clubName?: string | null; tokenizationMode?: string | null };
  condition?: SunCarrierFields & { state?: string | null; label?: string | null; summary?: string | null; claimMode?: string | null; tokenizationPolicy?: string | null; marketplaceMode?: string | null; recommendedNextStep?: string | null; requirements?: string[] };
  rightsPolicy?: SunRightsPolicy;
  product?: { 
    name?: string | null; 
    lotLabel?: string | null;
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
    agro?: unknown;
  };
  provenance?: {
    origin?: string | null;
    firstVerified?: { at?: string | null; city?: string | null; country?: string | null };
    lastVerifiedLocation?: { at?: string | null; city?: string | null; country?: string | null; result?: string | null };
    timelineSummary?: Array<{ eventId?: string | null; at?: string | null; result?: string | null; city?: string | null; country?: string | null; device?: string | null; lat?: number | null; lng?: number | null; locationSource?: string | null; accuracyM?: number | null }>;
  };
  iot?: { 
    wineryLocation?: string | null; 
    wineryCoordinates?: { lat?: number | null; lng?: number | null } | null;
    sensorEvidenceKind?: "reported" | "declared_static" | "simulated" | "none" | string;
    sensorSnapshot?: {
      cellarTemperature?: string | null;
      humidity?: string | null;
      lightExposure?: string | null;
      transitShock?: string | null;
      observedAt?: string | null;
      source?: string | null;
      deviceId?: string | null;
    } | null;
    sensorHistory?: Array<{
      at?: string | null;
      evidenceKind?: "reported" | "declared_static" | "simulated" | string;
      source?: string | null;
      deviceId?: string | null;
      temperatureC?: number | null;
      humidityPct?: number | null;
      lightExposure?: string | null;
      transitShock?: string | null;
    }>;
  };
  engagement?: {
    promotions?: Array<{
      title?: string | null;
      description?: string | null;
      points?: number | null;
      state?: string | null;
      sourceLabel?: string | null;
    }>;
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
  technical?: SunCarrierFields & {
    raw?: { piccDataPrefix?: string; encPrefix?: string; cmacPrefix?: string };
    tt?: SunTtTechnicalInput;
  };
};

function fmtDate(value?: string | null, timezone?: string | null, locale: SunLocale = "es-AR") {
  if (!value) return "N/A";
  const formatted = formatSunDateTime(value, locale, timezone);
  return formatted === "No informado" || formatted === "Não informado" || formatted === "Not provided" ? "N/A" : formatted;
}

function policyLabel(value?: string | null) {
  const raw = String(value || "").replace(/_/g, " ").trim();
  if (!raw) return "No configurado";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function mapHref(lat?: number | null, lng?: number | null, uncertaintyM?: number | null) {
  if (!isUsableCoordinate(lat, lng)) return "";
  const radiusM = Number(uncertaintyM);
  const zoom = Number.isFinite(radiusM) && radiusM >= 25_000 ? 8
    : Number.isFinite(radiusM) && radiusM >= 10_000 ? 9
      : Number.isFinite(radiusM) && radiusM >= 5_000 ? 10
        : Number.isFinite(radiusM) && radiusM >= 2_000 ? 11
          : Number.isFinite(radiusM) && radiusM >= 1_000 ? 12
            : Number.isFinite(radiusM) && radiusM >= 500 ? 13
              : 14;
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=${zoom}/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`;
}

function isUsableCoordinate(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return false;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat)
    && Number.isFinite(parsedLng)
    && parsedLat >= -90
    && parsedLat <= 90
    && parsedLng >= -180
    && parsedLng <= 180;
}

function isConsentedBrowserLocationSource(value?: string | null) {
  return ["browser_geolocation_approximate_consent", "browser_gps_approximate_consent"]
    .includes(String(value || "").trim().toLowerCase());
}

function publicCoordinateUncertaintyM(lat?: number | null) {
  if (lat == null || !Number.isFinite(Number(lat))) return null;
  const latitudeHalfCellM = 111_320 * 0.005;
  const longitudeHalfCellM = latitudeHalfCellM * Math.max(0.05, Math.abs(Math.cos(Number(lat) * Math.PI / 180)));
  return Math.ceil(Math.hypot(latitudeHalfCellM, longitudeHalfCellM) / 50) * 50;
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
    return { name: requestedProduct || "Sobre de semillas (demo)", vertical: "agro", category: "Agro" };
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

  const isDemoLabHandoff = readParam(params, "demo") === "1"
    && readParam(params, "source") === "demo-lab";
  const handoffProfile = resolveDemoProductProfile(readParam(params, "profile"));
  const demoProduct = isDemoLabHandoff
    ? { name: handoffProfile.name, vertical: handoffProfile.vertical, category: handoffProfile.category }
    : demoProductFromParams(params);
  const demoBrand = isDemoLabHandoff ? handoffProfile.brand : "Bodega Balmec";
  const demoRegion = isDemoLabHandoff ? handoffProfile.region : "Valle de Uco, Mendoza";
  const demoLot = isDemoLabHandoff ? handoffProfile.lot : "BALMEC-2026-02";
  const demoOrigin = isDemoLabHandoff
    ? handoffProfile.origin
    : { city: "Tunuyan", country: "AR", lat: -33.2095, lng: -69.1211 };
  const demoTap = isDemoLabHandoff
    ? handoffProfile.sampleTap
    : { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 };

  return {
    ok: true,
    status: {
      code: "AUTH_OK",
      label: "Etiqueta digital válida · apertura informada",
      tone: "good",
      summary: "La etiqueta digital de muestra informa una apertura y un origen declarado dentro de la simulación.",
      reason: "demo_preview",
      productState: "VALID_OPENED",
      tamperSupported: true,
      tamperStatus: "OPENED",
    },
    identity: {
      bid: demoLot,
      uid: "04A7****1090",
      readCounter: 7,
      tagStatus: "active",
      scanCount: 7,
      eventId: "demo-sun-preview",
      tenantSlug: isDemoLabHandoff ? `demo-${handoffProfile.key}` : "demobodega",
    },
    product: {
      name: demoProduct.name,
      winery: demoBrand,
      region: demoRegion,
      varietal: demoProduct.vertical === "vino" ? "Malbec" : demoProduct.category,
      vintage: demoProduct.vertical === "vino" ? "2021" : null,
      barrelMonths: demoProduct.vertical === "vino" ? 12 : null,
      storage: demoProduct.vertical === "vino" ? "Cava 16C" : "Condición declarada por la marca",
      category: demoProduct.category,
      vertical: demoProduct.vertical,
    },
    provenance: {
      origin: demoRegion,
      firstVerified: { at: "2026-04-24T14:00:00.000Z", city: demoOrigin.city, country: demoOrigin.country },
      lastVerifiedLocation: { at: "2026-05-01T18:30:00.000Z", city: demoTap.city, country: demoTap.country, result: "VALID_OPENED" },
      timelineSummary: [
        { at: "2026-05-01T18:30:00.000Z", result: "VALID_OPENED", city: demoTap.city, country: demoTap.country, device: "mobile", lat: demoTap.lat, lng: demoTap.lng },
        { at: "2026-04-30T22:20:00.000Z", result: "VALID_CLOSED", city: demoOrigin.city, country: demoOrigin.country, device: "mobile", lat: demoOrigin.lat, lng: demoOrigin.lng },
      ],
    },
    iot: {
      wineryLocation: demoRegion,
      wineryCoordinates: { lat: demoOrigin.lat, lng: demoOrigin.lng },
    },
    tapContext: { city: demoTap.city, country: demoTap.country, lat: demoTap.lat, lng: demoTap.lng },
    tokenization: { status: "sandbox_ready", network: "Polygon Amoy", txHash: null, tokenId: null },
    tag_tamper: { available: true, status: "opened", raw: "4F4F" },
    cta: { claimOwnership: true, registerWarranty: true, provenance: true, tokenize: true },
    troubleshooting: [],
    technical: { raw: { piccDataPrefix: "04A7", encPrefix: "4F4F", cmacPrefix: "SUN" } },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const { locale } = await getWebI18n(readParam(params, "lang"));
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
  const isQrScan = params.qr === "1" || params.channel === "qr";
  const query = new URLSearchParams();
  ["v", "bid", "picc_data", "enc", "cmac"].forEach((key) => {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  });

  const snapshotId = typeof params.snapshot === "string" ? params.snapshot.trim() : "";
  const snapshotTrace = typeof params.trace === "string" ? params.trace.trim() : "";
  const snapshotAccess = typeof params.access === "string"
    ? params.access.trim()
    : typeof params.snapshot_access === "string"
      ? params.snapshot_access.trim()
      : "";
  const freshToken = typeof params.fresh === "string"
    ? params.fresh.trim()
    : typeof params.fresh_token === "string"
      ? params.fresh_token.trim()
      : "";
  const resolvedApiBase = apiBase(params);
  const isDemoPreview = !isQrScan && query.toString().length === 0 && !snapshotId;
  const isDemoLabHandoff = isDemoPreview
    && readParam(params, "demo") === "1"
    && readParam(params, "source") === "demo-lab";
  const requestedDemoLocale = readParam(params, "locale");
  const requestedLanguage = readParam(params, "lang");
  const webI18n = await getWebI18n(requestedLanguage || (isDemoLabHandoff ? requestedDemoLocale : null));
  const locale = webI18n.locale;
  query.set("lang", locale);
  const demoLabProfile = isDemoLabHandoff
    ? resolveDemoProductProfile(readParam(params, "profile"))
    : null;
  const demoLabAction = isDemoLabHandoff
    ? resolveDemoExperienceAction(readParam(params, "action"))
    : null;
  const demoLabReturnHref = demoLabProfile
    ? `/demo-lab?profile=${encodeURIComponent(demoLabProfile.key)}&locale=${encodeURIComponent(locale)}`
    : null;
  const demoLabReturnLabel = locale === "en"
    ? "Back to Demo Lab"
    : locale === "pt-BR"
      ? "Voltar ao Demo Lab"
      : "Volver al Demo Lab";

  let result: SunContract;
  let snapshotResult: SunContract | null = null;

  if (isQrScan) {
    const requestedProduct = readParam(params, "product") || readParam(params, "productName");
    const requestedWinery = readParam(params, "winery") || readParam(params, "brand");
    const requestedTenant = readParam(params, "tenant");
    const requestedRegion = readParam(params, "region");
    const requestedOrigin = readParam(params, "origin");
    const incomingHeaders = await headers();
    const qrQuery = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) qrQuery.set(key, value.trim());
    });
    qrQuery.set("qr", "1");
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
      ok: false,
      status: {
        code: "QR_UPSTREAM_UNAVAILABLE",
        label: "Datos QR no disponibles",
        tone: "warn",
        summary: "La API no respondió. Solo se muestran como N/D o dato declarado los campos recibidos en la URL; no hay veredicto, evidencia NFC, origen confirmado ni acciones comerciales habilitadas.",
        reason: "qr_upstream_unavailable",
        productState: "NOT_REGISTERED",
        tamperSupported: false,
      },
      identity: {
        bid: readParam(params, "bid") || null,
        uid: null,
        scanCount: 0,
        tenantSlug: requestedTenant || null,
      },
      product: {
        name: requestedProduct || "N/D",
        winery: requestedWinery || "N/D",
        region: requestedRegion || "N/D",
        varietal: "N/D",
        notes: "Datos declarados por parámetros de entrada; no fueron confirmados por la API.",
      },
      provenance: { origin: requestedOrigin || "N/D", timelineSummary: [] },
      tapContext: undefined,
      tag_tamper: { available: false, status: "not_available" },
      cta: { claimOwnership: false, registerWarranty: false, provenance: false, tokenize: false },
      allowedActions: [],
      blockedActions: ["claim_ownership", "register_warranty", "provenance", "tokenize"],
      troubleshooting: ["Reintentá cuando la API esté disponible. No tomes esta vista como validación del producto ni del mensaje."],
    };
  } else if (isDemoPreview) {
    // Opening /sun as a guided demo is not a physical NFC read. Resolve it
    // locally so it cannot generate false MALFORMED_URL noise in the SUN API.
    result = sunFallbackResult(params, true);
  } else {
    snapshotResult = snapshotId && snapshotTrace && snapshotAccess
      ? await fetch(`${resolvedApiBase}/sun/snapshot/${encodeURIComponent(snapshotId)}?trace=${encodeURIComponent(snapshotTrace)}&access=${encodeURIComponent(snapshotAccess)}${freshToken ? `&fresh=${encodeURIComponent(freshToken)}` : ""}`, { cache: "no-store" })
        .then((res) => res.ok ? res.json() : null)
        .then((payload) => payload?.contract || null)
        .catch(() => null) as SunContract | null
      : null;
    const hasCompleteDynamicSunPayload = ["bid", "picc_data", "enc", "cmac"]
      .every((key) => Boolean(query.get(key)?.trim()));
    if (!snapshotResult && hasCompleteDynamicSunPayload) {
      // Keep the browser as the first caller of the SUN API. A server-side BFF
      // fetch would attribute Vercel's server region/IP to the tap instead of
      // the phone. The API validates and persists the dynamic payload, then
      // redirects the browser back to the signed snapshot URL.
      redirect(`${resolvedApiBase}/sun?${query.toString()}`);
    }
    const response = snapshotResult ? null : await fetch(`${resolvedApiBase}/sun?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    const parsedResult = response?.ok
      ? await response.json().catch(() => null) as SunContract | null
      : null;
    result = snapshotResult || parsedResult || sunFallbackResult(params, isDemoPreview);
  }

  const bid = String(result.identity?.bid || params.bid || "");
  const uid = String(result.identity?.uid || "");
  const uidMasked = String(result.identity?.uidMasked || result.identity?.uid || "");
  const eventId = String(result.identity?.eventId || result.eventId || "").trim();
  const statusCode = String(result.status?.code || "").toUpperCase();
  const statusReason = String(result.status?.reason || "").toLowerCase();
  const productState = String(result.status?.productState || "").toUpperCase();
  const ttStatus = String(
    result.tag_tamper?.status
      || result.status?.tamperStatus
      || result.trustSignals?.tamperStatus
      || "",
  ).toLowerCase();
  const ttEvidence = resolveSunTtEvidence({
    ...(result.technical?.tt || {}),
    raw: result.technical?.tt?.raw ?? result.tag_tamper?.raw,
    interpretedStatus: result.technical?.tt?.interpretedStatus
      ?? result.status?.tamperStatus
      ?? result.tag_tamper?.status
      ?? productState,
  }, (value) => translateSunUiText(value, locale));
  const showTtTechnicalEvidence = ttEvidence.available
    || Boolean(result.status?.tamperSupported)
    || Boolean(result.tag_tamper?.available);
  const blockedActions = result.blockedActions || [];
  const allowedActions = result.allowedActions || [];
  const postTapQuickActions = resolvePostTapQuickActionAvailability({ allowedActions, blockedActions });
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
    || (!isQrScan && trustSignals.antiReplay === false);
  const isManualOpenedState = statusCode === "MANUAL_OPENED"
    || statusCode === "VALID_MANUAL_OPENED"
    || productState === "VALID_MANUAL_OPENED";
  const isVerifiedOpenedState = !isManualOpenedState && (
    ["OPENED", "OPENED_PREVIOUSLY", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY"].includes(statusCode)
    || productState === "VALID_OPENED"
    || productState === "VALID_OPENED_PREVIOUSLY"
    || ttStatus === "opened"
    || ttStatus === "opened_previously"
  );
  const isOpenedAttentionState = isVerifiedOpenedState || isManualOpenedState;
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
    && !isSunProfileMismatch
    && !isManualOpenedState
    && (hasAuthenticTone || ["VALID", "AUTH_OK"].includes(statusCode) || isVerifiedOpenedState || verdictName === "valid" || verdictName === "valid_opened");
  // Freshness and authenticity are properties of the tap, not a requirement
  // that every commercial action be enabled. Each CTA applies its own policy.
  const isFreshCommercialTap = resolveCommercialTapFreshness({
    isTechnicallyAuthentic,
    isFreshHandoff,
    isSnapshotView,
  });
  const isVerifiedClosedState = isTechnicallyAuthentic
    && (ttStatus === "closed" || statusCode === "VALID_CLOSED" || productState === "VALID_CLOSED");
  const isInvalidSealState = ttStatus === "invalid";
  // A technically authentic read must never become a red security alert only
  // because the API used a more specific status code such as VALID_CLOSED.
  const isValid = isTechnicallyAuthentic && !isVerifiedOpenedState;
  const isRiskBlocked = isReplay || isTamperRisk || isSunProfileMismatch || isInvalidSealState || (!isTechnicallyAuthentic && !isQrScan);
  const agroProfile = normalizeAgroDppProfile(result.product?.agro);
  const isAgroDpp = Boolean(agroProfile);
  const engagementBaseEligible = !isDemoPreview
    && (isQrScan || isFreshCommercialTap || isVerifiedOpenedState)
    && !isManualOpenedState
    && !isRiskBlocked
    && !isSnapshotView;
  const troubleshooting = result.troubleshooting || [];
  const wineryCoordinates = result.iot?.wineryCoordinates;
  const resolvedOriginCoords = isUsableCoordinate(wineryCoordinates?.lat, wineryCoordinates?.lng)
    ? { lat: Number(wineryCoordinates?.lat), lng: Number(wineryCoordinates?.lng) }
    : null;
  const wineryPoint = resolvedOriginCoords
    ? [{
      city: result.iot?.wineryLocation || result.provenance?.origin || result.product?.region || result.product?.winery || "Origen declarado",
      country: "",
      lat: Number(resolvedOriginCoords.lat),
      lng: Number(resolvedOriginCoords.lng),
      scans: 0,
      risk: 0,
      status: "ORIGIN",
      source: "winery_origin",
    }]
    : [];
  const hasCurrentTapCoords = isUsableCoordinate(result.tapContext?.lat, result.tapContext?.lng);
  const currentTapLat = hasCurrentTapCoords ? Number(result.tapContext?.lat) : null;
  const currentTapLng = hasCurrentTapCoords ? Number(result.tapContext?.lng) : null;
  // A browser GPS confirmation is a separate observation from the edge/IP
  // estimate captured when the tap URL opened. If reverse locality lookup has
  // no match, keep the GPS point explicitly generic instead of attaching the
  // older IP city/country to these coordinates.
  // A city without a WGS84 pair can be an edge/network hint or an older
  // provenance value. It must never become the location of this physical tap.
  const currentTapCity = hasCurrentTapCoords
    ? result.tapContext?.city || "Zona aproximada"
    : "Tap";
  const currentTapCountry = hasCurrentTapCoords
    ? result.tapContext?.country || "--"
    : "--";
  const currentTapPoint = currentTapLat != null && currentTapLng != null
    ? [{
      city: currentTapCity,
      country: currentTapCountry,
      lat: currentTapLat,
      lng: currentTapLng,
      scans: 1,
      risk: isRiskBlocked ? 1 : 0,
      status: result.status?.code || "REVIEW",
      source: "current_mobile_tap",
      eventId: eventId || null,
      locationSource: result.tapContext?.locationSource || null,
      accuracyM: result.tapContext?.accuracyM || null,
      lastSeen: result.tapContext?.utcTime || result.tapContext?.localTime || null,
    }]
    : [];
  const originToTapDistance = wineryPoint.length && currentTapPoint.length
    ? haversineKm(wineryPoint[0].lat, wineryPoint[0].lng, currentTapPoint[0].lat, currentTapPoint[0].lng)
    : null;
  const originMapHref = wineryPoint.length ? mapHref(wineryPoint[0].lat, wineryPoint[0].lng) : "";
  const originDisplay = wineryPoint.length
    ? [wineryPoint[0].city, wineryPoint[0].country].filter(Boolean).join(", ")
    : result.provenance?.origin || result.product?.region || "Origen no informado";
  const tapDisplay = currentTapPoint.length
    ? currentTapPoint[0].country && currentTapPoint[0].country !== "--"
      ? `${currentTapPoint[0].city}, ${currentTapPoint[0].country}`
      : currentTapPoint[0].city
    : "Tap actual no geolocalizado";
  const rawLocationSource = String(result.tapContext?.locationSource || "").toLowerCase();
  const hasConfirmedBrowserLocation = isConsentedBrowserLocationSource(rawLocationSource);
  const isLegacyBrowserLocation = rawLocationSource === "browser_gps"
    || rawLocationSource === "browser_gps_reported";
  const accuracyM = Number(result.tapContext?.accuracyM);
  const hasAccuracy = Number.isFinite(accuracyM) && accuracyM > 0;
  const publicLocationUncertaintyM = hasCurrentTapCoords ? publicCoordinateUncertaintyM(currentTapLat) : null;
  const effectivePublicUncertaintyM = publicLocationUncertaintyM
    ? publicLocationUncertaintyM + (hasAccuracy ? accuracyM : 0)
    : null;
  const publicLocationUncertaintyLabel = effectivePublicUncertaintyM
    ? `punto público redondeado (incertidumbre mínima ~${Math.ceil(effectivePublicUncertaintyM / 50) * 50} m)`
    : "precisión pública no informada";
  const tapLocationPrecisionLabel = isDemoPreview
    ? "Ubicacion simulada del Demo Lab"
    : isConsentedBrowserLocationSource(rawLocationSource)
      ? `Ubicación aproximada confirmada después del tap · ${publicLocationUncertaintyLabel}${hasAccuracy ? ` · precisión original del dispositivo ±${Math.round(accuracyM)} m o más` : ""}`
    : isLegacyBrowserLocation
      ? `Ubicación informada por integración · este registro no acredita consentimiento del navegador ni posición exacta · ${publicLocationUncertaintyLabel}${hasAccuracy ? ` · precisión declarada ±${Math.round(accuracyM)} m` : ""}`
      : rawLocationSource === "ip_geo" || rawLocationSource === "edge_ip_approx"
        ? `Zona aproximada por red/IP, sin precisión GPS · ${publicLocationUncertaintyLabel}`
      : rawLocationSource.includes("error") || rawLocationSource.includes("denied")
        ? "GPS no autorizado"
        : hasCurrentTapCoords
          ? "Coordenada reportada"
          : "Sin ubicacion";
  const isNetworkEstimatedLocation = rawLocationSource === "ip_geo" || rawLocationSource === "edge_ip_approx";
  const summaryLocationSourceBadge = isDemoPreview
    ? "Dato simulado"
    : hasConfirmedBrowserLocation
      ? "Geolocalización con permiso"
      : isNetworkEstimatedLocation
        ? "Estimación de red"
        : hasCurrentTapCoords
          ? "Fuente reportada"
          : "Sin ubicación";
  const summaryLocationFriendlyCopy = isDemoPreview
    ? "Esta ubicación pertenece a la simulación y no a un teléfono real."
    : hasConfirmedBrowserLocation
      ? "El teléfono compartió una zona aproximada después del tap y con tu permiso."
      : isNetworkEstimatedLocation
        ? "No es tu posición: la red estima una zona amplia y puede ubicarte en otra ciudad. Compartí la ubicación del teléfono si querés mejorarla."
        : hasCurrentTapCoords
          ? "Se muestra la zona informada por la fuente, sin agregar precisión que no fue reportada."
          : "El tap no compartió ubicación. El pasaporte funciona igual y podés agregar una zona si querés.";
  const tapMapHref = currentTapPoint.length
    ? mapHref(currentTapPoint[0].lat, currentTapPoint[0].lng, effectivePublicUncertaintyM)
    : "";
  const distanceDisplay = fmtDistance(originToTapDistance, locale);
  const sensorSnapshot = result.iot?.sensorSnapshot;
  const sensorEvidenceKind = String(result.iot?.sensorEvidenceKind || "none").toLowerCase();
  const hasReportedSensorEvidence = Boolean(
    sensorEvidenceKind === "reported"
    && (sensorSnapshot?.cellarTemperature || sensorSnapshot?.humidity || sensorSnapshot?.lightExposure || sensorSnapshot?.transitShock),
  );
  const hasDeclaredSensorEvidence = Boolean(
    sensorEvidenceKind === "declared_static"
    && (sensorSnapshot?.cellarTemperature || sensorSnapshot?.humidity || sensorSnapshot?.lightExposure || sensorSnapshot?.transitShock),
  );
  const usesDemoSensorEvidence = isDemoPreview && !hasReportedSensorEvidence && !hasDeclaredSensorEvidence;
  const hasSensorEvidence = hasReportedSensorEvidence || hasDeclaredSensorEvidence || usesDemoSensorEvidence;
  const sensorEvidenceLabel = hasReportedSensorEvidence
    ? "Evento recibido por API o integración"
    : hasDeclaredSensorEvidence
      ? "Ficha estatica declarada por la empresa"
      : "JSON simulado del Demo Lab";
  const sensorEvidenceBadge = hasReportedSensorEvidence ? "EVENTO RECIBIDO" : hasDeclaredSensorEvidence ? "DECLARADO" : "DEMO / JSON";
  const sensorHistory = Array.isArray(result.iot?.sensorHistory) ? result.iot.sensorHistory.slice(0, 4) : [];
  const sensorSource = sensorSnapshot?.source || sensorHistory[0]?.source || (usesDemoSensorEvidence ? "demo_static_json" : null);
  const sensorObservedAt = sensorSnapshot?.observedAt || sensorHistory[0]?.at || null;
  const sensorMode = hasReportedSensorEvidence
    ? "Integración recibida · no asumida en vivo"
    : hasDeclaredSensorEvidence
      ? "Archivo o manifiesto estático"
      : "Simulación local · sin hardware";
  const dynamicTemp = sensorSnapshot?.cellarTemperature || (usesDemoSensorEvidence ? "15.2°C" : "N/A");
  const dynamicHumidity = sensorSnapshot?.humidity || (usesDemoSensorEvidence ? "62%" : "N/A");
  const dynamicLight = sensorSnapshot?.lightExposure || (usesDemoSensorEvidence ? "Exposicion baja (simulada)" : "N/A");
  const dynamicShock = sensorSnapshot?.transitShock || (usesDemoSensorEvidence ? "Sin golpes críticos en la simulación" : "N/A");
  const sensorJsonPreview = {
    evidenceKind: hasReportedSensorEvidence ? "reported" : hasDeclaredSensorEvidence ? "declared_static" : "simulated",
    source: sensorSource,
    realtime: false,
    observedAt: sensorObservedAt,
    deviceId: sensorSnapshot?.deviceId || sensorHistory[0]?.deviceId || null,
    metrics: {
      temperature: dynamicTemp,
      humidity: dynamicHumidity,
      light: dynamicLight,
      shock: dynamicShock,
    },
  };
  const hasDeclaredTastingProfile = Boolean(result.product?.notes || result.product?.tasting_notes || result.product?.maridaje);
  const usesDemoTastingProfile = isDemoPreview && !hasDeclaredTastingProfile;
  const dynamicTastingNotes = result.product?.notes
    || result.product?.tasting_notes
    || (usesDemoTastingProfile ? "Entrada dulce y carnosa, taninos maduros y final persistente." : null);
  const dynamicMaridaje = result.product?.maridaje
    || (usesDemoTastingProfile ? "Carnes asadas, pastas intensas o quesos curados." : null);
  const livePillLabel = isDemoPreview ? "Muestra demo" : isQrScan ? "QR / SDK" : isFreshHandoff ? "Tap físico activo" : isSnapshotView ? "Consulta segura" : "Tap SUN";
  const consumerStatus = resolveSunConsumerStatus({
    isDemoPreview,
    isQrScan,
    isTechnicallyAuthentic,
    isVerifiedClosedState,
    isVerifiedOpenedState,
    isInvalidSealState,
    isTamperRisk,
    isReplay,
    isSunProfileMismatch,
    isSnapshotView,
  }, (value) => translateSunUiText(value, locale));
  const consumerServicesLabel = isRiskBlocked
    ? "Protegidos"
    : isDemoPreview
      ? "Modo demo"
      : isQrScan
        ? "Informativos"
        : isFreshCommercialTap
          ? "Disponibles"
          : "Requieren tap";
  const apiQualityScore = typeof result.quality?.score === "number" ? result.quality.score : Number.NaN;
  const trustScore = Number.isFinite(apiQualityScore)
    ? Math.max(0, Math.min(100, apiQualityScore))
    : null;
  const lastEventAt = result.provenance?.timelineSummary?.[0]?.at || result.provenance?.lastVerifiedLocation?.at || null;
  const tapTimeIsoCandidate = result.tapContext?.utcTime || lastEventAt || "";
  const localTapTimeIso = Number.isFinite(new Date(tapTimeIsoCandidate).getTime()) ? tapTimeIsoCandidate : "";
  const localTapTimeLabel = localTapTimeIso
    ? fmtDate(localTapTimeIso, result.tapContext?.timezone, locale)
    : result.tapContext?.localTime || "";
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
    : isManualOpenedState
    ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
    : isRiskBlocked
    ? "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]"
    : isOpenedAttentionState
      ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
      : "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]";
  const displayRiskLevelLabel = isQrScan
    ? "Engagement QR"
    : isFreshHandoff
    ? "Tap accionable"
    : isSnapshotView
    ? "Consulta segura"
    : isSunProfileMismatch
    ? "Batch técnico bloqueado"
    : isRiskBlocked
    ? "Riesgo alto"
    : isVerifiedOpenedState
      ? "Apertura informada por la etiqueta"
      : trustScore != null && trustScore >= 85
        ? "Score alto reportado"
        : trustScore != null && trustScore >= 65
          ? "Score medio reportado"
          : trustScore != null
            ? "Score bajo reportado"
            : "Sin score reportado";
  const reportProblemHref = "/?contact=sales&intent=sun_mobile#contact-modal";
  const productSectionHref = isAgroDpp ? "#agro-dpp" : "#product-info";
  const consumerActionHref = isAgroDpp ? "#agro-dpp" : "#consumer-choice";
  const recommendedAction = isFreshCommercialTap
    ? { label: "Ver ficha y opciones", href: consumerActionHref, helper: rightsPolicy.recommendedNextStep || "No hace falta registrarse para leer la ficha. Contacto, club, garantia y propiedad son pasos opt-in separados." }
    : isSnapshotView
      ? { label: "Ver ficha", href: productSectionHref, helper: "Consulta segura: evidencia digital y registros declarados quedan visibles. Acciones sensibles requieren otro tap físico." }
    : isSunProfileMismatch
      ? { label: "Avisar a soporte", href: reportProblemHref, helper: "El producto y el lote quedan visibles. Garantia, club o tokenizacion esperan el perfil SUN correcto o el payload del proveedor." }
    : !isRiskBlocked && isTechnicallyAuthentic
      ? { label: "Ver detalles de trazabilidad", href: "#geo-trace", helper: "Revisá origen, fuente y consistencia antes de guardar." }
      : { label: "Reportar y reintentar tap", href: reportProblemHref, helper: "Señal de riesgo alta. Escaneá físicamente de nuevo." };
  const tenantSlug = String(result.identity?.tenantSlug || "").trim();
  // Browser geolocation is posted through the same-origin BFF. Calling the API
  // origin directly would trigger a JSON CORS preflight and fail closed.
  const telemetryEndpoint = "/api/sun-context";
  const marketplaceHref = tenantSlug ? `/me/marketplace?tenant=${encodeURIComponent(tenantSlug)}` : "/me/marketplace";
  const telemetryReadCounter = typeof result.identity?.readCounter === "number"
    && Number.isSafeInteger(result.identity.readCounter)
    && result.identity.readCounter >= 0
      ? result.identity.readCounter
      : null;
  const canRequestBrowserLocation = !isQrScan
    && !isDemoPreview
    && isFreshHandoff
    && !isSnapshotView
    && Boolean(bid && eventId && freshToken)
    && telemetryReadCounter !== null;
  const summaryLocationLabel = isDemoPreview
    ? "Ubicación demo simulada"
    : hasConfirmedBrowserLocation
      ? "Zona aproximada confirmada"
      : rawLocationSource === "ip_geo" || rawLocationSource === "edge_ip_approx"
        ? "Zona de red · no es GPS"
        : "Ubicación de esta lectura";
  const summaryLocationDisplay = hasCurrentTapCoords ? tapDisplay : "Sin ubicación registrada";
  const summaryLocationEvidence = hasCurrentTapCoords
    ? tapLocationPrecisionLabel
    : isDemoPreview
      ? "Sin coordenadas en esta simulación"
      : "Sin fuente ni precisión registradas";
  const summaryLocationTime = localTapTimeLabel || "Hora no registrada";
  const hasConsumerComparableDistance = originToTapDistance != null
    && (isDemoPreview || hasConfirmedBrowserLocation);
  const locationSectionTitle = isDemoPreview
    ? "Origen y ubicación de muestra"
    : !hasCurrentTapCoords
      ? "Origen declarado"
      : isNetworkEstimatedLocation
        ? "Origen y zona estimada por red"
        : hasConfirmedBrowserLocation
          ? "Origen y zona compartida"
          : "Origen y ubicación reportada";
  const locationSectionDescription = isDemoPreview
    ? "Los puntos y la conexión son simulados y no representan un recorrido físico."
    : !hasCurrentTapCoords
      ? "El mapa muestra únicamente el origen declarado. Esta lectura no informó coordenadas y no se reutiliza una ciudad histórica como ubicación actual."
      : isNetworkEstimatedLocation
        ? "La zona de red es una referencia amplia de la conexión: no es GPS, no ubica el producto y no prueba dónde ocurrió el tap."
        : hasConfirmedBrowserLocation
          ? "La zona fue compartida por el teléfono después del tap y con permiso. Se muestra separada del origen, sin inventar un recorrido."
          : "La fuente y la precisión quedan explicadas sin inventar una ruta. La coordenada informada por la integración se mantiene separada del origen.";
  const tapLocationStoryStep = isDemoPreview && hasCurrentTapCoords
    ? {
      label: "Se simuló",
      title: `${originDisplay} -> ${tapDisplay}`,
      body: `${distanceDisplay} de separación lineal entre dos puntos de muestra; no representa un recorrido físico.`,
    }
    : !hasCurrentTapCoords
      ? {
        label: "Ubicación",
        title: "No compartida en esta lectura",
        body: "La validación NFC quedó registrada sin coordenadas. Las ciudades del historial o de la red no se atribuyen a este tap.",
      }
      : isNetworkEstimatedLocation
        ? {
          label: "La red estimó",
          title: `Zona amplia de la conexión: ${tapDisplay}`,
          body: "Es una referencia técnica de red/IP, no GPS del teléfono. No ubica el producto ni prueba dónde ocurrió el tap.",
        }
        : hasConfirmedBrowserLocation
          ? {
            label: "Se compartió",
            title: `Zona aproximada posterior al tap: ${tapDisplay}`,
            body: `${distanceDisplay} de separación lineal respecto del origen declarado. La zona fue autorizada después del tap y no demuestra recorrido ni custodia.`,
          }
          : {
            label: "Se informó",
            title: `Coordenada reportada por integración: ${tapDisplay}`,
            body: "La fuente informó una coordenada para esta lectura. No se presenta como GPS, recorrido físico ni ubicación del producto.",
          };
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
  const certificateShareToken = String(result.certificate?.shareToken || "").trim();
  const certificateHref = !isQrScan && /^\d+$/.test(eventId)
    ? `/certificado/${encodeURIComponent(eventId)}${certificateShareToken ? `?share=${encodeURIComponent(certificateShareToken)}` : ""}`
    : "";
  const declaredPromotion = result.engagement?.promotions?.find((promotion) => String(promotion?.title || "").trim());
  const publishedPromotion: SunPublishedPromotion | null = declaredPromotion
    ? {
        title: String(declaredPromotion.title || "").trim(),
        description: declaredPromotion.description ? String(declaredPromotion.description) : null,
        points: typeof declaredPromotion.points === "number" ? declaredPromotion.points : null,
        state: declaredPromotion.state ? String(declaredPromotion.state) : null,
        sourceLabel: declaredPromotion.sourceLabel ? String(declaredPromotion.sourceLabel) : "DECLARADO POR LA MARCA",
      }
    : isDemoPreview
      ? {
          title: "10% de descuento en la proxima compra",
          description: "Ejemplo de promocion configurada para mostrar el formato. La marca debe publicar condiciones, vigencia y disponibilidad reales antes de activarla.",
          points: 40,
          state: "NO CANJEABLE",
          sourceLabel: "DEMO · JSON ESTATICO",
        }
      : null;
  const servicesRiskState = isRiskBlocked
    ? "blocked" as const
    : "clear" as const;
  const servicesFreshnessState = isDemoPreview
    ? "demo" as const
    : isSnapshotView || isQrScan
    ? "snapshot" as const
    : isFreshCommercialTap
      ? "fresh" as const
      : result.tapSecurity?.freshTap === false
        ? "stale" as const
        : "unknown" as const;
  const protectedServiceHref = isFreshCommercialTap ? "#protected-actions" : "#fresh-tap-required";
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
    ? "Evidencia NFC y trazabilidad declarada visibles. Puntos, club, garantia y tokenizacion quedan protegidos hasta un nuevo tap fisico."
    : isSunProfileMismatch
      ? "El lote fue detectado como Bodega Balmec, pero la lectura SUN no descifra a un UID autorizado. Hay que corregir claves/layout o registrar el payload fisico del proveedor."
    : isReplay
      ? "La URL/SUN ya fue usada. Conservamos la evidencia y pedimos un nuevo tap fisico para acciones comerciales."
      : "Por seguridad, este producto no puede guardarse en la coleccion ni sumar puntos con esta lectura.";
  const journeySteps = [
    { id: "scan", label: "Tap NFC", done: true },
    { id: "verify", label: "Verificación", done: Boolean(result.status?.label) },
    { id: "ficha", label: "Ficha", done: true },
    { id: "optin", label: "Opt-in", done: false },
  ];
  const sealOpened = !isManualOpenedState && (
    ttStatus === "opened"
    || ttStatus === "opened_previously"
    || ["VALID_OPENED", "VALID_OPENED_PREVIOUSLY"].includes(statusCode)
    || ["VALID_OPENED", "VALID_OPENED_PREVIOUSLY"].includes(productState)
  );
  const sealClosed = !isManualOpenedState
    && (ttStatus === "closed" || statusCode === "VALID_CLOSED" || productState === "VALID_CLOSED");
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
    ? "NFT con registro on-chain confirmado"
    : tokenPending
      ? "NFT solicitado, mint en cola"
      : tokenBlocked
        ? "NFT protegido por politica"
        : "NFT listo para activar";
  const nftDisplayCopy = hasOnChainProof
    ? "La identidad digital o el lote ya tiene una prueba on-chain asociada. Beneficios, wallet o propiedad se activan solo con flujo opt-in."
    : tokenPending
      ? "La solicitud quedo guardada. El minter de Polygon puede completar el anclaje sin que el consumidor pierda el recorrido."
      : tokenBlocked
        ? "Mostramos la evidencia digital disponible, pero el mint queda bloqueado hasta tener un tap fresco y apto."
        : "Si la marca lo habilita y el comprador valida la compra, el producto puede sumar certificado NFT/sandbox, wallet, club o marketplace.";
  const realReplayDecisionText = isSunProfileMismatch
    ? "Producto y lote declarados en plataforma. La activación comercial queda pendiente porque el perfil SUN del batch no coincide con la lectura física registrada."
    : isReplay
      ? "Replay detectado: esta URL SUN ya fue usada. Garantía, rewards y tokenización quedan bloqueados hasta un nuevo tap físico."
      : isSnapshotView
        ? "Consulta segura: la prueba queda disponible para revisar y compartir. Para sumar puntos, activar garantía o mintear, tocá otra vez la etiqueta."
        : isValid
          ? rightsSummary || (isCryptoCarrier
            ? "Lectura fresca: UID, contador SUN y CMAC pasan la política anti-replay."
            : "Lectura fresca: identidad registrada y trazabilidad declarada por plataforma.")
          : isManualOpenedState
            ? "Un operador registró una apertura. Esa declaración no reemplaza una lectura criptográfica del sello ni una inspección del envase."
            : isVerifiedOpenedState && isTechnicallyAuthentic
              ? rightsSummary || "Mensaje SUN válido y estado TT abierto reportado. Podés iniciar una validación de compra separada para cuenta, puntos o club."
              : rightsSummary || "Lectura de control: la evidencia técnica del mensaje NFC sigue disponible, pero algunas acciones comerciales quedan restringidas.";
  const replayDecisionText = selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.decision, realReplayDecisionText);
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
  const sealLabel = isManualOpenedState
    ? "Apertura declarada por operador"
    : sealClosed
      ? "TT cerrado reportado"
      : sealOpened
        ? "TT abierto reportado"
        : "TT no informado";
  const chainLabel = tokenEvidenceLabel;
  const productName = result.product?.name || "Producto conectado";
  const productImageUrl = result.product?.imageUrl || result.product?.image_url || result.product?.photoUrl || result.product?.photo_url || null;
  const productMedia = (result.product?.media && typeof result.product.media === "object" ? result.product.media : {}) as Record<string, unknown>;
  const productGalleryUrls = Array.isArray(productMedia.galleryUrls)
    ? productMedia.galleryUrls.map((item) => String(item || "").trim()).filter(Boolean)
    : Array.isArray(productMedia.gallery_urls)
      ? productMedia.gallery_urls.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  // Demo previews resolve their product and brand only from the allowlisted
  // server-side fixture. Free URL fields must never override that contract.
  const requestedBrandDisplay = isDemoPreview
    ? ""
    : readParam(params, "winery") || readParam(params, "brand") || "";
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
  const productVisualKind = (assetProfile.visualKind || resolveSunVisualKind(result)) as SunVisualKind;
  const productDisplayName = assetProfile.productName || productName;
  const isWineProduct = [result.product?.vertical, result.tenant?.vertical, productDisplayName]
    .some((value) => /\b(wine|vino|malbec|reserva|bodega)\b/i.test(String(value || "")));
  const showEngagementSuite = engagementBaseEligible && isWineProduct;
  const normalizedEngagementAllowed = allowedActions.map((action) => String(action).trim().toLowerCase());
  const normalizedEngagementBlocked = blockedActions.map((action) => String(action).trim().toLowerCase());
  const hasEngagementAllowList = normalizedEngagementAllowed.some((action) => ["lead", "feedback", "sommelier"].includes(action));
  const canSubscribeToBrand = engagementBaseEligible
    && !normalizedEngagementBlocked.includes("lead")
    && (!hasEngagementAllowList || normalizedEngagementAllowed.includes("lead"));
  const servicePolicyAvailability = {
    promotion: !isRiskBlocked,
    purchase: postTapQuickActions.marketplace && !isRiskBlocked,
    subscribe: canSubscribeToBrand && !isRiskBlocked,
    claimOrManage: postTapQuickActions.primary && !isRiskBlocked,
    warranty: postTapQuickActions.warranty && !isRiskBlocked,
  };
  const consumerBrandName = requestedBrandDisplay || result.product?.winery || result.tenant?.name || result.tenant?.slug || "la marca";
  const engagementWineryName = consumerBrandName === "la marca" ? "Bodega Premium" : consumerBrandName;
  const engagementTenantSlug = readParam(params, "tenant") || tenantSlug || "demobodega";
  const productHeroImageUrl = assetProfile.primaryImageUrl || productImageUrl;
  const productVisualState = (isReplay || isRiskBlocked)
    ? "blocked"
    : (sealOpened || isVerifiedOpenedState)
      ? "opened"
      : "idle";
  const realTrustCopy = isSunProfileMismatch
    ? "La evidencia se conserva y cualquier lector ve los registros declarados de producto, bodega, lote y trazabilidad. Garantia, club, marketplace y NFT esperan el perfil SUN correcto o el payload fisico registrado."
    : isReplay
    ? "Anti-replay activo: el tap queda como evidencia, no como permiso comercial."
    : isSnapshotView
      ? "Consulta segura: evidencia NFC visible y trazabilidad declarada preservada. Las acciones comerciales requieren otro tap fisico."
    : isFreshHandoff
      ? "Mensaje NFC recien validado: ficha publica, eventos declarados y opciones opt-in disponibles mientras el handoff sigue fresco."
    : isManualOpenedState
      ? "Apertura registrada por un operador: la tratamos como una declaración y no como una detección automática del sello."
    : isVerifiedOpenedState && isTechnicallyAuthentic
      ? "Estado TT abierto reportado: el mensaje SUN sigue siendo valido; el significado fisico depende de la integracion del tag al packaging."
    : isFreshCommercialTap
      ? "Lectura fresca, identidad consistente y lote activo."
    : trustScore != null && trustScore >= 65
      ? "Lectura revisable: conviene mirar eventos declarados y estado TT antes de activar beneficios."
      : trustScore != null
        ? "Lectura de riesgo: no habilitamos acciones sensibles hasta repetir el tap."
        : "Lectura técnica sin score reportado: revisá la evidencia y la política antes de activar beneficios.";
  const trustCopy = selectSunTruthCopy(isDemoPreview, SUN_DEMO_COPY.trust, realTrustCopy);
  const effectiveTrustCopy = isDemoPreview ? trustCopy : !isReplay && !isSnapshotView && rightsSummary ? rightsSummary : trustCopy;
  const rightsModeCards = [
    { label: "Rubro", value: verticalLabel },
    { label: "Ownership", value: claimModeLabel },
    { label: "Token", value: tokenPolicyLabel },
    { label: "Marketplace", value: marketplaceModeLabel },
  ];
  const rightsRequirementsPreview = rightsRequirements.slice(0, 4);
  const handoffCopy = isDemoPreview
    ? "Vista demo del passport SUN para probar el flujo sin etiqueta fisica."
    : isQrScan
      ? "Ficha QR: contenido y CRM, sin propiedad automatica."
      : isFreshHandoff
    ? "Tap físico fresco: mensaje SUN validado y token temporal para evaluar acciones según política."
    : isSnapshotView
    ? "Consulta segura: prueba visible, acciones comerciales bloqueadas."
      : "Validacion directa desde parametros SUN.";
  const carrierEducation = [
    { code: "qr_basic", name: "QR comun", mode: "Contenido", body: "Abre una URL para contenido, leads, marketplace y analytics. Bajo costo, pero puede copiarse con una foto." },
    { code: "gs1_digital_link", name: "QR GS1 Digital Link", mode: "Retail", body: "GTIN, lote, serie y vencimiento para retail/exportacion. Profesionaliza trazabilidad, no es anti-clon por si solo." },
    { code: "ntag213", name: "NTAG213", mode: "Tap web", body: "NFC economico para tap-to-web, garantias basicas y medicion. Sin SUN dinamico." },
    { code: "ntag215", name: "NTAG215", mode: "UID", body: "UID + reglas server-side para eventos, credenciales y productos de valor medio. No es cripto premium." },
    { code: "ntag216", name: "NTAG216", mode: "Memoria", body: "Mas memoria para journeys, payload local y activaciones con control operativo." },
    { code: "ntag424_dna", name: "NTAG 424 DNA", mode: "SUN/SDM", body: "Permite validar CMAC y contador dinámico para detectar replay o URLs reutilizadas. No certifica por sí solo el contenido ni el envase." },
    { code: "ntag424_dna_tt", name: "424 DNA TT", mode: "Tamper", body: "Suma el estado TT reportado por el tag: cerrado, abierto o no inicializado. Su significado físico depende de cómo se integra al packaging." },
    { name: "QR comun", mode: "Contenido", body: "Abre una URL y sirve para campañas simples. Es barato, pero se puede copiar o reenviar." },
    { name: "NTAG215", mode: "Tap UX", body: "Mejora velocidad y serializacion para eventos, credenciales y activaciones con reglas server-side." },
    { name: "NTAG 424 DNA", mode: "SUN/SDM", body: "Permite validar CMAC y contador dinámico para detectar replay o URLs reutilizadas. No certifica por sí solo el contenido ni el envase." },
    { name: "424 DNA TT", mode: "Tamper", body: "Suma el estado TT reportado por el tag: cerrado, abierto o no inicializado. Su significado fisico depende de como se integra al packaging." },
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
  const publicLotDisplay = String(result.product?.lotLabel || result.identity?.displayLot || "").trim() || null;
  const batchDisplay = publicLotDisplay || (isDemoPreview ? bid || result.identity?.bid || "Batch de muestra" : null);
  const technicalBid = bid || result.identity?.bid || "N/A";
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
  const productFirstStatusTitle = isDemoPreview
    ? SUN_DEMO_COPY.productStatusTitle
    : isQrScan
      ? "Ficha QR del producto"
      : isFreshCommercialTap
    ? "Ficha del producto lista"
    : isSunProfileMismatch
      ? "Producto y lote identificados"
      : isRiskBlocked
        ? "Producto visible, acciones protegidas"
        : "Identidad NFC validada";
  const productFirstStatusBody = isDemoPreview
    ? SUN_DEMO_COPY.productStatusBody
    : isQrScan
      ? "Canal de bajo costo para informar, captar leads, medir interes y activar fidelizacion. No prueba autenticidad criptografica NFC ni activa propiedad automaticamente."
      : isFreshCommercialTap
    ? "La lectura esta fresca: podes ver producto, bodega, lote, eventos declarados y certificado digital sin registrarte. Contacto, club o garantia son opt-in."
    : isSunProfileMismatch
      ? "La plataforma reconoce los registros declarados de bodega, producto y batch. La evidencia queda visible, pero club, garantia, marketplace y NFT siguen protegidos hasta cargar el perfil SUN correcto o registrar el payload fisico del proveedor."
      : isRiskBlocked
        ? "Mostramos el producto y la trazabilidad disponible, pero pedimos otro tap fisico antes de habilitar acciones comerciales."
        : "La prueba se puede compartir y revisar. Para activar beneficios sensibles, usa un tap fresco desde la etiqueta fisica.";
  const productFirstSpecs = [
    { label: "Tenant", value: tenantDisplayName },
    { label: "Producto", value: productDisplayName },
    { label: "Lote comercial", value: batchDisplay },
    { label: isQrScan ? "Canal" : "Chip", value: carrierLabel },
    { label: "UID", value: visibleUid },
    { label: "Origen declarado", value: originDisplay },
    { label: "Ubicación de esta lectura", value: summaryLocationDisplay },
    ...(hasConsumerComparableDistance ? [{ label: "Separación lineal", value: distanceDisplay }] : []),
  ].filter((item) => item.value);
  const productFirstBadges = [
    isDemoPreview ? SUN_DEMO_COPY.productBadge : isQrScan ? "Ficha QR" : "Lectura NFC registrada",
    batchDisplay,
    carrierLabel,
    isQrScan ? "Sin propiedad automatica" : isFreshCommercialTap ? "Ficha abierta" : "Acciones protegidas",
  ].filter(Boolean);

  const friendlyStageTitle = isDemoPreview
    ? SUN_DEMO_COPY.stageTitle
    : isQrScan
      ? "Ficha publica del producto"
      : isSunProfileMismatch
    ? "Esta lectura necesita revisión"
    : isManualOpenedState
    ? "Un operador registró una apertura"
    : isRiskBlocked
    ? "Necesitamos un nuevo tap fisico"
    : isSnapshotView
      ? "Consulta segura del producto"
      : isVerifiedOpenedState
        ? "Lectura válida · sello abierto"
        : "Identidad NFC validada";
  const friendlyStageBody = isDemoPreview
    ? SUN_DEMO_COPY.stageBody
    : isQrScan
      ? "Con el QR podés conocer el producto y acceder a las opciones que la marca dejó disponibles. Garantía o titularidad requieren una validación adicional."
      : isSunProfileMismatch
    ? "Reconocimos el producto y el lote, pero no pudimos completar los controles de esta lectura. La información sigue visible y las acciones sensibles quedan protegidas."
    : isManualOpenedState
    ? "La apertura fue declarada por un operador. No fue detectada automáticamente por el sello; si no la reconocés o el envase está dañado, no uses el producto y avisá para revisión."
    : isRiskBlocked
    ? "Vemos la prueba, pero no habilitamos garantia, club ni NFT con una lectura sospechosa o repetida."
    : isSnapshotView
      ? "La evidencia digital y los datos declarados se pueden revisar. Para activar beneficios sensibles, tocá de nuevo la etiqueta."
      : isVerifiedOpenedState
        ? "La lectura digital es válida y el tag informa sello abierto. Podés leer la ficha; asociar el producto a una cuenta es opcional y separado."
        : "La lectura es fresca. Primero lees la ficha; si queres, despues dejas contacto o acreditas compra.";
  const primaryPostTapAction = isDemoPreview
    ? { label: "Ver opciones de muestra", href: "#sun-services", tone: "trace" }
    : isQrScan && isAgroDpp
    ? { label: "Ver pasaporte agro", href: "#agro-dpp", tone: "trace" }
    : isQrScan
    ? { label: "Conocer el producto", href: consumerActionHref, tone: "trace" }
    : isSunProfileMismatch
    ? { label: "Avisar a soporte", href: reportProblemHref, tone: "trace" }
    : isManualOpenedState
      ? { label: "Avisar a la marca", href: reportProblemHref, tone: "risk" }
    : isFreshCommercialTap && isVerifiedOpenedState
      ? { label: "Avisar a la marca", href: reportProblemHref, tone: "risk" }
      : isFreshCommercialTap
        ? { label: "Ver garantía y beneficios", href: consumerActionHref, tone: "trace" }
    : isSnapshotView
        ? { label: "Hacer nuevo tap fisico", href: "#fresh-tap-required", tone: "fresh" }
        : isRiskBlocked
          ? { label: "Cómo hacer un nuevo toque", href: "#fresh-tap-required", tone: "risk" }
          : { label: "Ver mapa y fuentes", href: "#geo-trace", tone: "trace" };
  const consumerSignalLabel = isQrScan
    ? "Ficha digital disponible"
    : isReplay
      ? "Lectura repetida"
      : isSunProfileMismatch
        ? "Lectura por revisar"
        : isManualOpenedState
          ? "Apertura declarada"
        : isVerifiedOpenedState
          ? "Atención recomendada"
        : isTechnicallyAuthentic
          ? "Lectura digital confirmada"
          : "Lectura no confirmada";
  const consumerSealLabel = sealClosed
    ? "Sin apertura detectada"
    : isManualOpenedState
      ? "Declarada por un operador"
    : sealOpened
      ? "Apertura detectada"
      : "Estado del sello no disponible";
  const consumerResultTone = isReplay || isSunProfileMismatch || isTamperRisk
    ? "review"
    : isOpenedAttentionState
      ? "opened"
      : isSnapshotView || isQrScan
      ? "notice"
      : "verified";
  const simpleJourneySteps = [
    {
      label: isDemoPreview ? SUN_DEMO_COPY.journeyLabel : isQrScan ? "Producto informado" : "Identidad NFC",
      detail: isDemoPreview ? SUN_DEMO_COPY.journeyDetail : isQrScan ? "QR / SDK" : isSunProfileMismatch ? "Batch detectado" : isTechnicallyAuthentic ? "Mensaje validado" : "En revisión",
      state: isQrScan ? "done" : isSunProfileMismatch ? "warn" : isTechnicallyAuthentic ? "done" : "warn",
    },
    {
      label: "Origen declarado",
      detail: wineryPoint.length ? "Disponible" : "Pendiente",
      state: wineryPoint.length ? "done" : "warn",
    },
    {
      label: "Contacto opcional",
      detail: isQrScan ? "Opt-in" : isFreshCommercialTap ? "Disponible" : "Nuevo tap",
      state: isQrScan ? "ready" : isFreshCommercialTap ? "ready" : "locked",
    },
    {
      label: "Validación de compra",
      detail: isSunProfileMismatch ? "Bloqueada" : isFreshCommercialTap ? "Disponible" : "Pendiente",
      state: isFreshCommercialTap ? "ready" : "locked",
    },
  ];
  const friendlyTrustFactors = isDemoPreview
    ? [
      { label: "Fixture SUN", ok: true },
      { label: "Tap físico real", ok: false },
      { label: "Persistencia real", ok: false },
      { label: "Evidencia pública", ok: false },
      { label: "Sello de muestra", ok: true },
      { label: "Acciones simuladas", ok: true },
    ]
    : isQrScan
    ? [
      { label: "Ficha abierta", ok: true },
      { label: "Tenant identificado", ok: Boolean(tenantSlug) },
      { label: "Lote comercial informado", ok: Boolean(publicLotDisplay) },
      { label: "Lead opt-in", ok: true },
      { label: "Propiedad protegida", ok: true },
      { label: "NFC premium pendiente", ok: false },
    ]
    : [
      { label: "Tap fresco", ok: isFreshCommercialTap },
      { label: "Perfil SUN correcto", ok: !isSunProfileMismatch },
      { label: "Chip valido", ok: isTechnicallyAuthentic },
      { label: "Estado TT compatible", ok: !isTamperRisk },
      { label: "Coordenadas comparables", ok: hasConsumerComparableDistance },
      { label: trustScore == null ? "Score no reportado" : "Score de calidad informado", ok: trustScore != null && !isRiskBlocked && trustScore >= 65 },
    ];
  const passportStorySteps = [
    {
      label: "Declaró",
      title: result.product?.region || result.provenance?.origin || "Origen no declarado",
      body: "La marca cargó el origen declarado, el lote, el producto y sus reglas antes de salir al canal.",
    },
    tapLocationStoryStep,
    {
      label: isDemoPreview ? SUN_DEMO_COPY.passportEventLabel : isQrScan ? "Se consultó" : "Se analizó",
      title: isDemoPreview ? SUN_DEMO_COPY.passportEventTitle : isQrScan ? "Ficha QR abierta" : isTechnicallyAuthentic ? "Identidad NFC validada" : "Lectura en revisión",
      body: isDemoPreview ? SUN_DEMO_COPY.passportEventBody : isQrScan ? "La marca recibe telemetría, ubicación aproximada y señales de interés sin exigir registro." : isTechnicallyAuthentic ? "El mensaje del chip y la política del tenant sostienen el resultado técnico; no certifican el contenido físico." : "El sistema conserva evidencia, pero protege acciones sensibles.",
    },
    {
      label: "Ahora",
      title: isDemoPreview ? SUN_DEMO_COPY.passportNowTitle : isQrScan ? "Siguiente paso opcional" : isFreshCommercialTap ? "Ficha publica abierta" : "Acciones protegidas",
      body: isDemoPreview ? SUN_DEMO_COPY.passportNowBody : isQrScan ? "Si la persona compró, puede validar la compra o usar el NFC seguro. Si sólo está mirando en góndola, puede informarse sin reclamar nada." : isFreshCommercialTap ? "El lector puede informarse sin registrarse. Si compró, activa garantía o beneficios mediante una validación separada." : "Repetí el tap físico para activar garantía, beneficios o certificado.",
    },
  ];


  return (
    <SunLocaleProvider initialLocale={locale}>
    <main className="sun-tap-experience relative flex min-h-screen flex-col items-center overflow-x-clip bg-[#060813] px-4 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] pt-4 font-sans text-slate-100 sm:pt-8">
      <FreshHandoffUrlCleaner enabled={Boolean(isFreshHandoff && freshToken)} />
      <OfflinePublicProductCache
        enabled={!isDemoPreview && result.ok === true && Boolean(bid)}
        bid={bid}
        name={result.product?.name}
        brand={result.tenant?.name || result.product?.winery}
        region={result.product?.region}
        origin={result.provenance?.origin}
        storage={result.product?.storage}
        notes={result.product?.notes}
        agro={agroProfile}
      />
      
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[500px] bg-gradient-to-b from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="sun-tap-shell w-full max-w-[430px] z-10 space-y-5 mx-auto">
        
        <SunPassportHeader
          isQrScan={isQrScan}
          livePillLabel={livePillLabel}
          pulseClass={pulseClass}
        />

        {demoLabReturnHref ? (
          <Link
            href={demoLabReturnHref}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 text-xs font-black text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {demoLabReturnLabel}
          </Link>
        ) : null}

        <SunSectionNav variant={isAgroDpp ? "agro" : "default"} />

        {isAgroDpp && agroProfile ? (
          <AgroDppExperience
            profile={agroProfile}
            bid={bid}
            eventId={eventId}
            productName={productDisplayName}
            brand={tenantDisplayName}
            statusCode={statusCode}
            statusLabel={String(result.status?.label || "")}
            statusSummary={String(result.status?.summary || "")}
            productState={productState}
            verdict={verdictName}
            riskLevel={String(result.riskLevel || "")}
            isQr={isQrScan}
            isFreshTap={isFreshCommercialTap}
            timeline={result.provenance?.timelineSummary || []}
          />
        ) : null}

        {!isAgroDpp ? <>
        {/* 1. First-tap summary: product first, then a compact truthful result. */}
        <section
          id="sun-summary"
          className="sun-summary-panel scroll-mt-24 relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-2xl sm:p-4"
        >
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-cyan-500 opacity-10 blur-[60px]" />

          <div className="relative z-10 space-y-2.5">
            <div
              data-testid="sun-summary-product"
              className="sun-summary-product grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3"
            >
              <div className="sun-summary-product__visual relative h-28 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_34%,rgba(34,211,238,0.18),transparent_54%),rgba(2,6,23,0.62)] shadow-inner">
                {productHeroImageUrl ? (
                  <img
                    src={productHeroImageUrl}
                    alt={productDisplayName}
                    className="h-full w-full object-contain p-1.5 drop-shadow-[0_12px_18px_rgba(0,0,0,0.42)]"
                    loading="eager"
                    fetchPriority="high"
                  />
                ) : (
                  <div className="sun-summary-product-stage h-full w-full" aria-label={`Vista del producto ${productDisplayName}`}>
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
                      isDemoPreview={isDemoPreview}
                    />
                  </div>
                )}
              </div>

              <div className="sun-summary-product__copy min-w-0 text-left">
                {isDemoPreview && (
                  <span className="inline-flex w-fit max-w-full whitespace-normal break-words rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase leading-3 tracking-[0.12em] text-amber-100">
                    {SUN_DEMO_BADGE}
                  </span>
                )}
                <p data-sun-server-evidence="true" className="mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
                  {tenantDisplayName}
                </p>
                <h1 data-sun-server-evidence="true" className="sun-summary-product__title mt-1 break-words text-[21px] font-black leading-[1.02] tracking-tight text-white">
                  {productDisplayName}
                </h1>
                <p data-sun-server-evidence="true" className="mt-1 break-words text-[10px] leading-4 text-slate-400">
                  {productLine || verticalLabel}
                </p>
                {batchDisplay ? (
                  <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/45 px-2 py-1 text-[9px] font-bold text-slate-300">
                    <span>{isDemoPreview ? "Batch de muestra" : "Lote"}</span>
                    <span aria-hidden="true">·</span>
                    <span data-sun-server-evidence="true">{batchDisplay}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div
              data-testid="sun-summary-status"
              className={`sun-summary-status rounded-2xl border border-l-4 p-3.5 ${
                consumerStatus.tone === "closed"
                  ? "border-emerald-300/25 border-l-emerald-400 bg-emerald-500/[0.07]"
                  : consumerStatus.tone === "opened" || consumerStatus.tone === "review"
                    ? "border-amber-300/25 border-l-amber-400 bg-amber-500/[0.07]"
                    : consumerStatus.tone === "verified" || consumerStatus.tone === "info"
                      ? "border-cyan-300/20 border-l-cyan-400 bg-cyan-500/[0.06]"
                      : "border-rose-300/25 border-l-rose-400 bg-rose-500/[0.07]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`sun-summary-status__icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                  consumerStatus.tone === "closed"
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300"
                    : consumerStatus.tone === "opened" || consumerStatus.tone === "review"
                      ? "border-amber-300/25 bg-amber-400/10 text-amber-200"
                      : consumerStatus.tone === "verified" || consumerStatus.tone === "info"
                        ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-200"
                        : "border-rose-300/25 bg-rose-400/10 text-rose-200"
                }`} aria-hidden="true">
                  {consumerStatus.tone === "closed"
                    ? <PackageCheck className="h-5 w-5" strokeWidth={2} />
                    : consumerStatus.tone === "opened"
                      ? <PackageOpen className="h-5 w-5" strokeWidth={2} />
                      : consumerStatus.tone === "verified" || consumerStatus.tone === "info"
                        ? <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                        : <ShieldAlert className="h-5 w-5" strokeWidth={2} />}
                </span>
                <div className="min-w-0">
                  <span className={`block text-[10px] font-black uppercase tracking-[0.13em] ${
                    consumerStatus.tone === "closed"
                      ? "text-emerald-300"
                      : consumerStatus.tone === "opened" || consumerStatus.tone === "review"
                        ? "text-amber-200"
                        : consumerStatus.tone === "verified" || consumerStatus.tone === "info"
                          ? "text-cyan-200"
                          : "text-rose-200"
                  }`}>
                    {consumerStatus.label}
                  </span>
                  <h2 className="sun-summary-status__headline mt-1 break-words text-[19px] font-black leading-tight text-white">
                    {consumerStatus.headline}
                  </h2>
                </div>
              </div>
              <p className="sun-summary-status__copy mt-2.5 text-[11px] leading-[1.55] text-slate-300">
                {consumerStatus.copy}
              </p>
            </div>

            <dl
              data-testid="sun-summary-facts"
              className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-slate-950/35 px-1 py-2 text-center"
            >
              <div className="min-w-0 px-1.5">
                <dt className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Identidad</dt>
                <dd className={`mt-0.5 break-words text-[10px] font-bold leading-4 ${consumerStatus.tone === "risk" ? "text-rose-200" : "text-emerald-300"}`}>{consumerStatus.identityLabel}</dd>
              </div>
              <div className="min-w-0 px-1.5">
                <dt className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Sello</dt>
                <dd className={`mt-0.5 break-words text-[10px] font-bold leading-4 ${consumerStatus.tone === "closed" ? "text-emerald-300" : consumerStatus.tone === "opened" || consumerStatus.tone === "review" ? "text-amber-200" : "text-slate-300"}`}>{consumerStatus.sealLabel}</dd>
              </div>
              <div className="min-w-0 px-1.5">
                <dt className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Servicios</dt>
                <dd className={`mt-0.5 break-words text-[10px] font-bold leading-4 ${isRiskBlocked || !isFreshCommercialTap ? "text-amber-200" : "text-cyan-200"}`}>{consumerServicesLabel}</dd>
              </div>
            </dl>

            <div
              data-testid="sun-summary-location"
              className="sun-summary-location rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-3 text-left shadow-inner"
            >
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-200" aria-hidden="true">
                  <MapPin className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">
                      {summaryLocationLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-slate-300">
                      {summaryLocationSourceBadge}
                    </span>
                  </div>
                  <strong data-sun-server-evidence="true" className="mt-1 block whitespace-normal break-words text-sm leading-5 text-white">
                    {summaryLocationDisplay}
                  </strong>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    {summaryLocationFriendlyCopy}
                  </p>
                </div>
              </div>
              {canRequestBrowserLocation && !hasConfirmedBrowserLocation ? (
                <a
                  data-testid="sun-location-consent-cta"
                  href="#tap-location-consent"
                  className="mt-2.5 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 text-[10px] font-black text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <span>Compartir ubicación aproximada del teléfono</span>
                  <span className="rounded-full bg-slate-950/40 px-2 py-1 text-[8px] uppercase tracking-[0.1em] text-cyan-200">Opcional · con permiso</span>
                </a>
              ) : null}
              <details className="sun-summary-location-details mt-2 border-t border-white/5 pt-2 text-[9px] text-slate-400">
                <summary className="min-h-8 cursor-pointer list-none py-1.5 font-bold text-slate-300 marker:hidden">
                  Ver fuente y horario
                </summary>
                <div className="space-y-1 pb-1 leading-4">
                  <p className="break-words"><span className="font-bold text-slate-500">Fuente / precisión:</span> <span data-sun-server-evidence="true">{summaryLocationEvidence}</span></p>
                  <p className="break-words"><span className="font-bold text-slate-500">Hora del tap:</span> <span data-sun-datetime={localTapTimeIso || undefined} data-sun-time-zone={result.tapContext?.timezone || undefined} data-sun-server-evidence={(!localTapTimeIso).toString()}>{summaryLocationTime}</span></p>
                  <p>Este resultado corresponde únicamente a este tag y esta lectura.</p>
                </div>
              </details>
            </div>

            <div data-testid="sun-summary-actions" className="sun-summary-actions grid grid-cols-2 gap-2">
              <a
                href="#product-info"
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl bg-white px-2.5 text-center text-[11px] font-black leading-tight text-slate-950 shadow-[0_8px_24px_rgba(255,255,255,0.08)] transition hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Ver producto
                <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              </a>
              <a
                href={!isDemoPreview && isVerifiedOpenedState && isTechnicallyAuthentic
                  ? "#sun-condition"
                  : "#sun-origin"}
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-2 text-center text-[10px] font-black leading-tight text-cyan-100 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {!isDemoPreview && isVerifiedOpenedState && isTechnicallyAuthentic
                  ? "Entender apertura"
                  : "Ver origen y mapa"}
                <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              </a>
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
                  decoding="async"
                  fetchPriority="high"
                />
              ) : (
                <Package aria-hidden="true" />
              )}
              <span>{isDemoPreview ? "Perfil de muestra" : "Perfil oficial del piloto"}</span>
            </div>

            <div className="text-center w-full">
              <span data-sun-server-evidence="true" className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
                {tenantDisplayName}
              </span>
              <h2 data-sun-server-evidence="true" className="text-2xl font-black text-white leading-tight mt-1 tracking-tight">
                {productDisplayName}
              </h2>
              <p data-sun-server-evidence="true" className="text-xs text-slate-400 mt-1 leading-normal">
                {productLine || verticalLabel}
              </p>
            </div>

            {/* Spec grid for fast reading */}
            <div className="w-full mt-5 bg-slate-900/40 rounded-2xl border border-white/5 p-4 grid grid-cols-2 gap-3 text-left">
              <div>
                <span className="text-[9px] uppercase text-slate-500 block">Lote comercial</span>
                <span data-sun-server-evidence="true" className="text-xs font-semibold text-slate-200 mt-0.5 block">{batchDisplay || "No informado"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-slate-500 block">UID del Tag</span>
                <span data-sun-server-evidence="true" className="text-xs font-mono text-slate-200 mt-0.5 block">{visibleUid}</span>
              </div>
              <div className="border-t border-white/5 pt-2.5">
                <span className="text-[9px] uppercase text-slate-500 block">Origen declarado</span>
                <span data-sun-server-evidence="true" className="text-xs font-semibold text-slate-200 mt-0.5 block">{originDisplay}</span>
              </div>
              <div className="border-t border-white/5 pt-2.5">
                <span className="text-[9px] uppercase text-slate-500 block">Lectura</span>
                <span data-sun-server-evidence="true" className="text-xs font-semibold text-slate-200 mt-0.5 block">{tapDisplay}</span>
              </div>
            </div>
          </div>

          <div className="sun-result-card__intro">
            <div className="sun-result-card__icon" aria-hidden="true">
              {isReplay ? <RotateCcw /> : isRiskBlocked || isOpenedAttentionState ? <AlertTriangle /> : <ShieldCheck />}
            </div>
            <div>
              {isDemoPreview && (
                <span className="sun-result-card__demo">{SUN_DEMO_BADGE}</span>
              )}
              <span className="sun-result-card__eyebrow">{consumerSignalLabel}</span>
              <h1 id="sun-result-title" className="brand-editorial-gradient">{friendlyStageTitle}</h1>
              <p>{friendlyStageBody}</p>
            </div>
          </div>

          <ol className="sun-result-journey" aria-label="Datos principales de esta lectura">
            <li>
              <span>01</span>
              <div><small>Lote</small><strong data-sun-server-evidence="true">{batchDisplay}</strong></div>
            </li>
            <li>
              <span>02</span>
              <div><small>Origen informado</small><strong data-sun-server-evidence="true">{originDisplay}</strong></div>
            </li>
            <li>
              <span>03</span>
              <div><small>Lectura</small><strong data-sun-datetime={localTapTimeIso || undefined} data-sun-time-zone={result.tapContext?.timezone || undefined} data-sun-server-evidence={(!localTapTimeIso).toString()}>{localTapTimeLabel || "Registrada ahora"}</strong></div>
            </li>
          </ol>

          <a className="sun-result-card__primary" href={primaryPostTapAction.href}>
            {primaryPostTapAction.label}
            {primaryPostTapAction.href === reportProblemHref
              ? <MessageCircle aria-hidden="true" />
              : <ArrowDown aria-hidden="true" />}
          </a>

          <details className="sun-result-card__details">
            <summary>Ver controles de esta lectura</summary>
            <div className="sun-result-card__controls">
              <div><span>Etiqueta</span><strong>{consumerSignalLabel}</strong></div>
              <div><span>Sello</span><strong>{consumerSealLabel}</strong></div>
              <div><span>Tecnología</span><strong data-sun-server-evidence="true">{carrierLabel}</strong></div>
              <div><span>Indicador técnico</span><strong>{trustScore == null ? "No reportado" : `${trustScore}/100`}</strong></div>
              <div><span>Lote / batch</span><strong data-sun-server-evidence="true">{batchDisplay}</strong></div>
              <div><span>UID del tag</span><strong data-sun-server-evidence="true">{visibleUid}</strong></div>
              <div><span>Origen declarado</span><strong data-sun-server-evidence="true">{originDisplay}</strong></div>
              <div><span>Lectura registrada</span><strong data-sun-server-evidence="true">{tapDisplay}</strong></div>
            </div>
            <p className="sun-result-card__boundary">
              {isManualOpenedState
                ? "La apertura fue declarada por un operador; no fue detectada automáticamente por la etiqueta digital."
                : isVerifiedOpenedState
                ? "La apertura informada proviene de la etiqueta digital; su relación con el envase depende de cómo fue instalada."
                : "Este resultado corresponde a la etiqueta digital. No confirma por sí solo la autenticidad ni el estado del producto físico."}
            </p>
            <p>{replayDecisionText}</p>
            <small>{consumerStatus.headline} · {consumerStatus.label}</small>
          </details>
        </section>

        </> : null}

        {/* 3. A real geographic map: declared origin and this tap, without inferred routes. */}
        <section
          id="sun-origin"
          className="scroll-mt-24 space-y-4 rounded-3xl border border-white/5 bg-slate-900/30 p-4 shadow-lg backdrop-blur-md sm:p-5 md:relative md:left-1/2 md:w-[min(1100px,calc(100vw-3rem))] md:-translate-x-1/2 md:p-6"
          aria-labelledby="sun-origin-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Mapa del pasaporte</span>
              <h3 id="sun-origin-title" className="mt-1 text-lg font-black text-white sm:text-xl">{locationSectionTitle}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">{locationSectionDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.08em]">
              <span className="rounded-full border border-emerald-300/15 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">Origen informado</span>
              <span className="rounded-full border border-cyan-300/15 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">{summaryLocationSourceBadge}</span>
              {hasConsumerComparableDistance
                ? <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-slate-300">{distanceDisplay} lineales</span>
                : null}
            </div>
          </div>

          <SunLocationExperience
            origin={wineryPoint[0] ? {
                id: `origin-${uid || eventId || bid || "public"}`,
                lat: wineryPoint[0].lat,
                lng: wineryPoint[0].lng,
                label: originDisplay,
                evidence: "Coordenada declarada por la empresa; no medida por el NFC.",
                mapHref: originMapHref,
                source: "declared_origin",
              } : null}
              tap={currentTapPoint[0] ? {
                id: `tap-${uid || eventId || bid || "public"}`,
                lat: currentTapPoint[0].lat,
                lng: currentTapPoint[0].lng,
                label: tapDisplay,
                evidence: tapLocationPrecisionLabel,
                mapHref: tapMapHref,
                accuracyM: hasAccuracy ? accuracyM : null,
                source: isDemoPreview
                  ? "demo"
                  : isConsentedBrowserLocationSource(rawLocationSource)
                    || rawLocationSource === "browser_gps"
                    || rawLocationSource === "browser_gps_reported"
                    || rawLocationSource === "ip_geo"
                    || rawLocationSource === "edge_ip_approx"
                      ? rawLocationSource as SunPassportMapLocation["source"]
                      : null,
              } : null}
            showRoute={isDemoPreview}
            distanceLabel={distanceDisplay}
            tapTimeLabel={localTapTimeLabel}
            tapTimeIso={localTapTimeIso}
            tapTimeZone={result.tapContext?.timezone || null}
            telemetry={{
              endpoint: telemetryEndpoint,
              enabled: canRequestBrowserLocation,
              bid,
              uid: uid || null,
              eventId: eventId || null,
              freshToken,
              readCounter: telemetryReadCounter,
              contextStatus: result.status?.code || null,
            }}
          />
        </section>

          <section id="sun-condition" className="scroll-mt-24 space-y-3 rounded-2xl border border-white/5 bg-slate-950/35 p-4" aria-labelledby="sun-condition-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Estado y sensores</span>
                <h3 id="sun-condition-title" className="mt-1 text-sm font-black text-white">Condicion informada del producto</h3>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${sealClosed ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : sealOpened ? "border-amber-300/25 bg-amber-500/10 text-amber-100" : "border-white/10 bg-slate-900 text-slate-300"}`}>
                {sealLabel}
              </span>
            </div>

            {/* IoT evidence: static declarations, measured events and demo JSON remain separate. */}
            {hasSensorEvidence ? (
            <div className="bg-gradient-to-br from-slate-950 to-slate-900/90 rounded-2xl border border-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-amber-300 font-bold">Datos ambientales del producto</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                    {hasReportedSensorEvidence ? "Ultima lectura reportada" : hasDeclaredSensorEvidence ? "Ficha del lote · no es lectura en vivo" : "Muestra demo · no es lectura en vivo"}
                  </span>
                  <span className="mt-1 block text-[9px] text-slate-500">{sensorEvidenceLabel}</span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${usesDemoSensorEvidence ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : hasDeclaredSensorEvidence ? "border-violet-500/30 bg-violet-500/10 text-violet-200" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"}`}>
                  {sensorEvidenceBadge}
                </span>
              </div>
              <dl className="grid gap-2 rounded-xl border border-white/5 bg-slate-950/45 p-3 text-[9px] sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="font-bold uppercase tracking-wider text-slate-500">Fuente</dt>
                  <dd data-sun-server-evidence="true" className="mt-1 break-words font-semibold text-slate-200">{sensorSource || "No informada"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-bold uppercase tracking-wider text-slate-500">Observada</dt>
                  <dd
                    data-sun-datetime={sensorObservedAt || undefined}
                    data-sun-time-zone={result.tapContext?.timezone || undefined}
                    className="mt-1 break-words font-semibold text-slate-200"
                  >
                    {sensorObservedAt ? fmtDate(sensorObservedAt, result.tapContext?.timezone, locale) : "No informada"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-bold uppercase tracking-wider text-slate-500">Modo</dt>
                  <dd data-sun-server-evidence={(!usesDemoSensorEvidence).toString()} className="mt-1 break-words font-semibold text-slate-200">{sensorMode}</dd>
                </div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Temperatura", value: dynamicTemp },
                  { label: "Humedad", value: dynamicHumidity },
                  { label: "Luz", value: dynamicLight },
                  { label: "Impacto", value: dynamicShock },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</span>
                    <span data-sun-server-evidence={(!usesDemoSensorEvidence).toString()} className="mt-1 block text-[11px] font-semibold text-slate-200">{metric.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] leading-relaxed text-slate-500">
                {hasReportedSensorEvidence
                  ? "Un evento recibido identifica fuente y fecha cuando la integración las aporta. No asumimos conexión directa con hardware, tiempo real ni medición del chip NFC pasivo."
                  : "Este bloque proviene de datos configurados, no de un sensor en vivo. Un historial solo aparece cuando llegan eventos con fuente y fecha."}
              </p>
              <details className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-violet-100">Ver JSON normalizado</summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-400">{JSON.stringify(sensorJsonPreview, null, 2)}</pre>
              </details>
              {sensorHistory.length ? (
                <details className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-cyan-100">
                    {hasReportedSensorEvidence
                      ? `Ver lecturas recibidas (${sensorHistory.length})`
                      : hasDeclaredSensorEvidence
                        ? `Ver datos declarados del manifiesto (${sensorHistory.length})`
                        : `Ver eventos de muestra (${sensorHistory.length})`}
                  </summary>
                  <ol className="mt-3 space-y-2">
                    {sensorHistory.map((reading, index) => (
                      <li key={`${reading.at || "sensor"}-${index}`} className="rounded-lg border border-white/5 bg-slate-900/70 p-2 text-[10px] text-slate-300">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong data-sun-server-evidence="true" className="text-white">{reading.source || "Fuente no informada"}</strong>
                          <span
                            data-sun-datetime={reading.at || undefined}
                            data-sun-time-zone={result.tapContext?.timezone || undefined}
                            className="text-slate-500"
                          >
                            {reading.at ? fmtDate(reading.at, result.tapContext?.timezone, locale) : "Fecha no informada"}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-400">
                          {[
                            typeof reading.temperatureC === "number" ? `${reading.temperatureC.toFixed(1)}°C` : null,
                            typeof reading.humidityPct === "number" ? `${reading.humidityPct.toFixed(0)}% HR` : null,
                            reading.lightExposure || null,
                            reading.transitShock || null,
                          ].filter(Boolean).join(" · ") || (hasDeclaredSensorEvidence ? "Ficha sin metricas publicas" : "Evento sin metricas publicas")}
                        </p>
                        {reading.deviceId ? <span className="mt-1 block font-mono text-[9px] text-slate-500">device: {reading.deviceId}</span> : null}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          ) : (
            <div role="status" className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4">
              <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-500">Monitoreo IoT</span>
              <p className="mt-1 text-xs font-semibold text-slate-300">Sin telemetría IoT asociada a este lote.</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                La identidad NFC y la bitácora de eventos siguen disponibles; no inferimos temperatura, humedad ni golpes sin evidencia.
              </p>
            </div>
          )}
          </section>

          {/* Wine content uses producer data, or explicitly labelled Demo Lab fixtures. */}
          {isWineProduct && (
            <div className="bg-slate-950/40 rounded-2xl border border-white/5 p-4 text-xs space-y-4">
              <div className="space-y-1">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Ficha sensorial del productor</span>
                {dynamicTastingNotes ? (
                  <p data-sun-server-evidence="true" className="text-slate-300 italic">“{dynamicTastingNotes}”</p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-500">La marca todavía no cargó una ficha sensorial para este producto.</p>
                )}
                {dynamicMaridaje && (
                  <p className="pt-1 text-[10px] font-medium text-amber-300">Maridaje sugerido: <span data-sun-server-evidence="true">{dynamicMaridaje}</span></p>
                )}
              </div>

              {isDemoPreview && (
                <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-[10px] font-semibold leading-relaxed text-amber-200">
                    Datos simulados del Demo Lab. El perfil y las distinciones siguientes ilustran el formato; no son certificaciones reales.
                  </p>
                  <div className="space-y-2.5 border-t border-amber-500/10 pt-3">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Perfil sensorial simulado</span>
                    {[
                      { label: "Cuerpo / Intensidad", val: 85, desc: "Intenso y estructurado" },
                      { label: "Taninos", val: 70, desc: "Sedosos y redondos" },
                      { label: "Acidez", val: 60, desc: "Fresca y equilibrada" },
                      { label: "Roble", val: 75, desc: "Crianza de ejemplo" },
                      { label: "Fruta negra", val: 90, desc: "Mora y ciruela madura" },
                    ].map((attr) => (
                      <div key={attr.label} className="space-y-1">
                        <div className="flex justify-between gap-3 text-[10px] font-medium text-slate-300">
                          <span>{attr.label}</span>
                          <span className="text-right text-[9px] text-slate-500">{attr.desc}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-slate-950">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                            style={{ width: `${attr.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-amber-500/10 pt-3">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Distinciones ilustrativas</span>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      {["Puntaje demo", "Premio simulado", "Origen de ejemplo"].map((label) => (
                        <span key={label} className="rounded-xl border border-amber-500/20 bg-slate-950/40 p-2 text-[8px] font-bold uppercase tracking-wide text-amber-200">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline points list */}
          <div className="space-y-3 pt-2">
            <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Bitácora de Eventos</span>
            <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-[5px] before:w-[2px] before:bg-slate-800">
              {passportStorySteps.map((step, idx) => (
                <div key={`${step.label}-${step.title}`} className="relative text-xs">
                  <div className={`absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${idx === 3 ? pulseClass : "bg-slate-700"}`} />
                  <span className="block text-[9px] font-mono text-slate-500">{step.label}</span>
                  <span className="block font-bold text-slate-200 mt-0.5">{step.title}</span>
                  <p className="text-slate-400 mt-0.5 leading-normal text-[11px]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

        {/* 4. Services: one clear menu, with protected flows disclosed on demand. */}
        <section id="sun-services" className="scroll-mt-24 space-y-3" aria-label="Servicios y beneficios del producto">
            <div id="consumer-choice" className="scroll-mt-24">
              <SunServicesHub
                promotion={publishedPromotion}
                purchaseHref={tapMarketplaceHref}
                subscribeHref={canSubscribeToBrand ? (showEngagementSuite ? "#qr-engagement" : "#sun-updates-opt-in") : null}
                claimOrManageHref={bid && (uid || eventId) ? protectedServiceHref : registerHref}
                warrantyHref={protectedServiceHref}
                riskState={servicesRiskState}
                freshnessState={servicesFreshnessState}
                policyAvailability={servicePolicyAvailability}
                locale={locale}
                demoIntent={demoLabAction}
              />
            </div>

            {canSubscribeToBrand && !showEngagementSuite ? (
              <SunUpdatesOptIn
                brandName={consumerBrandName}
                productName={productDisplayName}
                tenantSlug={tenantSlug || null}
                eventId={eventId || null}
                bid={bid || null}
              />
            ) : null}

            {isRiskBlocked ? (
              <Link href={reportProblemHref} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 text-sm font-black text-rose-100 transition hover:bg-rose-500/15">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Reportar esta lectura a la marca
              </Link>
            ) : null}

            {!isDemoPreview ? <details className="group rounded-2xl border border-white/10 bg-slate-950/45 p-3">
              <summary className="cursor-pointer list-none text-xs font-black text-slate-200 marker:hidden">
                <span className="flex min-h-11 items-center justify-between gap-3">
                  Como se protege cada accion
                  <span className="text-cyan-300 transition group-open:rotate-180" aria-hidden="true">⌄</span>
                </span>
              </summary>
              <div className="pt-2">
                <PostTapNextStep
                  vertical={`${verticalLabel} ${result.product?.vertical || ""} ${result.product?.category || ""}`}
                  productName={productDisplayName}
                  isFreshTap={isFreshCommercialTap}
                  isSnapshotView={isSnapshotView || isQrScan}
                  protectedTitle={protectedBannerTitle}
                  protectedCopy={protectedBannerCopy}
                  primaryActionHref={bid && (uid || eventId) ? "#protected-actions" : registerHref}
                  rewardsHref={rewardsHref}
                  marketplaceHref={tapMarketplaceHref}
                  certificateHref={certificateHref}
                  walletHref={walletHref}
                  reportProblemHref={reportProblemHref}
                  allowedActions={allowedActions}
                  blockedActions={blockedActions}
                />
              </div>
            </details> : null}

            {isSnapshotView || isQrScan ? (
              <section id="fresh-tap-required" className="scroll-mt-24 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4" aria-labelledby="fresh-tap-required-title">
                <h2 id="fresh-tap-required-title" className="text-sm font-black text-amber-100">{isQrScan ? "Toca el chip NFC para acciones protegidas" : "Hace un nuevo tap desde la etiqueta fisica"}</h2>
                <p className="mt-1 text-xs leading-5 text-amber-50/80">
                  {isQrScan
                    ? "El QR abre contenido y CRM, pero no prueba posesion ni autenticidad criptografica. Acerca el telefono al chip NFC para reclamar, registrar garantia o solicitar tokenizacion."
                    : "Desbloquea el telefono, acerca la zona NFC a la etiqueta y abri el enlace que aparezca. Esta vista historica conserva la evidencia, pero no puede fabricar la frescura criptografica de otro tap."}
                </p>
              </section>
            ) : null}

            {!isDemoPreview && bid && (uid || eventId) ? (
              <div id="protected-actions" className="scroll-mt-24 pt-1">
                <CtaActions
                  bid={bid}
                  uid={uid}
                  eventId={eventId}
                  freshToken={freshToken}
                  canExecute={isFreshCommercialTap}
                  tapState={isQrScan || isSnapshotView || isRiskBlocked ? "blocked" : isVerifiedOpenedState ? "opened" : "valid"}
                  rightsPolicy={result.rightsPolicy || result.condition}
                  allowedActions={allowedActions}
                  blockedActions={blockedActions}
                  isDemoPreview={isDemoPreview}
                />
              </div>
            ) : null}

            {showEngagementSuite ? (
              <div id="qr-engagement" className="scroll-mt-24">
                <QREngagementSuite
                  wineryName={engagementWineryName}
                  productName={productDisplayName}
                  tenantSlug={engagementTenantSlug}
                  eventId={eventId || null}
                  bid={bid || null}
                  allowedActions={allowedActions}
                  blockedActions={blockedActions}
                  initialTab="contact"
                />
              </div>
            ) : null}
        </section>

        {/* 5. Technical Specifications (Accordion) */}
        <section>
          <details className="group border border-white/5 rounded-3xl bg-slate-900/20 backdrop-blur-md overflow-hidden transition-all duration-300">
            <summary className="flex items-center justify-between p-5 cursor-pointer font-bold text-xs text-slate-400 uppercase tracking-widest hover:text-slate-200 select-none">
              <span>Información técnica de la etiqueta</span>
              <span className="transition-transform group-open:rotate-180 duration-300 text-sm">▼</span>
            </summary>
            
            <div className="p-5 pt-0 space-y-4 text-xs border-t border-white/5 bg-slate-950/40">
              
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Identificador del chip</span>
                  <span data-sun-server-evidence="true" className="font-mono text-slate-200">{result.identity?.uid || "Oculto / No disponible"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Lote (Batch ID)</span>
                  <span data-sun-server-evidence="true" className="font-mono text-slate-200">{technicalBid}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Número de lectura</span>
                  <span className="font-mono text-slate-200">{result.identity?.readCounter ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Evidencia CMAC</span>
                  <span data-sun-server-evidence="true" className="font-mono text-slate-200">{result.technical?.raw?.cmacPrefix || "No disponible"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Registro público opcional</span>
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

              {showTtTechnicalEvidence && (
                <div
                  className={`rounded-2xl border p-4 ${
                    ttEvidence.requiresReview
                      ? "border-amber-400/30 bg-amber-400/5"
                      : ttEvidence.available
                        ? "border-emerald-400/25 bg-emerald-400/5"
                        : "border-slate-700 bg-slate-900/50"
                  }`}
                  aria-label="Detalle técnico TagTamper byte por byte"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">Señal electrónica TagTamper</span>
                      <strong className="mt-1 block text-sm text-slate-100">{ttEvidence.label}</strong>
                      <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-400">{ttEvidence.summary}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 font-mono text-[11px] font-bold ${
                      ttEvidence.requiresReview
                        ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                        : ttEvidence.available
                          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                          : "border-slate-600 bg-slate-800 text-slate-300"
                    }`}>
                      TT {ttEvidence.rawHex || "N/D"}
                    </span>
                  </div>

                  {ttEvidence.bytes.length === 2 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {ttEvidence.bytes.map((byte) => (
                        <div key={byte.role} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Byte {byte.index}</span>
                            <code className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-bold text-cyan-200">0x{byte.hex}</code>
                          </div>
                          <span className="mt-2 block text-[10px] text-slate-400">{byte.title}</span>
                          <strong className={`mt-0.5 block text-xs ${
                            byte.state === "invalid" || byte.state === "unknown"
                              ? "text-amber-200"
                              : byte.state === "opened"
                                ? "text-orange-200"
                                : "text-emerald-200"
                          }`}>
                            {byte.label}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-slate-500">
                    {ttEvidence.source && <span>fuente: {ttEvidence.source}</span>}
                    {ttEvidence.offset !== null && <span>offset: {ttEvidence.offset}</span>}
                    {ttEvidence.length !== null && <span>longitud: {ttEvidence.length} bytes</span>}
                  </div>
                  <p className="mt-3 border-t border-white/5 pt-3 text-[10px] leading-relaxed text-slate-500">
                    Este detalle describe la señal electrónica TT reportada por la etiqueta. Por sí solo no prueba el contenido, la custodia ni la integridad física del producto.
                  </p>
                </div>
              )}

              {carrierConsumerCopy && (
                <div data-sun-server-evidence="true" className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 leading-normal text-cyan-200/90 text-[11px]">
                  {carrierConsumerCopy}
                </div>
              )}
            </div>
          </details>
        </section>

      </div>
    </main>
    </SunLocaleProvider>
  );
}
