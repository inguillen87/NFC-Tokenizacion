import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowDown, ExternalLink, AlertTriangle, LockKeyhole, MessageCircle, Package, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { CtaActions } from "./cta-actions";
import { FreshHandoffUrlCleaner } from "./fresh-handoff-url-cleaner";
import { TapPrecisionTelemetry } from "./tap-precision-telemetry";
import { QREngagementSuite } from "./qr-engagement-suite";
import { PostTapNextStep } from "./post-tap-next-step";
import { OfflinePublicProductCache } from "./offline-public-product-cache";
import { AgroDppExperience } from "./agro-dpp-experience";
import { normalizeAgroDppProfile } from "./agro-dpp-model";
import { resolveCommercialTapFreshness, resolvePostTapQuickActionAvailability } from "./post-tap-policy";
import { fmtDistance, haversineKm, selectCanonicalSunMapRoutes } from "./sun-route-distance";
import {
  clusterSunLocationObservations,
  classifySunLocationEvidence,
  CONSENTED_BROWSER_LOCATION_FALLBACK,
  CONSENTED_BROWSER_LOCATION_SOURCE,
  describeSunLocationEvidence,
  resolveSunCurrentTapPlace,
} from "./sun-location-evidence";
import { qualifySunStatusForPreview, selectSunTruthCopy, SUN_DEMO_BADGE, SUN_DEMO_COPY } from "./sun-truth-copy";
import { resolveSunTtEvidence, type SunTtTechnicalInput } from "./sun-tt-evidence";
import { productUrls } from "@product/config";
import { DeviceSignatureBadge, EmptyState, KeyValueSpec, LocaleSwitcher, ThemeToggle, TimelineRail } from "@product/ui";
import { GlobalOpsMap, type GlobalOpsPoint, type GlobalOpsRoute } from "@product/ui/global-ops-map";
import { getWebI18n } from "../../lib/locale";
import { resolveProductAssetProfile } from "../../lib/product-asset-bank";
import { BrandHomeLink } from "../../components/brand-home-link";

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
    sensorEvidenceKind?: "reported" | "simulated" | "none" | string;
    sensorProvenance?: {
      origin?: "tenant_manual" | "csv_import" | "json_import" | "live_sensor" | "event_reported_unknown" | "illustrative_scenario" | "none" | string | null;
      capturedAt?: string | null;
      privacyScope?: string | null;
      responsible?: string | null;
      supportedOrigins?: string[];
    } | null;
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
  technical?: SunCarrierFields & {
    raw?: { piccDataPrefix?: string; encPrefix?: string; cmacPrefix?: string };
    tt?: SunTtTechnicalInput;
  };
};

function fmtDate(value?: string | null, timezone?: string | null) {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || undefined });
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
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat)
    && Number.isFinite(parsedLng)
    && parsedLat >= -90
    && parsedLat <= 90
    && parsedLng >= -180
    && parsedLng <= 180;
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

  const demoProduct = demoProductFromParams(params);

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
    const response = snapshotResult ? null : await fetch(`${resolvedApiBase}/sun?${query.toString()}`, { cache: "no-store" }).catch(() => null);
    const parsedResult = response?.ok
      ? await response.json().catch(() => null) as SunContract | null
      : null;
    result = snapshotResult || parsedResult || sunFallbackResult(params, false);
  }

  const bid = String(result.identity?.bid || params.bid || "");
  const uid = String(result.identity?.uid || "");
  const uidMasked = String(result.identity?.uidMasked || result.identity?.uid || "");
  const eventId = String(result.identity?.eventId || result.eventId || "").trim();
  const statusCode = String(result.status?.code || "").toUpperCase();
  const statusReason = String(result.status?.reason || "").toLowerCase();
  const productState = String(result.status?.productState || "").toUpperCase();
  const ttStatus = String(result.tag_tamper?.status || "").toLowerCase();
  const ttEvidence = resolveSunTtEvidence({
    ...(result.technical?.tt || {}),
    raw: result.technical?.tt?.raw ?? result.tag_tamper?.raw,
    interpretedStatus: result.technical?.tt?.interpretedStatus
      ?? result.status?.tamperStatus
      ?? result.tag_tamper?.status
      ?? productState,
  });
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
    || productState === "VALID_MANUAL_OPENED";
  const isVerifiedOpenedState = ["OPENED", "OPENED_PREVIOUSLY"].includes(statusCode)
    || productState === "VALID_OPENED"
    || productState === "VALID_OPENED_PREVIOUSLY"
    || ttStatus === "opened"
    || ttStatus === "opened_previously";
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
    && !isTamperRisk
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
  const isValid = isTechnicallyAuthentic && !isVerifiedOpenedState && ["VALID", "AUTH_OK"].includes(statusCode);
  const isRiskBlocked = isReplay || isTamperRisk || isSunProfileMismatch || isManualOpenedState || (!isTechnicallyAuthentic && !isQrScan);
  const agroProfile = normalizeAgroDppProfile(result.product?.agro);
  const isAgroDpp = Boolean(agroProfile);
  const engagementBaseEligible = (isQrScan || isFreshCommercialTap || isVerifiedOpenedState) && !isManualOpenedState && !isRiskBlocked && !isSnapshotView;
  const troubleshooting = result.troubleshooting || [];
  const timelinePoints = (result.provenance?.timelineSummary || [])
    .map((item) => {
      const city = item.city || "Unknown city";
      const country = item.country || "--";
      const hasEventCoords = isUsableCoordinate(item.lat, item.lng);
      if (!hasEventCoords) return null;
      return {
        eventId: item.eventId || null,
        city,
        country,
        lat: Number(item.lat),
        lng: Number(item.lng),
        scans: 1,
        risk: String(item.result || "").toLowerCase().includes("replay") || String(item.result || "").toLowerCase().includes("tamper") ? 1 : 0,
        status: item.result || "REVIEW",
        lastSeen: item.at || undefined,
        source: "tap_timeline",
        locationSource: item.locationSource || null,
        accuracyM: item.accuracyM || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const wineryCoordinates = result.iot?.wineryCoordinates;
  const resolvedOriginCoords = isUsableCoordinate(wineryCoordinates?.lat, wineryCoordinates?.lng)
    ? { lat: Number(wineryCoordinates?.lat), lng: Number(wineryCoordinates?.lng) }
    : null;
  const wineryPoint = resolvedOriginCoords
    ? [{
      city: result.product?.winery || "Bodega",
      country: result.provenance?.firstVerified?.country || "AR",
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
  const rawLocationSource = String(result.tapContext?.locationSource || "").toLowerCase();
  const currentTapPlace = resolveSunCurrentTapPlace({
    locationSource: rawLocationSource,
    currentCity: result.tapContext?.city,
    currentCountry: result.tapContext?.country,
    historicalCity: result.provenance?.lastVerifiedLocation?.city || result.provenance?.timelineSummary?.[0]?.city,
    historicalCountry: result.provenance?.lastVerifiedLocation?.country || result.provenance?.timelineSummary?.[0]?.country,
  });
  const currentTapCity = currentTapPlace.city;
  const currentTapCountry = currentTapPlace.country;
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
      lastSeen: result.tapContext?.utcTime || result.tapContext?.localTime || result.provenance?.lastVerifiedLocation?.at || null,
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
    ...(wineryPoint.length && orderedTimelinePoints.length ? [{ fromLat: wineryPoint[0].lat, fromLng: wineryPoint[0].lng, toLat: orderedTimelinePoints[0].lat, toLng: orderedTimelinePoints[0].lng, label: "Origen declarado por la bodega → primer evento registrado", tone: "info" as const }] : []),
    ...(wineryPoint.length && !orderedTimelinePoints.length && currentTapPoint.length ? [{ fromLat: wineryPoint[0].lat, fromLng: wineryPoint[0].lng, toLat: currentTapPoint[0].lat, toLng: currentTapPoint[0].lng, label: "Origen declarado → tap registrado", tone: currentTapPoint[0].risk > 0 ? "warn" as const : "info" as const }] : []),
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
      label: "Origen declarado -> tap registrado",
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
    ? currentTapPlace.display
    : rawLocationSource === CONSENTED_BROWSER_LOCATION_SOURCE
      ? CONSENTED_BROWSER_LOCATION_FALLBACK
    : result.provenance?.lastVerifiedLocation?.city
      ? `${result.provenance.lastVerifiedLocation.city}, ${result.provenance.lastVerifiedLocation.country || "--"}`
      : "Tap actual no geolocalizado";
  const accuracyM = Number(result.tapContext?.accuracyM);
  const hasAccuracy = Number.isFinite(accuracyM) && accuracyM > 0;
  const tapLocationEvidenceKind = classifySunLocationEvidence(rawLocationSource, hasCurrentTapCoords);
  const tapLocationPrecisionLabel = describeSunLocationEvidence(tapLocationEvidenceKind, hasAccuracy ? accuracyM : null);
  const tapLocationSourceDetail = rawLocationSource === "browser_gps_approximate_consent"
    ? "Compartida con permiso y redondeada antes de guardarse"
    : rawLocationSource === "edge_ip_approx" || rawLocationSource === "ip_geo"
      ? "Estimada por red/IP; no es GPS del dispositivo"
      : tapLocationEvidenceKind === "measured"
        ? "Fuente de medición informada por la API SUN"
        : hasCurrentTapCoords
          ? "Coordenada reportada; la API no informó precisión"
          : rawLocationSource.includes("error") || rawLocationSource.includes("denied")
            ? "El dispositivo no compartió ubicación"
            : "No se recibió un par WGS84 válido";
  const originLocationLabel = describeSunLocationEvidence(
    classifySunLocationEvidence("brand_profile", Boolean(resolvedOriginCoords), { declared: true }),
  );
  const distanceDisplay = fmtDistance(originToTapDistance);
  const sensorSnapshot = result.iot?.sensorSnapshot;
  const sensorEvidenceKind = String(result.iot?.sensorEvidenceKind || "none").toLowerCase();
  const hasReportedSensorEvidence = Boolean(
    sensorEvidenceKind === "reported"
    && (sensorSnapshot?.cellarTemperature || sensorSnapshot?.humidity || sensorSnapshot?.lightExposure || sensorSnapshot?.transitShock),
  );
  const usesDemoSensorEvidence = isDemoPreview && !hasReportedSensorEvidence;
  const hasSensorEvidence = hasReportedSensorEvidence || usesDemoSensorEvidence;
  const sensorProvenance = result.iot?.sensorProvenance;
  const sensorOriginLabels: Record<string, string> = {
    tenant_manual: "Carga manual del tenant",
    csv_import: "Importación CSV",
    json_import: "Importación JSON",
    live_sensor: "Sensor conectado",
    event_reported_unknown: "Fuente reportada sin clasificar",
    illustrative_scenario: "Escenario ilustrativo",
    none: "Sin fuente",
  };
  const sensorOriginLabel = sensorOriginLabels[String(sensorProvenance?.origin || (usesDemoSensorEvidence ? "illustrative_scenario" : "none"))]
    || "Fuente informada por el tenant";
  const sensorPrivacyLabel = String(sensorProvenance?.privacyScope || "not_reported") === "public"
    ? "Público"
    : String(sensorProvenance?.privacyScope || "not_reported") === "tenant_only"
      ? "Sólo tenant"
      : String(sensorProvenance?.privacyScope || "not_reported") === "not_applicable"
        ? "No aplica"
        : "No informada";
  const sensorCapturedAtLabel = sensorProvenance?.capturedAt ? fmtDate(sensorProvenance.capturedAt) : "Fecha no informada";
  const sensorEvidenceLabel = hasReportedSensorEvidence ? "Telemetría reportada" : "Datos simulados del Demo Lab";
  const dynamicTemp = sensorSnapshot?.cellarTemperature || (usesDemoSensorEvidence ? "15.2°C" : "N/A");
  const dynamicHumidity = sensorSnapshot?.humidity || (usesDemoSensorEvidence ? "62%" : "N/A");
  const dynamicShock = sensorSnapshot?.transitShock || (usesDemoSensorEvidence ? "Sin golpes críticos en la simulación" : "N/A");
  const hasDeclaredTastingProfile = Boolean(result.product?.notes || result.product?.tasting_notes || result.product?.maridaje);
  const usesDemoTastingProfile = isDemoPreview && !hasDeclaredTastingProfile;
  const dynamicTastingNotes = result.product?.notes
    || result.product?.tasting_notes
    || (usesDemoTastingProfile ? "Entrada dulce y carnosa, taninos maduros y final persistente." : null);
  const dynamicMaridaje = result.product?.maridaje
    || (usesDemoTastingProfile ? "Carnes asadas, pastas intensas o quesos curados." : null);
  const mapUid = uid || uidMasked || bid || "sun-public-tap";
  const mapTenant = String(result.identity?.tenantSlug || "public");
  const mapProductName = result.product?.name || result.identity?.bid || "Producto conectado";
  const mapTimelineSummary = result.provenance?.timelineSummary || [];
  const firstMapSeenAt = result.provenance?.firstVerified?.at || mapTimelineSummary[mapTimelineSummary.length - 1]?.at || "";
  const lastMapSeenAt = result.provenance?.lastVerifiedLocation?.at || mapTimelineSummary[0]?.at || "";
  const rawReportedScanCount = Number(result.identity?.scanCount);
  const hasReportedScanCount = Number.isFinite(rawReportedScanCount) && rawReportedScanCount >= 0;
  const reportedScanCount = hasReportedScanCount ? rawReportedScanCount : 0;
  const observedLocationClusters = clusterSunLocationObservations([
    ...timelinePoints.map((point, index) => ({
      id: `timeline-${index}`,
      eventId: point.eventId,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      at: point.lastSeen,
      result: point.status,
      source: point.locationSource,
      accuracyM: point.accuracyM,
    })),
    ...currentTapPoint.map((point) => ({
      id: `current-${eventId || "tap"}`,
      eventId: point.eventId,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      at: point.lastSeen,
      result: point.status,
      source: point.locationSource,
      accuracyM: point.accuracyM,
      current: true,
    })),
  ]);
  const observedEventCount = observedLocationClusters.reduce((sum, point) => sum + point.count, 0);
  const observedMapPoints: GlobalOpsPoint[] = observedLocationClusters.map((point) => ({
    id: point.id,
    city: point.city,
    country: point.country,
    lat: point.lat,
    lng: point.lng,
    scans: point.count,
    risk: point.risk,
    verdict: point.result,
    tenantSlug: mapTenant,
    lastSeen: point.lastSeen,
    uid: mapUid,
    device: point.sourceLabel,
    accuracyM: point.accuracyM,
    role: point.current ? "tap" as const : "hub" as const,
    productName: mapProductName,
  }));
  const hasConsentedDeviceLocation = rawLocationSource === CONSENTED_BROWSER_LOCATION_SOURCE && currentTapPoint.length > 0;
  const consumerCurrentTapMapPoints: GlobalOpsPoint[] = hasConsentedDeviceLocation
    ? currentTapPoint.map((point, index) => ({
      id: `consumer-tap-${eventId || index}`,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      scans: 1,
      risk: point.risk,
      verdict: point.status,
      tenantSlug: mapTenant,
      lastSeen: point.lastSeen || "",
      uid: mapUid,
      device: "Zona compartida por este teléfono",
      role: "tap" as const,
      productName: mapProductName,
      locationSource: point.locationSource || CONSENTED_BROWSER_LOCATION_SOURCE,
      locationAccuracyM: point.accuracyM,
      accuracyM: point.accuracyM,
    }))
    : [];
  const demoOriginMapPoints: GlobalOpsPoint[] = wineryPoint.map((point, index) => ({
      id: `origin-${mapUid}-${index}`,
      city: point.city,
      country: point.country,
      lat: point.lat,
      lng: point.lng,
      scans: 0,
      risk: 0,
      verdict: "ORIGIN",
      tenantSlug: mapTenant,
      lastSeen: firstMapSeenAt,
      uid: mapUid,
      device: "producer",
      role: "origin" as const,
      productName: mapProductName,
    }));
  const opsMapPoints = isDemoPreview ? [...demoOriginMapPoints, ...observedMapPoints] : observedMapPoints;
  const canonicalMapRoutes = selectCanonicalSunMapRoutes(originToCurrentTapRoute, mapRoutes);
  const opsMapRoutes: GlobalOpsRoute[] = canonicalMapRoutes.map((route, index) => ({
    id: `sun-route-${mapUid}-${index}`,
    fromLat: route.fromLat,
    fromLng: route.fromLng,
    toLat: route.toLat,
    toLng: route.toLng,
    uid: mapUid,
    risk: route.tone === "warn" ? 1 : 0,
    taps: observedEventCount,
    firstSeenAt: firstMapSeenAt,
    lastSeenAt: lastMapSeenAt,
    fromLabel: index === 0 ? originDisplay : undefined,
    toLabel: index === canonicalMapRoutes.length - 1 ? tapDisplay : undefined,
    productName: route.label || mapProductName,
  }));
  const livePillLabel = isDemoPreview ? "Muestra demo" : isQrScan ? "Ficha QR" : isFreshHandoff ? "Lectura nueva" : isSnapshotView ? "Consulta guardada" : "Etiqueta NFC";
  const rawPrimaryStatusLabel = isQrScan
    ? "QR / Ficha Informativa"
    : isValid
      ? "SUN VÁLIDO · TT CERRADO"
      : isManualOpenedState
        ? "APERTURA DECLARADA POR OPERADOR"
      : isVerifiedOpenedState && isTechnicallyAuthentic
        ? "ETIQUETA VÁLIDA · APERTURA INFORMADA"
        : isReplay
          ? "REPLAY / ENLACE REUTILIZADO"
          : isSunProfileMismatch
            ? "PERFIL DESALINEADO"
            : "ALERTA DE SEGURIDAD";
  const primaryStatusLabel = qualifySunStatusForPreview(isDemoPreview, rawPrimaryStatusLabel);

  const securityTone = isValid
    ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
    : isOpenedAttentionState
      ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : isSunProfileMismatch
        ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : "border-rose-300/20 bg-rose-500/10 text-rose-100";
  const apiQualityScore = typeof result.quality?.score === "number" ? result.quality.score : Number.NaN;
  const trustScore = Number.isFinite(apiQualityScore)
    ? Math.max(0, Math.min(100, apiQualityScore))
    : null;
  const trustTone = trustScore == null
    ? "text-slate-300"
    : trustScore >= 85
      ? "text-emerald-200"
      : trustScore >= 65
        ? "text-amber-200"
        : "text-rose-200";
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
    : isManualOpenedState
    ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
    : isRiskBlocked
    ? "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]"
    : isOpenedAttentionState
      ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
      : "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]";
  const statusHeadline = isSunProfileMismatch
    ? "No pudimos validar esta lectura."
    : ttStatus === "closed" || productState === "VALID_CLOSED"
    ? "Mensaje SUN válido. Estado TT cerrado reportado."
    : ttStatus === "opened" || ttStatus === "opened_previously" || productState === "VALID_OPENED" || productState === "VALID_OPENED_PREVIOUSLY"
      ? "Mensaje SUN válido. Estado TT abierto reportado."
    : ttStatus === "invalid"
      ? "TagTamper no inicializado o configuración inválida."
    : productState === "VALID_MANUAL_OPENED"
      ? "Un operador registró el estado abierto; no proviene de la medición criptográfica del sello."
    : productState === "VALID_OPENED"
      ? "Mensaje SUN válido. Estado TT abierto reportado."
    : productState === "VALID_UNKNOWN_TAMPER" || ttStatus === "not_available"
        ? "Mensaje SUN válido. Estado TT no disponible."
        : result.status?.code === "REPLAY_SUSPECT"
          ? "Este payload ya fue usado. Escaneá físicamente la etiqueta para generar una nueva lectura."
          : result.status?.tone === "good"
            ? "Mensaje NFC validado"
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
    : isManualOpenedState
      ? "Apertura declarada por operador"
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
  const displayStatusHeadline = isDemoPreview
    ? "Simulación guiada: mensaje SUN válido y estado TT abierto."
    : isQrScan
      ? "Ficha publica QR / SDK"
      : rightsTitle || (isManualOpenedState
        ? "Un operador registró una apertura."
        : isVerifiedOpenedState && isTechnicallyAuthentic
          ? "La etiqueta digital informa una apertura."
          : statusHeadline);
  const reportProblemHref = bid && (uid || eventId)
    ? "#report-action"
    : "/?contact=sales&intent=sun_mobile#contact-modal";
  const productSectionHref = isAgroDpp ? "#agro-dpp" : "#product-info";
  const consumerActionHref = isAgroDpp ? "#agro-dpp" : "#consumer-choice";
  const recommendedAction = isFreshCommercialTap
    ? { label: "Ver ficha y opciones", href: consumerActionHref, helper: rightsPolicy.recommendedNextStep || "No hace falta registrarse para leer la ficha. Contacto, club, garantia y propiedad son pasos opt-in separados." }
    : isSnapshotView
      ? { label: "Ver ficha", href: productSectionHref, helper: "Consulta segura: evidencia digital y registros declarados quedan visibles. Acciones sensibles requieren otro tap físico." }
    : isSunProfileMismatch
      ? { label: "Avisar a soporte", href: reportProblemHref, helper: "El producto y el lote quedan visibles. Garantia, club o tokenizacion esperan el perfil SUN correcto o el payload del proveedor." }
    : !isRiskBlocked && isTechnicallyAuthentic
      ? { label: "Ver detalles de trazabilidad", href: "#geo-trace", helper: "Revisá ruta y consistencia antes de guardar." }
      : { label: "Reportar y reintentar tap", href: reportProblemHref, helper: "Señal de riesgo alta. Escaneá físicamente de nuevo." };
  const tenantSlug = String(result.identity?.tenantSlug || "").trim();
  // Keep browser geolocation same-origin. The proxy validates and forwards the
  // signed fresh-tap capability without exposing a permissive CORS surface.
  const telemetryEndpoint = "/api/sun-context";
  const marketplaceHref = tenantSlug ? `/me/marketplace?tenant=${encodeURIComponent(tenantSlug)}` : "/me/marketplace";
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
  const sealOpened = ttStatus === "opened" || ttStatus === "opened_previously" || productState === "VALID_OPENED" || productState === "VALID_OPENED_PREVIOUSLY";
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
    ? "Producto y lote declarados en plataforma. La activacion comercial queda pendiente porque el perfil SUN del batch no coincide con la lectura fisica registrada."
    : isReplay
    ? "Replay detectado: esta URL/SUN ya fue usada. Garantia, rewards y tokenizacion quedan bloqueados hasta un nuevo tap fisico."
    : isSnapshotView
      ? "Consulta segura: la prueba queda disponible para revisar y compartir. Para sumar puntos, activar garantia o mintear, toca otra vez la etiqueta."
    : isValid
      ? rightsSummary || (isCryptoCarrier
        ? "Lectura fresca: UID, contador SUN y CMAC pasan la politica anti-replay."
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
  const sealLabel = sealClosed
    ? "TT cerrado reportado"
    : isManualOpenedState
      ? "Apertura declarada por operador"
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
  const productDisplayName = assetProfile.productName || productName;
  const isWineProduct = [result.product?.vertical, result.tenant?.vertical, productDisplayName]
    .some((value) => /\b(wine|vino|malbec|reserva|bodega)\b/i.test(String(value || "")));
  const showEngagementSuite = engagementBaseEligible && isWineProduct && !isOpenedAttentionState;
  const engagementWineryName = requestedBrandDisplay || result.product?.winery || "Bodega Premium";
  const engagementTenantSlug = readParam(params, "tenant") || tenantSlug || "demobodega";
  const productHeroImageUrl = assetProfile.primaryImageUrl || productImageUrl;
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
    { label: "Lote", value: batchDisplay },
    { label: isQrScan ? "Canal" : "Chip", value: carrierLabel },
    { label: "UID", value: visibleUid },
    { label: "Origen declarado", value: originDisplay },
    { label: "Tap", value: tapDisplay },
    { label: "Distancia", value: distanceDisplay },
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
    ? "Necesitamos un nuevo toque"
    : isVerifiedOpenedState
      ? "El sello registra una apertura"
      : isSnapshotView
        ? "Información del producto disponible"
        : sealClosed && isTechnicallyAuthentic
          ? "El sello no registra aperturas"
          : isTechnicallyAuthentic
            ? "Etiqueta digital verificada"
            : "Lectura recibida";
  const friendlyStageBody = isDemoPreview
    ? SUN_DEMO_COPY.stageBody
    : isQrScan
      ? "Con el QR podés conocer el producto y acceder a las opciones que la marca dejó disponibles. Garantía o titularidad requieren una validación adicional."
      : isSunProfileMismatch
    ? "Reconocimos el producto y el lote, pero no pudimos completar los controles de esta lectura. La información sigue visible y las acciones sensibles quedan protegidas."
    : isManualOpenedState
    ? "La apertura fue declarada por un operador. No fue detectada automáticamente por el sello; si no la reconocés o el envase está dañado, no uses el producto y avisá para revisión."
    : isRiskBlocked
    ? "Este enlace ya había sido usado. Acercá nuevamente el teléfono a la etiqueta para obtener una lectura nueva y continuar con seguridad."
    : isVerifiedOpenedState
      ? isSnapshotView
        ? "Esta lectura anterior informa una apertura del sello. Para confirmar el estado actual, acercá otra vez el teléfono a la etiqueta."
        : "La etiqueta digital pasó los controles, pero informa que el sello asociado fue abierto. Si vos no lo abriste o el envase está dañado, no uses el producto y avisá a la marca."
      : isSnapshotView
        ? "Podés revisar la ficha y la información disponible. Para activar garantía o beneficios, tocá nuevamente la etiqueta."
        : sealClosed && isTechnicallyAuthentic
          ? "La etiqueta digital pasó los controles y no informa una apertura del sello. Podés conocer el producto y, si ya lo compraste, activar garantía, beneficios o atención de la marca."
          : "Conocé el producto, revisá la información disponible y elegí cómo seguir. No necesitás registrarte para ver la ficha.";
  const primaryPostTapAction = isQrScan && isAgroDpp
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
      detail: originToTapDistance != null ? distanceDisplay : "Sin geo",
      state: originToTapDistance != null ? "done" : "warn",
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
      { label: "Lote informado", ok: Boolean(batchDisplay) },
      { label: "Lead opt-in", ok: true },
      { label: "Propiedad protegida", ok: true },
      { label: "NFC premium pendiente", ok: false },
    ]
    : [
      { label: "Tap fresco", ok: isFreshCommercialTap },
      { label: "Perfil SUN correcto", ok: !isSunProfileMismatch },
      { label: "Chip valido", ok: isTechnicallyAuthentic },
      { label: "Estado TT compatible", ok: !isTamperRisk },
      { label: "Coordenadas comparables", ok: originToTapDistance != null },
      { label: trustScore == null ? "Score no reportado" : "Score de calidad informado", ok: trustScore != null && !isRiskBlocked && trustScore >= 65 },
    ];
  const passportStorySteps = [
    {
      label: "Declaró",
      title: result.product?.region || result.provenance?.origin || "Origen no declarado",
      body: "La marca cargó el origen declarado, el lote, el producto y sus reglas antes de salir al canal.",
    },
    {
      label: "Se registró",
      title: `${originDisplay} -> ${tapDisplay}`,
      body: `${distanceDisplay} de distancia lineal entre el origen declarado y el tap registrado; no prueba el recorrido físico.`,
    },
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
    <main className="nexid-sun-page min-h-screen bg-[#060813] text-slate-100 flex flex-col items-center py-4 sm:py-8 px-4 font-sans relative overflow-hidden pb-32">
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

      <div className="w-full max-w-[430px] z-10 space-y-5 mx-auto">
        
        {/* Modern minimal top bar */}
        <header className="sun-passport-topbar flex items-center justify-between gap-2 px-2.5 py-2 mb-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandHomeLink locale={locale} size={36} />
            <span className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 sm:block">
              {isQrScan ? "pasaporte QR" : "pasaporte NFC"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LocaleSwitcher value={locale} options={locales as any} />
            <ThemeToggle locale={locale} />
            <div className="sun-passport-live hidden items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/5 backdrop-blur-md sm:flex">
              <span className={`w-2 h-2 rounded-full ${pulseClass} animate-pulse`} />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">{livePillLabel}</span>
            </div>
          </div>
        </header>

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
        {/* 1. Consumer-first result. Technical evidence stays available on demand. */}
        <section id="product-info" className={`sun-result-card sun-result-card--${consumerResultTone}`} aria-labelledby="sun-result-title">
          <div className="sun-result-card__product">
            <div className="sun-result-card__media">
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
            <div className="sun-result-card__identity">
              <small>{tenantDisplayName}</small>
              <strong>{productDisplayName}</strong>
              <span>{productLine || verticalLabel}</span>
              <div><em>{batchDisplay}</em></div>
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
              <div><small>Lote</small><strong>{batchDisplay}</strong></div>
            </li>
            <li>
              <span>02</span>
              <div><small>Origen informado</small><strong>{originDisplay}</strong></div>
            </li>
            <li>
              <span>03</span>
              <div><small>Lectura</small><strong>{localTapTimeLabel || "Registrada ahora"}</strong></div>
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
              <div><span>Tecnología</span><strong>{carrierLabel}</strong></div>
              <div><span>Indicador técnico</span><strong>{trustScore == null ? "No reportado" : `${trustScore}/100`}</strong></div>
              <div><span>Lote / batch</span><strong>{batchDisplay}</strong></div>
              <div><span>UID del tag</span><strong>{visibleUid}</strong></div>
              <div><span>Origen declarado</span><strong>{originDisplay}</strong></div>
              <div><span>Lectura registrada</span><strong>{tapDisplay}</strong></div>
            </div>
            <p className="sun-result-card__boundary">
              {isManualOpenedState
                ? "La apertura fue declarada por un operador; no fue detectada automáticamente por la etiqueta digital."
                : isVerifiedOpenedState
                ? "La apertura informada proviene de la etiqueta digital; su relación con el envase depende de cómo fue instalada."
                : "Este resultado corresponde a la etiqueta digital. No confirma por sí solo la autenticidad ni el estado del producto físico."}
            </p>
            <p>{replayDecisionText}</p>
            <small>{displayStatusHeadline} · {primaryStatusLabel}</small>
          </details>
        </section>

        <TapPrecisionTelemetry
          endpoint={telemetryEndpoint}
          enabled={!isQrScan && !isSnapshotView && Boolean(eventId)}
          bid={bid}
          uid={uid || null}
          eventId={eventId || null}
          freshToken={freshToken}
          readCounter={typeof result.identity?.readCounter === "number" ? result.identity.readCounter : null}
          contextStatus={result.status?.code || null}
        />

        </> : null}

        {/* 2. Contextual, policy-aware post-tap journey */}
        {!isAgroDpp ? <section id="consumer-choice" className="space-y-3">
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
            sealState={isVerifiedOpenedState ? "opened" : sealClosed ? "closed" : "unknown"}
            allowedActions={allowedActions}
            blockedActions={blockedActions}
          />

          {isSnapshotView || isQrScan || isRiskBlocked ? (
            <section id="fresh-tap-required" className="scroll-mt-24 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4" aria-labelledby="fresh-tap-required-title">
              <h2 id="fresh-tap-required-title" className="text-sm font-black text-amber-100">
                {isQrScan ? "Acercá el teléfono a la etiqueta NFC" : "Cómo hacer una lectura nueva"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-amber-50/80">
                {isQrScan
                  ? "Desbloqueá el teléfono, acercalo a la etiqueta y abrí la notificación. El QR sirve para informarte; la etiqueta NFC permite realizar los controles de una lectura nueva."
                  : isSunProfileMismatch
                    ? "Acercá nuevamente el teléfono a la etiqueta y abrí la notificación. Si vuelve a aparecer este aviso, la marca debe revisar la configuración del lote; tus datos y la información del producto siguen protegidos."
                    : "Desbloqueá el teléfono, acercá la zona NFC a la etiqueta y abrí la notificación que aparezca. No recargues ni reutilices este mismo enlace: cada toque físico genera una lectura nueva."}
              </p>
            </section>
          ) : null}

          {/* Secure CTAs actions integration */}
          {bid && (uid || eventId) && (
            <div id="protected-actions" className="scroll-mt-24 pt-1">
              <CtaActions
                bid={bid}
                uid={uid}
                eventId={eventId}
                freshToken={freshToken}
                canExecute={isFreshCommercialTap}
                tapState={isManualOpenedState ? "manual_opened" : isQrScan || isSnapshotView || isRiskBlocked ? "blocked" : isVerifiedOpenedState ? "opened" : "valid"}
                rightsPolicy={result.rightsPolicy || result.condition}
                allowedActions={allowedActions}
                blockedActions={blockedActions}
                isDemoPreview={isDemoPreview}
              />
            </div>
          )}

          {/* Sommelier and trivia for QR or verified NFC taps */}
          {showEngagementSuite && (
            <details id="qr-engagement" className="group scroll-mt-24 overflow-hidden rounded-2xl border border-violet-300/20 bg-violet-500/5">
              <summary className="cursor-pointer list-none px-4 py-4 text-sm font-black text-violet-100 marker:content-none">
                Tu experiencia con {tenantDisplayName}
                <span className="mt-1 block text-[11px] font-normal leading-5 text-slate-400">Beneficios, puntos y recomendaciones opcionales.</span>
              </summary>
              <div className="border-t border-violet-300/10 p-2">
                <QREngagementSuite
                  wineryName={engagementWineryName}
                  productName={productDisplayName}
                  tenantSlug={engagementTenantSlug}
                  eventId={eventId || null}
                  bid={bid || null}
                  allowedActions={allowedActions}
                  blockedActions={blockedActions}
                />
              </div>
            </details>
          )}

        </section> : null}

        {/* 4. Location is optional and progressive. IP-derived coordinates are
            never rendered as the phone position. */}
        <details id="geo-trace" className="sun-location-section group scroll-mt-24 overflow-hidden rounded-3xl border border-white/5 bg-slate-900/30 backdrop-blur-md shadow-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Ubicación y evidencia</span>
              <strong className="mt-1 block text-sm text-white">
                {hasConsentedDeviceLocation ? "Zona de este teléfono registrada" : "Ubicación del teléfono sin confirmar"}
              </strong>
              <small className="mt-1 block text-[10px] font-normal leading-4 text-slate-400">
                {hasConsentedDeviceLocation ? "Abrí para ver el mapa y la fuente del dato." : "No usamos la ubicación por IP como si fuera la del teléfono."}
              </small>
            </span>
            <ArrowDown className="h-4 w-4 shrink-0 text-cyan-300 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>

          <div className="space-y-4 border-t border-white/5 p-5">
            <div>
              <h2 className="text-lg font-black text-white">Fuentes de ubicación</h2>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Separamos la zona compartida por este teléfono del origen que informó la marca. No inferimos un recorrido físico entre ambos puntos.
              </p>
            </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <article className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-cyan-300">Este toque</span>
                  <strong className="mt-1 block text-sm text-white">{hasConsentedDeviceLocation ? tapDisplay : "Zona no compartida"}</strong>
                </div>
                <span className="rounded-full border border-cyan-300/25 px-2 py-1 text-[9px] font-bold text-cyan-100">{hasConsentedDeviceLocation ? "COMPARTIDA" : "OPCIONAL"}</span>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-cyan-100">{hasConsentedDeviceLocation ? tapLocationPrecisionLabel : "El teléfono todavía no compartió su zona"}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">{hasConsentedDeviceLocation ? tapLocationSourceDetail : "La estimación por red queda fuera del mapa público para evitar un pin engañoso."}</p>
              {hasConsentedDeviceLocation && tapMapHref ? (
                <a href={tapMapHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/25 bg-white/5 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                  Abrir en el mapa <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </article>

            <article className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">Origen informado por la marca</span>
                  <strong className="mt-1 block text-sm text-white">{originDisplay}</strong>
                </div>
                <span className="rounded-full border border-emerald-300/25 px-2 py-1 text-[9px] font-bold text-emerald-100">{resolvedOriginCoords ? "DECLARADA" : "SIN GEO"}</span>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-emerald-100">{originLocationLabel}</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">Es un dato declarado. No demuestra dónde está el producto ahora ni cómo llegó hasta allí.</p>
              {originMapHref ? (
                <a href={originMapHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300/25 bg-white/5 px-3 text-xs font-bold text-emerald-100 transition hover:bg-emerald-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                  Ver origen en el mapa <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </article>
          </div>

          <div id="tap-location-map" className="sun-consumer-map-shell rounded-2xl overflow-hidden border border-white/5 p-2">
            {(isDemoPreview ? opsMapPoints : consumerCurrentTapMapPoints).length ? (
              <GlobalOpsMap
                title={isDemoPreview ? "Escenario geográfico del Demo Lab" : "Zona compartida por este teléfono"}
                subtitle={isDemoPreview ? "Datos simulados y claramente identificados" : "Una ubicación aproximada, con su margen de precisión"}
                points={isDemoPreview ? opsMapPoints : consumerCurrentTapMapPoints}
                routes={isDemoPreview ? opsMapRoutes : []}
                mode={isDemoPreview ? "demo" : "global"}
                selectedPointId={(isDemoPreview ? opsMapPoints : consumerCurrentTapMapPoints).find((point) => point.role === "tap")?.id}
                playbackEnabled={isDemoPreview}
                chrome={isDemoPreview ? "full" : "consumer"}
                initialView="events"
                allowViewToggle={false}
                sourceLabel={isDemoPreview ? "Demo Lab · datos simulados" : "Zona aproximada compartida con permiso"}
                locationNote={isDemoPreview ? "Escenario ilustrativo; no representa lecturas reales." : `${tapLocationPrecisionLabel}. ${tapLocationSourceDetail}.`}
              />
            ) : (
              <div className="px-5 py-8 text-center" role="status">
                <span aria-hidden="true" className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300/20 bg-white/5 text-lg">⌖</span>
                <p className="mt-3 text-sm font-black text-slate-200">El mapa espera permiso del teléfono</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Usá “Usar mi zona actual” arriba. Hasta entonces no dibujamos una estimación por IP como si fuera tu ubicación.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
            <div className="bg-slate-950/60 rounded-xl border border-white/5 p-2">
              <span className="text-[8px] uppercase text-slate-500 block">Lecturas ubicadas</span>
              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{observedEventCount}</span>
            </div>
            <div className="bg-slate-950/60 rounded-xl border border-white/5 p-2">
              <span className="text-[8px] uppercase text-slate-500 block">Historial informado</span>
              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{hasReportedScanCount ? reportedScanCount : timelineCount || "N/D"}</span>
            </div>
            <div className="bg-slate-950/60 rounded-xl border border-white/5 p-2">
              <span className="text-[8px] uppercase text-slate-500 block">Distancia lineal</span>
              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{distanceDisplay}</span>
            </div>
          </div>
          <p className="text-[10px] leading-4 text-slate-500">La distancia une dos coordenadas como referencia matemática; no reconstruye transporte, custodia ni movimiento del producto.</p>

          {/* IoT evidence: a snapshot is never presented as a fabricated time series. */}
          {hasSensorEvidence ? (
            <div className="bg-gradient-to-br from-slate-950 to-slate-900/90 rounded-2xl border border-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-amber-300 font-bold">Monitoreo IoT en tránsito</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 block">{hasReportedSensorEvidence ? "Ultima lectura reportada por metrica" : "Muestra simulada del Demo Lab"}</span>
                  <span className="mt-1 block text-[9px] text-slate-500">{sensorEvidenceLabel}</span>
                  {hasReportedSensorEvidence ? (
                    <span className="mt-1 block text-[9px] leading-4 text-slate-500">
                      {sensorOriginLabel} · {sensorCapturedAtLabel} · Responsable: {sensorProvenance?.responsible || "no informado"} · Visibilidad: {sensorPrivacyLabel}
                    </span>
                  ) : null}
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${usesDemoSensorEvidence ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"}`}>
                  {usesDemoSensorEvidence ? "SIMULADO" : "REPORTADO"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { label: "Temperatura", value: dynamicTemp },
                  { label: "Humedad", value: dynamicHumidity },
                  { label: "Impacto", value: dynamicShock },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-slate-200">{metric.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] leading-relaxed text-slate-500">
                Esta tarjeta muestra una muestra puntual. Un historial sólo se publica cuando el lote aporta una serie temporal verificable.
              </p>
            </div>
          ) : null}

          {/* Wine content uses producer data, or explicitly labelled Demo Lab fixtures. */}
          {isWineProduct && (
            <div className="bg-slate-950/40 rounded-2xl border border-white/5 p-4 text-xs space-y-4">
              <div className="space-y-1">
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Ficha sensorial del productor</span>
                {dynamicTastingNotes ? (
                  <p className="text-slate-300 italic">“{dynamicTastingNotes}”</p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-500">La marca todavía no cargó una ficha sensorial para este producto.</p>
                )}
                {dynamicMaridaje && (
                  <p className="pt-1 text-[10px] font-medium text-amber-300">Maridaje sugerido: {dynamicMaridaje}</p>
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
                <div key={step.label} className="relative text-xs">
                  <div className={`absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${idx === 3 ? pulseClass : "bg-slate-700"}`} />
                  <span className="block text-[9px] font-mono text-slate-500">{step.label}</span>
                  <span className="block font-bold text-slate-200 mt-0.5">{step.title}</span>
                  <p className="text-slate-400 mt-0.5 leading-normal text-[11px]">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </details>

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
                  <span className="font-mono text-slate-200">{result.identity?.uid || "Oculto / No disponible"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Lote digital</span>
                  <span className="font-mono text-slate-200">{bid || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Número de lectura</span>
                  <span className="font-mono text-slate-200">{result.identity?.readCounter ?? "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500">Evidencia CMAC</span>
                  <span className="font-mono text-slate-200">{result.technical?.raw?.cmacPrefix || "No disponible"}</span>
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
                <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 leading-normal text-cyan-200/90 text-[11px]">
                  {carrierConsumerCopy}
                </div>
              )}
            </div>
          </details>
        </section>

      </div>

      {/* Fixed Bottom Quick Nav Bar */}
      <nav className="sun-bottom-nav fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-3 z-30 lg:hidden" aria-label="Accesos rápidos del pasaporte">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-slate-950/80 p-2 backdrop-blur-xl shadow-xl">
          <a href={productSectionHref} className="flex min-h-12 flex-col items-center justify-center rounded-xl py-1.5 text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <Package className="h-4 w-4" aria-hidden="true" />
            <span className="mt-0.5 text-[11px] font-bold">Producto</span>
          </a>
          <a href={isAgroDpp ? "#agro-dpp" : isOpenedAttentionState ? reportProblemHref : "#consumer-choice"} className="flex min-h-12 flex-col items-center justify-center rounded-xl py-1.5 text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {isOpenedAttentionState ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4" aria-hidden="true" />}
            <span className="mt-0.5 text-[11px] font-bold">{isOpenedAttentionState ? "Avisar" : "Acciones"}</span>
          </a>
          <a href="#geo-trace" className="flex min-h-12 flex-col items-center justify-center rounded-xl py-1.5 text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="mt-0.5 text-[11px] font-bold">Evidencia</span>
          </a>
        </div>
      </nav>
    </main>
  );
}
