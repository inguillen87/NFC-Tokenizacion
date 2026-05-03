import type { Metadata } from "next";
import Link from "next/link";
import { CtaActions } from "./cta-actions";
import { FreshHandoffUrlCleaner } from "./fresh-handoff-url-cleaner";
import { OnboardDemoButton } from "./onboard-demo-button";
import { productUrls } from "@product/config";
import { BrandLockup, DeviceSignatureBadge, EmptyState, GlobalOpsMap, KeyValueSpec, ThemeToggle, TimelineRail } from "@product/ui";
import type { GlobalOpsPoint, GlobalOpsRoute } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

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
  { match: /(mendoza|valle de uco|finca altamira)/i, lat: -33.2095, lng: -69.1211 },
  { match: /(san rafael)/i, lat: -34.6177, lng: -68.3301 },
  { match: /(cafayate|salta)/i, lat: -26.0729, lng: -65.9761 },
  { match: /(patagonia|rio negro)/i, lat: -39.033, lng: -67.583 },
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

type SunContract = {
  ok?: boolean;
  eventId?: string | null;
  status?: {
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
  identity?: { bid?: string | null; uid?: string | null; uidMasked?: string | null; readCounter?: number | null; tagStatus?: string | null; scanCount?: number | null; eventId?: string | null; tenantSlug?: string | null; tenantId?: string | null };
  tenant?: { id?: string | null; slug?: string | null; name?: string | null; vertical?: string | null; productLabel?: string | null; clubName?: string | null; tokenizationMode?: string | null };
  condition?: { state?: string | null; label?: string | null; summary?: string | null; claimMode?: string | null; tokenizationPolicy?: string | null; marketplaceMode?: string | null; recommendedNextStep?: string | null; requirements?: string[] };
  rightsPolicy?: SunRightsPolicy;
  product?: { name?: string | null; winery?: string | null; region?: string | null; varietal?: string | null; vintage?: string | null; harvestYear?: number | null; barrelMonths?: number | null; storage?: string | null; category?: string | null; vertical?: string | null };
  provenance?: {
    origin?: string | null;
    firstVerified?: { at?: string | null; city?: string | null; country?: string | null };
    lastVerifiedLocation?: { at?: string | null; city?: string | null; country?: string | null; result?: string | null };
    timelineSummary?: Array<{ at?: string | null; result?: string | null; city?: string | null; country?: string | null; device?: string | null; lat?: number | null; lng?: number | null }>;
  };
  iot?: { wineryLocation?: string | null; wineryCoordinates?: { lat?: number | null; lng?: number | null } | null };
  tapContext?: { city?: string | null; country?: string | null; lat?: number | null; lng?: number | null };
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
  technical?: { raw?: { piccDataPrefix?: string; encPrefix?: string; cmacPrefix?: string } };
};

function fmtDate(value?: string | null) {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function resolveOriginCoordinates(input: Array<string | null | undefined>) {
  const blob = input.filter(Boolean).join(" · ");
  const match = KNOWN_ORIGIN_COORDS.find((item) => item.match.test(blob));
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
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
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

  return {
    ok: true,
    status: {
      code: "AUTH_OK",
      label: "Autentico, sello abierto",
      tone: "good",
      summary: "Demo SUN validado con TagTamper y trazabilidad de origen.",
      reason: "demo_preview",
      productState: "VALID_OPENED",
      tamperSupported: true,
      tamperStatus: "OPENED",
    },
    identity: {
      bid: "DEMO-BODEGA-0424",
      uid: "04A7****1090",
      readCounter: 7,
      tagStatus: "active",
      scanCount: 7,
      eventId: "demo-sun-preview",
      tenantSlug: "demobodega",
    },
    product: {
      name: "Gran Reserva Malbec",
      winery: "Demo Bodega",
      region: "Valle de Uco, Mendoza",
      varietal: "Malbec",
      vintage: "2021",
      barrelMonths: 12,
      storage: "Cava 16C",
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
    tokenization: { status: "sandbox_ready", network: "Polygon Amoy", txHash: "0xDEMO", tokenId: "NX-DEMO-0424" },
    tag_tamper: { available: true, status: "opened", raw: "4F" },
    cta: { claimOwnership: true, registerWarranty: true, provenance: true, tokenize: true },
    troubleshooting: [],
    technical: { raw: { piccDataPrefix: "04A7", encPrefix: "4F", cmacPrefix: "SUN" } },
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
  const snapshotResult = snapshotId && snapshotTrace
    ? await fetch(`${resolvedApiBase}/sun/snapshot/${encodeURIComponent(snapshotId)}?trace=${encodeURIComponent(snapshotTrace)}${freshToken ? `&fresh=${encodeURIComponent(freshToken)}` : ""}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => payload?.contract || null)
      .catch(() => null) as SunContract | null
    : null;
  const isDemoPreview = query.toString().length === 0 && !snapshotId;
  const response = snapshotResult ? null : await fetch(`${resolvedApiBase}/sun?${query.toString()}`, { cache: "no-store" }).catch(() => null);
  const parsedResult = response?.ok
    ? await response.json().catch(() => null) as SunContract | null
    : null;
  const result = snapshotResult || parsedResult || sunFallbackResult(params, isDemoPreview);

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
  const encPlainStatusByte = String(result.status?.encPlainStatusByte || "").toUpperCase();
  const statusByteSignal = encPlainStatusByte === "43" ? "closed" : encPlainStatusByte === "4F" ? "opened" : "unknown";
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
    || statusByteSignal === "opened"
    || ttStatus === "opened";
  const isCommercialBlocked = blockedActions.some((action) => ["claim", "save", "join", "warranty", "rewards", "tokenization"].includes(action));
  const verdictName = String(result.verdict || "").toLowerCase();
  const isTamperRisk = Boolean(trustSignals.tamperRisk)
    || result.status?.tone === "risk"
    || statusCode === "TAMPER_RISK"
    || productState === "TAMPER_RISK"
    || verdictName === "tampered";
  const hasAuthenticTone = result.status?.tone === "good" || (result.status?.tone === "warn" && isVerifiedOpenedState);
  const isTechnicallyAuthentic = result.ok !== false
    && !isReplay
    && !isTamperRisk
    && (hasAuthenticTone || ["VALID", "AUTH_OK"].includes(statusCode) || isVerifiedOpenedState || verdictName === "valid" || verdictName === "valid_opened");
  const isActionableTap = isTechnicallyAuthentic && !isCommercialBlocked;
  const isFreshCommercialTap = isActionableTap && (isFreshHandoff || !isSnapshotView);
  const isValid = isTechnicallyAuthentic && !isVerifiedOpenedState && ["VALID", "AUTH_OK"].includes(statusCode);
  const isRiskBlocked = isReplay || isTamperRisk || !isTechnicallyAuthentic;
  const troubleshooting = result.troubleshooting || [];
  const canAutoOnboard = String(result.status?.reason || "").toLowerCase().includes("unknown batch") && /^DEMO-[A-Z0-9-]{3,40}$/.test(bid);
  const timelinePoints = (result.provenance?.timelineSummary || [])
    .filter((item) => typeof item.lat === "number" && typeof item.lng === "number")
    .map((item) => ({
      city: item.city || "Unknown city",
      country: item.country || "--",
      lat: Number(item.lat),
      lng: Number(item.lng),
      scans: 1,
      risk: String(item.result || "").toLowerCase().includes("replay") || String(item.result || "").toLowerCase().includes("tamper") ? 1 : 0,
      status: item.result || "REVIEW",
      lastSeen: item.at || undefined,
      source: "tap_timeline",
    }));
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
  const currentTapPoint = result.tapContext?.lat != null && result.tapContext?.lng != null
    ? [{
      city: result.tapContext.city || "Tap",
      country: result.tapContext.country || "--",
      lat: Number(result.tapContext.lat),
      lng: Number(result.tapContext.lng),
      scans: 1,
      risk: isRiskBlocked ? 1 : 0,
      status: result.status?.code || "REVIEW",
      source: "current_mobile_tap",
    }]
    : [];
  const orderedTimelinePoints = [...timelinePoints].reverse();
  const mapRoutes: Array<{
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
  const distanceDisplay = fmtDistance(originToTapDistance);
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
  const livePillLabel = isFreshHandoff ? "Tap fisico activo" : isSnapshotView ? "Consulta segura" : "Tap SUN";

  const securityTone = isValid
    ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
    : isVerifiedOpenedState && isTechnicallyAuthentic
      ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : "border-rose-300/20 bg-rose-500/10 text-rose-100";
  const riskSignals = (result.provenance?.timelineSummary || []).filter((item) => {
    const verdict = String(item.result || "").toLowerCase();
    return verdict.includes("replay") || verdict.includes("tamper") || verdict.includes("risk");
  }).length;
  const apiQualityScore = Number(result.quality?.score);
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      (Number.isFinite(apiQualityScore) ? apiQualityScore : isValid ? 94 : isVerifiedOpenedState && isTechnicallyAuthentic ? 84 : isTechnicallyAuthentic ? 76 : 48)
      - Math.min(30, riskSignals * 7)
      + (result.tokenization?.status ? 4 : 0)
      + ((result.identity?.scanCount || 0) > 3 ? 2 : 0),
    ),
  );
  const trustTone =
    trustScore >= 85 ? "text-emerald-200" : trustScore >= 65 ? "text-amber-200" : "text-rose-200";
  const timelineCount = result.provenance?.timelineSummary?.length || 0;
  const timelineCities = new Set((result.provenance?.timelineSummary || []).map((item) => `${item.city || "Unknown"}|${item.country || "--"}`)).size;
  const lastEventAt = result.provenance?.timelineSummary?.[0]?.at || result.provenance?.lastVerifiedLocation?.at || null;
  const statusDotClass = isSnapshotView
    ? "sun-status-dot--warn"
    : isValid
    ? "sun-status-dot--good"
    : isReplay
      ? "sun-status-dot--replay"
      : isTamperRisk || result.status?.tone === "risk"
        ? "sun-status-dot--risk"
        : "sun-status-dot--warn";
  const pulseClass = isSnapshotView
    ? "bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.75)]"
    : isRiskBlocked
    ? "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]"
    : isVerifiedOpenedState
      ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]"
      : "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]";
  const statusHeadline = statusByteSignal === "closed" || ttStatus === "closed" || productState === "VALID_CLOSED"
    ? "Autenticidad confirmada. Sello intacto (CLOSED)."
    : statusByteSignal === "opened" || ttStatus === "opened"
      ? "Producto auténtico, pero el sello fue abierto (OPENED)."
    : ttStatus === "invalid"
      ? "TagTamper no inicializado o configuración inválida."
    : productState === "VALID_MANUAL_OPENED"
      ? "Autenticidad confirmada. Sello marcado como abierto por operador."
    : productState === "VALID_OPENED"
      ? "Producto auténtico, pero el sello fue abierto."
    : productState === "VALID_UNKNOWN_TAMPER" || ttStatus === "not_available"
        ? "Autenticidad confirmada. Estado de apertura no disponible."
        : result.status?.code === "REPLAY_SUSPECT"
          ? "Este payload ya fue usado. Escaneá físicamente la etiqueta para generar una nueva lectura."
          : result.status?.tone === "good"
            ? "Autenticidad verificada"
            : result.status?.tone === "risk"
              ? "Se detectaron señales de riesgo"
              : "Validación en revisión";
  const displayRiskLevelLabel = isFreshHandoff
    ? "Tap accionable"
    : isSnapshotView
    ? "Consulta segura"
    : isRiskBlocked
    ? "Riesgo alto"
    : isVerifiedOpenedState
      ? "Riesgo bajo | sello abierto"
      : trustScore >= 85
        ? "Riesgo bajo"
        : trustScore >= 65
          ? "Riesgo moderado"
          : "Riesgo alto";
  const displayStatusHeadline = rightsTitle || (isVerifiedOpenedState && isTechnicallyAuthentic
    ? "Producto autentico. Sello abierto registrado como lifecycle event."
    : statusHeadline);
  const recommendedAction = isFreshCommercialTap
    ? { label: isVerifiedOpenedState ? "Apropiar ownership" : "Guardar en mi Passport", href: "/me", helper: rightsPolicy.recommendedNextStep || (isVerifiedOpenedState ? "El sello abierto queda registrado como evento verificado. Podes reclamar ownership, garantia, club y tokenizacion opcional." : "Autenticidad solida. Continuar activa ownership, club y marketplace.") }
    : isSnapshotView
      ? { label: "Escanear de nuevo", href: "#fresh-tap-required", helper: "Consulta segura: autenticidad y trazabilidad quedan visibles. Para ownership, club, rewards o tokenizacion se necesita otro tap fisico." }
    : trustScore >= 65
      ? { label: "Ver detalles de trazabilidad", href: "#geo-trace", helper: "Revisá ruta y consistencia antes de guardar." }
      : { label: "Reportar y reintentar tap", href: "/?contact=sales&intent=sun_mobile#contact-modal", helper: "Señal de riesgo alta. Escaneá físicamente de nuevo." };
  const tenantSlug = String(result.identity?.tenantSlug || "").trim();
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
  const tapQuery = tapParams.toString();
  const withTapQuery = (path: string, action: string) => `${path}${path.includes("?") ? "&" : "?"}${tapQuery}&action=${encodeURIComponent(action)}`;
  const portalHref = localizeHref(result.cta?.portalUrl) || withTapQuery("/me", "portal");
  const registerHref = localizeHref(result.cta?.registerUrl) || withTapQuery("/me", "register");
  const productsHref = withTapQuery("/me/products", "save-product");
  const rewardsHref = localizeHref(result.cta?.rewardsUrl) || withTapQuery("/me/rewards", "rewards");
  const tapMarketplaceHref = localizeHref(result.cta?.marketplaceUrl) || withTapQuery(marketplaceHref, "marketplace");
  const consumerLoginHref = (next: string) => `/login?consumer=1&next=${encodeURIComponent(next)}`;
  const blockedTapReason = isFreshCommercialTap
    ? ""
    : isSnapshotView
      ? "Consulta guardada: para reclamar ownership, sumar puntos, abrir club o tokenizar, volve a tocar fisicamente la etiqueta."
    : isReplay
      ? "Replay detectado: por seguridad necesitás un nuevo tap físico para ownership, club, garantía o tokenización."
    : "Este tap no es apto para ownership/club. Necesitás un tap válido y fresco para continuar.";
  const protectedBannerTitle = isSnapshotView
    ? "Consulta segura"
    : isReplay
      ? "Replay bloqueado"
      : "Accion protegida";
  const protectedBannerCopy = isSnapshotView
    ? "Autenticidad y trazabilidad visibles. Ownership, puntos, club y tokenizacion quedan protegidos hasta un nuevo tap fisico."
    : isReplay
      ? "La URL/SUN ya fue usada. Conservamos la evidencia y pedimos un nuevo tap fisico para acciones comerciales."
      : "Por seguridad, este producto no puede guardarse en la coleccion ni sumar puntos con esta lectura.";
  const protectedBannerClass = isReplay || isTamperRisk
    ? "border-red-500/30 bg-red-950/20 text-red-100"
    : isSnapshotView
      ? "border-sky-300/25 bg-sky-500/10 text-sky-50"
      : "border-amber-300/25 bg-amber-500/10 text-amber-50";
  const reportProblemHref = "/?contact=sales&intent=sun_mobile#contact-modal";
  const journeySteps = [
    { id: "scan", label: "Tap NFC", done: true },
    { id: "verify", label: "Verificación", done: Boolean(result.status?.label) },
    { id: "portal", label: "Portal", done: isFreshCommercialTap },
    { id: "club", label: "Club premium", done: Boolean(result.identity?.tenantSlug) && isFreshCommercialTap },
  ];
  const sealOpened = statusByteSignal === "opened" || ttStatus === "opened" || productState.includes("OPENED");
  const sealClosed = statusByteSignal === "closed" || ttStatus === "closed" || productState === "VALID_CLOSED";
  const carrierLabel = result.status?.tamperSupported || result.tag_tamper?.available
    ? "NTAG 424 DNA TT"
    : result.technical?.raw
      ? "NTAG 424 DNA"
      : "QR / NFC";
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
  const replayDecisionText = isReplay
    ? "Replay detectado: esta URL/SUN ya fue usada. Ownership, garantia, rewards y tokenizacion quedan bloqueados hasta un nuevo tap fisico."
    : isSnapshotView
      ? "Consulta segura: la prueba queda disponible para revisar y compartir. Para reclamar propiedad, sumar puntos o mintear, toca otra vez la etiqueta."
    : isValid
      ? rightsSummary || "Lectura fresca: UID, contador SUN y CMAC pasan la politica anti-replay."
      : isVerifiedOpenedState && isTechnicallyAuthentic
        ? rightsSummary || "Sello abierto verificado: la apertura queda registrada como lifecycle event y conserva ownership, garantia, provenance y tokenizacion opcional."
        : rightsSummary || "Lectura revisable: la prueba tecnica se conserva, pero las acciones comerciales quedan protegidas.";
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
  const productVisualClass = [
    "sun-product-visual",
    isReplay ? "sun-product-visual--replay" : isRiskBlocked ? "sun-product-visual--risk" : isVerifiedOpenedState ? "sun-product-visual--warn" : "sun-product-visual--valid",
    sealOpened ? "sun-product-visual--opened" : "",
  ].filter(Boolean).join(" ");
  const trustCopy = isReplay
    ? "Anti-replay activo: el tap queda como evidencia, no como permiso comercial."
    : isSnapshotView
      ? "Consulta segura: autenticidad visible y trazabilidad preservada. Las acciones comerciales requieren otro tap fisico."
    : isFreshHandoff
      ? "Lectura fisica recien validada: podés reclamar ownership, club, garantia y tokenizacion opcional mientras el handoff sigue fresco."
    : isVerifiedOpenedState && isTechnicallyAuthentic
      ? "Apertura verificada: el sello cambio de estado, pero la identidad SUN sigue siendo valida y accionable."
    : isFreshCommercialTap
      ? "Lectura fresca, identidad consistente y lote activo."
    : trustScore >= 65
      ? "Lectura revisable: conviene mirar ruta y estado del sello antes de apropiar."
      : "Lectura de riesgo: no habilitamos ownership hasta repetir el tap.";
  const effectiveTrustCopy = !isReplay && !isSnapshotView && rightsSummary ? rightsSummary : trustCopy;
  const rightsModeCards = [
    { label: "Rubro", value: verticalLabel },
    { label: "Ownership", value: claimModeLabel },
    { label: "Token", value: tokenPolicyLabel },
    { label: "Marketplace", value: marketplaceModeLabel },
  ];
  const rightsRequirementsPreview = rightsRequirements.slice(0, 4);
  const handoffCopy = isFreshHandoff
    ? "Tap fisico fresco: acciones habilitadas con prueba SUN y token temporal."
    : isSnapshotView
    ? "Consulta segura: prueba visible, acciones comerciales bloqueadas."
    : isDemoPreview
      ? "Vista demo del passport SUN para probar el flujo sin etiqueta fisica."
      : "Validacion directa desde parametros SUN.";
  const carrierEducation = [
    { name: "QR comun", mode: "Contenido", body: "Abre una URL y sirve para campañas simples. Es barato, pero se puede copiar o reenviar." },
    { name: "NTAG215", mode: "Tap UX", body: "Mejora velocidad y serializacion para eventos, credenciales y activaciones con reglas server-side." },
    { name: "NTAG 424 DNA", mode: "SUN/SDM", body: "Cada tap genera datos dinamicos verificables contra replay, clones y URLs reutilizadas." },
    { name: "424 DNA TT", mode: "Tamper", body: "Suma estado fisico del sello: cerrado, abierto o no inicializado para botellas y packaging premium." },
  ];
  const activeCarrierIndex = carrierLabel.includes("424 DNA TT")
    ? 3
    : carrierLabel.includes("424 DNA")
      ? 2
      : carrierLabel.includes("NTAG215")
        ? 1
        : 0;


  return (
    <main className="sun-mobile-surface min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col items-center py-4 sm:py-6 lg:py-8 px-0 font-sans relative overflow-hidden pb-safe pb-32 lg:pb-10">
      <FreshHandoffUrlCleaner enabled={Boolean(isFreshHandoff && freshToken)} />
      {/* Dynamic Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-gradient-to-b from-cyan-900/20 to-transparent blur-3xl pointer-events-none"></div>

      <div className="sun-mobile-shell w-full max-w-[430px] min-w-0 z-10 space-y-4 px-3 lg:max-w-6xl lg:px-6">
         {/* Trust Header */}
         <div className="sun-topbar flex items-center justify-between px-2 mb-2">
            <div className="sun-passport-brand flex items-center gap-2">
               <BrandLockup size={38} variant="ripple" theme="dark" />
               <p className="sun-passport-brand__caption">verified passport</p>
            </div>
            <div className="sun-topbar-actions flex items-center gap-1.5">
              <ThemeToggle />
              <div className="sun-live-tap-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900/85 border border-slate-700">
                 <span className={`w-1.5 h-1.5 rounded-full ${pulseClass}`}></span>
                 <span className="text-[9px] font-bold text-slate-300 uppercase">{livePillLabel}</span>
              </div>
            </div>
         </div>

         <div className="sun-quick-nav grid grid-cols-3 gap-2">
           <a href="#geo-trace" className="min-w-0 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-center text-[11px] font-semibold text-cyan-100">Geo trace</a>
           <Link href={consumerLoginHref(tapMarketplaceHref)} className={`min-w-0 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold ${isFreshCommercialTap ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "pointer-events-none border-white/10 bg-slate-900/60 text-slate-500"}`}>Registro</Link>
           <Link href={consumerLoginHref(portalHref)} className={`min-w-0 rounded-xl border px-2 py-2 text-center text-[11px] font-semibold ${isFreshCommercialTap ? "border-violet-300/30 bg-violet-500/15 text-violet-100" : "pointer-events-none border-white/10 bg-slate-900/60 text-slate-500"}`}>Portal</Link>
         </div>

         {isSnapshotView ? (
           <div id="fresh-tap-required" className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-3 text-xs leading-5 text-sky-100">
             <p className="font-semibold">Consulta segura del tap</p>
             <p className="mt-1 text-sky-100/80">Esta vista sirve para demostrar autenticidad y trazabilidad sin exponer acciones sensibles. Para ownership, puntos, marketplace o tokenizacion, toca fisicamente la etiqueta y usa el nuevo tap fresco.</p>
           </div>
         ) : null}

         {/* Hero Product Card */}
         <div className="sun-passport-card sun-passport-hero rounded-[2rem] border border-white/10 bg-slate-900/60 p-1 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="rounded-[1.75rem] border border-white/5 bg-slate-950 p-5 relative z-10 text-center">
               <div className="sun-product-stage mx-auto mb-4">
                  <span className="sun-stage-pin sun-stage-pin--origin">
                    <b>Origen</b>
                    <em>{originDisplay.split(",")[0]}</em>
                  </span>
                  <span className="sun-stage-pin sun-stage-pin--tap">
                    <b>Tap</b>
                    <em>{tapDisplay.split(",")[0]}</em>
                  </span>
                  <span className="sun-stage-route-label">{distanceDisplay}</span>
                  <div className={productVisualClass}>
                     <span className="sun-product-visual__tag">NFC</span>
                  </div>
                  <div className="sun-tap-wave" />
               </div>

               <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">{result.product?.winery || "Bodega Premium"}</p>
               <h1 className="text-xl font-bold text-white leading-tight mb-2">{result.product?.name || "Producto Verificado"}</h1>
               <p className="text-xs text-slate-500">{result.product?.region || "Mendoza, Argentina"} · {result.product?.varietal || "Blend"}</p>
               <div className="sun-route-card mt-5">
                 <div>
                   <span>Origen</span>
                   <strong>{originDisplay}</strong>
                 </div>
                 <div className="sun-route-card__line" aria-hidden="true" />
                 <div>
                   <span>Tap actual</span>
                   <strong>{tapDisplay}</strong>
                 </div>
                 <b>{distanceDisplay}</b>
               </div>

               <div className="mt-6 inline-flex flex-col items-center justify-center">
                  <span className={`text-xs font-bold uppercase tracking-widest ${trustTone === "text-emerald-200" ? "text-emerald-400" : trustTone === "text-amber-200" ? "text-amber-400" : "text-red-400"}`}>
                     {result.status?.label || "AUTÉNTICO"}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Tap #{result.identity?.scanCount ?? 1} · {handoffCopy}</span>
               </div>

               <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                     <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Certificado vivo</p>
                         <p className="mt-1 text-sm font-semibold text-white">{displayStatusHeadline}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{effectiveTrustCopy}</p>
                     </div>
                     <div className={`shrink-0 rounded-2xl border px-3 py-2 text-center ${trustTone === "text-emerald-200" ? "border-emerald-300/30 bg-emerald-500/15" : trustTone === "text-amber-200" ? "border-amber-300/30 bg-amber-500/15" : "border-rose-300/30 bg-rose-500/15"}`}>
                        <p className={`text-2xl font-black leading-none ${trustTone}`}>{trustScore}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">trust</p>
                     </div>
                  </div>

                 <div className="mt-4 grid grid-cols-3 gap-2">
                     <div className="sun-signal-cell">
                        <span>Carrier</span>
                        <b>{carrierLabel}</b>
                     </div>
                     <div className="sun-signal-cell">
                        <span>Seal</span>
                        <b>{sealLabel}</b>
                     </div>
                     <div className="sun-signal-cell">
                        <span>Chain</span>
                        <b>{chainLabel}</b>
                     </div>
                  </div>
               </div>
            </div>
         </div>

          <section className={`sun-security-ledger sun-panel-primary ${isReplay ? "sun-security-ledger--replay" : isRiskBlocked ? "sun-security-ledger--review" : isVerifiedOpenedState ? "sun-security-ledger--opened" : "sun-security-ledger--fresh"}`}>
           <div className="sun-security-ledger__header">
             <div>
               <p className="sun-security-eyebrow">Prueba criptografica NTAG 424 DNA TT</p>
                <h2>{isReplay ? "Replay detectado y bloqueado" : isSnapshotView ? "Prueba guardada para consulta" : isVerifiedOpenedState && isTechnicallyAuthentic ? "Sello abierto verificado" : isValid ? "Tap fresco verificado" : "Tap protegido en revision"}</h2>
             </div>
             <span className={`sun-status-dot ${statusDotClass}`} aria-hidden="true" />
           </div>
           <p className="sun-security-copy">{replayDecisionText}</p>
           <div className="sun-security-steps">
             <div className="sun-security-step">
               <span>01</span>
               <b>UID fisico</b>
               <p>{result.identity?.uid || result.identity?.bid || "Oculto por privacidad"}</p>
             </div>
             <div className="sun-security-step">
               <span>02</span>
               <b>Contador SUN</b>
               <p>{result.identity?.readCounter ?? "N/A"}</p>
             </div>
             <div className="sun-security-step">
               <span>03</span>
               <b>CMAC / ENC</b>
               <p>{result.technical?.raw?.cmacPrefix || "server"} / {result.technical?.raw?.encPrefix || "server"}</p>
             </div>
             <div className="sun-security-step">
               <span>04</span>
               <b>TagTamper</b>
               <p>{sealLabel} {encPlainStatusByte ? `(${encPlainStatusByte})` : ""}</p>
             </div>
           </div>
           <div className="sun-security-footer">
             <span>Rubro: {verticalLabel}</span>
              <span>Ownership: {claimModeLabel}</span>
              <span>Token: {tokenPolicyLabel}</span>
              <span>{tokenEvidenceLabel}{hasOnChainTx ? ` · ${tokenTx.slice(0, 10)}...` : tokenId && hasOnChainProof ? ` · #${tokenId}` : ""}</span>
          </div>
        </section>

         <section className="sun-rights-panel rounded-2xl border border-cyan-300/15 bg-slate-900/65 p-4">
           <div className="flex items-start justify-between gap-3">
             <div>
               <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Derechos por rubro</p>
               <h2 className="mt-1 text-sm font-semibold text-white">{rightsTitle || "Politica comercial del tap"}</h2>
             </div>
             <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${rightsPolicy.canTokenize ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-amber-300/30 bg-amber-500/10 text-amber-100"}`}>
               {rightsPolicy.canTokenize ? "token-ready" : "protegido"}
             </span>
           </div>
           <p className="mt-2 text-xs leading-5 text-slate-300">{rightsSummary || "La politica del tenant define que acciones comerciales se habilitan para esta lectura."}</p>
           <div className="mt-3 grid grid-cols-2 gap-2">
             {rightsModeCards.map((item) => (
               <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/55 p-2.5">
                 <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                 <p className="mt-1 text-xs font-semibold text-white">{item.value}</p>
               </div>
             ))}
           </div>
           {rightsRequirementsPreview.length ? (
             <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3">
               <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-300">Requisitos antes de accionar</p>
               <div className="mt-2 flex flex-wrap gap-1.5">
                 {rightsRequirementsPreview.map((item) => (
                   <span key={item} className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100">{item}</span>
                 ))}
               </div>
             </div>
           ) : null}
           {rightsEnterpriseCopy ? <p className="mt-2 text-[10px] leading-4 text-slate-500">{rightsEnterpriseCopy}</p> : null}
         </section>

         <section className="sun-config-panel sun-panel-education rounded-2xl border border-white/10 bg-slate-900/65 p-4">
           <div className="flex items-start justify-between gap-3">
             <div>
               <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">Configuracion detectada</p>
               <h2 className="mt-1 text-sm font-semibold text-white">{carrierLabel}</h2>
             </div>
             <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
               perfil {activeCarrierIndex + 1}/4
             </span>
           </div>
           <div className="mt-3 grid grid-cols-2 gap-2">
             {carrierEducation.map((item, index) => (
               <div key={item.name} className={`rounded-xl border p-2.5 ${index === activeCarrierIndex ? "border-cyan-300/35 bg-cyan-500/15" : "border-white/10 bg-slate-950/55"}`}>
                 <div className="flex items-center justify-between gap-2">
                   <p className="text-xs font-semibold text-white">{item.name}</p>
                   <span className="rounded-full border border-white/10 bg-slate-950 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-slate-300">{item.mode}</span>
                 </div>
                 <p className="mt-1 text-[10px] leading-4 text-slate-300">{item.body}</p>
               </div>
             ))}
           </div>
         </section>

         <div className="sun-journey-panel sun-panel-journey rounded-2xl border border-white/10 bg-slate-900/55 p-4">
           <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">Journey post tap</p>
           <div className="mt-3 grid grid-cols-4 gap-2">
             {journeySteps.map((step) => (
               <div key={step.id} className={`rounded-lg border px-2 py-2 text-center text-[10px] ${step.done ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-950/50 text-slate-400"}`}>
                 <p className="font-semibold">{step.done ? "✓" : "•"}</p>
                 <p className="mt-1 leading-tight">{step.label}</p>
               </div>
             ))}
           </div>
           <p className="mt-2 text-[11px] text-slate-300">{displayStatusHeadline}</p>
         </div>

         <section className="sun-priority-panel sun-panel-priority rounded-2xl border border-white/10 bg-slate-900/65 p-4">
           <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300">Prioridad operativa</p>
           <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
             <span className={`rounded-full border px-2 py-1 font-semibold ${securityTone}`}>{result.status?.label || "Estado"}</span>
              <span className={`rounded-full border px-2 py-1 font-semibold ${trustTone === "text-emerald-200" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : trustTone === "text-amber-200" ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-rose-300/30 bg-rose-500/10 text-rose-100"}`}>{displayRiskLevelLabel}</span>
             <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-100">Trust {trustScore}/100</span>
           </div>
           <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/55 p-3">
             <p className="text-xs font-semibold text-white">Siguiente acción recomendada</p>
             <p className="mt-1 text-xs text-slate-300">{recommendedAction.helper}</p>
             <a href={recommendedAction.href} className={`mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold ${trustScore >= 85 ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : trustScore >= 65 ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100" : "border-rose-300/30 bg-rose-500/15 text-rose-100"}`}>
               {recommendedAction.label}
             </a>
           </div>
         </section>

         <section className="sun-actions-panel sun-panel-actions rounded-2xl border border-white/10 bg-slate-900/65 p-4">
           <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Acciones de passport</p>
           <div className="mt-3 grid gap-2">
              <Link href={registerHref} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${isFreshCommercialTap ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "border-white/10 bg-slate-950/60 text-slate-400 pointer-events-none"}`}>
               Crear mi nexID Passport
             </Link>
              <Link href={productsHref} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${isFreshCommercialTap ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-slate-950/60 text-slate-400 pointer-events-none"}`}>
               Guardar producto
             </Link>
              <Link href={tapMarketplaceHref} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${isFreshCommercialTap ? "border-violet-300/30 bg-violet-500/15 text-violet-100" : "border-white/10 bg-slate-950/60 text-slate-400 pointer-events-none"}`}>
               Unirme al club de esta marca
             </Link>
           </div>
          {isFreshCommercialTap ? (
            <p className="mt-2 text-[11px] text-slate-300">Despues de iniciar sesion podes reclamar ownership, guardar producto y unirte al tenant automaticamente.</p>
           ) : (
             <p className="mt-2 text-[11px] text-amber-200">{blockedTapReason}</p>
           )}
         </section>


         {/* Mobile Geo Trace / Enterprise Map */}
         <div id="geo-trace" className="sun-map-section sun-map-section--enterprise sun-panel-map rounded-2xl border border-white/10 bg-slate-900/60 p-3 backdrop-blur-xl">
            <div className="sun-map-section__header">
              <div>
                <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Geo trace enterprise</p>
                <h2 className="px-1 text-lg font-black text-white">Mapa de confianza origen - tap</h2>
              </div>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">MapLibre + heatmap</span>
            </div>
            <div className="mt-2">
               {opsMapPoints.length ? (
                  <GlobalOpsMap
                    title="Trazabilidad geografica SUN"
                    subtitle="Vista tipo network: origen, hops de verificación y tap actual en trazado global."
                    points={opsMapPoints}
                    routes={opsMapRoutes}
                    mode="demo"
                    selectedPointId={opsMapPoints.find((point) => point.role === "tap")?.id || opsMapPoints[0]?.id}
                    playbackEnabled
                  />
               ) : (
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-400">
                    Sin coordenadas disponibles para este tap. Se mostrará el mapa al recibir eventos geo.
                  </div>
               )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1.5 text-center">
                <p className="text-[9px] uppercase text-slate-500">Events</p>
                <p className="text-xs font-semibold text-white">{timelineCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1.5 text-center">
                <p className="text-[9px] uppercase text-slate-500">Distancia</p>
                <p className="text-xs font-semibold text-white">{fmtDistance(originToTapDistance)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1.5 text-center">
                <p className="text-[9px] uppercase text-slate-500">Last</p>
                <p className="text-[10px] font-semibold text-white">{lastEventAt ? fmtDate(lastEventAt) : "N/A"}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              {originMapHref ? <a href={originMapHref} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-2 text-center font-semibold text-emerald-100">Visitar origen</a> : null}
              {tapMapHref ? <a href={tapMapHref} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-2 text-center font-semibold text-cyan-100">Ver tap actual</a> : null}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">{timelineCities} ciudades reales en timeline. Si no hay coordenadas del tap, el mapa queda vacío en vez de inventar ubicaciones.</p>
         </div>

         {/* Loyalty & Experiences Mini-app (Consumer Network) */}
          {isFreshCommercialTap && (
             <div className="sun-loyalty-panel rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 mt-4">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <h3 className="text-sm font-bold text-white">Club Terroir</h3>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-widest mt-1">PROGRAMA DE LEALTAD</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow-inner">
                      <span className="text-[11px] font-black tracking-[0.12em] text-indigo-200">VIP</span>
                   </div>
                </div>

                <div className="space-y-3 mb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                         <span className="text-emerald-400 font-bold text-xs">+10</span>
                      </div>
                      <p className="text-xs text-slate-300">Puntos disponibles por escanear este producto auténtico.</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                         <span className="text-amber-400 text-sm">🎫</span>
                      </div>
                      <p className="text-xs text-slate-300">Desbloquea reservas prioritarias para visitas a la bodega.</p>
                   </div>
                </div>

                <Link href={rewardsHref} className="block w-full py-3 rounded-xl border border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-100 text-center text-sm font-bold transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                   Unirme al Club y Sumar Puntos
                </Link>
             </div>
         )}
   {/* Actions / Passport Banner */}
          {isFreshCommercialTap ? (
            <div className="sun-passport-banner rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 mt-4 text-center">
               <h3 className="text-sm font-bold text-white mb-2">Crear mi NexID Passport</h3>
               <p className="text-xs text-cyan-200/70 mb-4">Guardá este producto en tu colección, sumá puntos y accedé a recompensas exclusivas.</p>
               <Link href={portalHref} className="block w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-cyan-950 text-sm font-bold transition-colors">
                  Guardar Producto
               </Link>
            </div>
         ) : (
           <div className={`sun-passport-banner rounded-2xl border p-5 mt-4 text-center ${protectedBannerClass}`}>
              <h3 className="text-sm font-bold text-white mb-2">{protectedBannerTitle}</h3>
              <p className="text-xs opacity-80 mb-4">{protectedBannerCopy}</p>
              {isSnapshotView ? (
                <a href="#fresh-tap-required" className="block w-full py-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-50 text-sm font-bold transition-colors">
                  Escanear nuevamente
                </a>
              ) : (
                <Link href={reportProblemHref} className="block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors">
                   Reportar problema
                </Link>
              )}
           </div>
         )}

         {/* Post-tap journey (mobile-first) */}
         <div className="sun-posttap-panel rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-5 mt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Flujo post tap · SUN mobile</p>
            <h3 className="mt-2 text-sm font-bold text-white">{isFreshCommercialTap ? "Asocia este tap al tenant y entra al club premium" : "Acciones protegidas hasta un nuevo tap fisico"}</h3>
            <div className="mt-3 space-y-2 text-xs text-slate-200">
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">1) Verificás autenticidad con NTAG424 DNA TT y estado anti-tamper.</div>
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">2) Activás ownership + garantía para abrir portal de usuario premium.</div>
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">3) Te unís al club del tenant ({result.identity?.tenantSlug || "tenant-demo"}) y desbloqueás beneficios.</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Link href={registerHref} className={`rounded-lg border px-2 py-2 text-center font-semibold ${isFreshCommercialTap ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "pointer-events-none border-white/10 bg-slate-950/60 text-slate-500"}`}>Registrarme</Link>
              <Link href={portalHref} className={`rounded-lg border px-2 py-2 text-center font-semibold ${isFreshCommercialTap ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100" : "pointer-events-none border-white/10 bg-slate-950/60 text-slate-500"}`}>Abrir Portal</Link>
            </div>
         </div>

         {/* Technical Spec */}
         <div className="sun-tech-panel rounded-2xl border border-white/5 bg-slate-900/40 p-5 mt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Trazabilidad Técnica</h4>
            <div className="space-y-3">
               <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-500">Tag UID</span>
                  <span className="text-xs font-mono text-slate-300">{result.identity?.uid?.substring(0, 14)}...</span>
               </div>
               <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-500">Batch ID</span>
                  <span className="text-xs font-mono text-slate-300">{result.identity?.bid || "N/A"}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Token Blockchain</span>
                 {hasOnChainTx ? (
                    <a
                      href={`https://amoy.polygonscan.com/tx/${encodeURIComponent(tokenTx)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-[10px] px-2 py-0.5 rounded ${tokenStatusBadgeClass} font-bold uppercase`}
                    >
                      {tokenStatusDisplay} · tx
                    </a>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded ${tokenStatusBadgeClass} font-bold uppercase`}>{tokenStatusDisplay}</span>
                  )}
               </div>
            </div>
         </div>

         {bid && (uid || eventId) ? (
           <div className="sun-cta-actions mt-4">
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
         ) : null}

         {canAutoOnboard ? (
           <div className="sun-onboard-action">
             <OnboardDemoButton bid={bid} />
           </div>
         ) : null}

      </div>

      <div className="sun-bottom-nav z-10 mx-auto mt-4 w-full max-w-[390px] px-3 lg:hidden">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/85 p-2 backdrop-blur-xl">
          <Link href={registerHref} className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold ${isFreshCommercialTap ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "pointer-events-none border-white/10 bg-slate-900/70 text-slate-500"}`}>Registro</Link>
          <Link href={portalHref} className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold ${isFreshCommercialTap ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100" : "pointer-events-none border-white/10 bg-slate-900/70 text-slate-500"}`}>Portal</Link>
          <Link href={tapMarketplaceHref} className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold ${isFreshCommercialTap ? "border-violet-300/30 bg-violet-500/15 text-violet-100" : "pointer-events-none border-white/10 bg-slate-900/70 text-slate-500"}`}>Club</Link>
        </div>
      </div>
    </main>
  );
}
