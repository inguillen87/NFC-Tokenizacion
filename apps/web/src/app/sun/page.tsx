import type { Metadata } from "next";
import { CtaActions } from "./cta-actions";
import { OnboardDemoButton } from "./onboard-demo-button";
import { productUrls } from "@product/config";
import { DeviceSignatureBadge, EmptyState, KeyValueSpec, TimelineRail, WorldMapRealtime } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

function apiBase() {
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

type SunContract = {
  ok?: boolean;
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
  };
  identity?: { bid?: string | null; uid?: string | null; readCounter?: number | null; tagStatus?: string | null; scanCount?: number | null; eventId?: string | null; tenantSlug?: string | null };
  product?: { name?: string | null; winery?: string | null; region?: string | null; varietal?: string | null; vintage?: string | null; harvestYear?: number | null; barrelMonths?: number | null; storage?: string | null };
  provenance?: {
    origin?: string | null;
    firstVerified?: { at?: string | null; city?: string | null; country?: string | null };
    lastVerifiedLocation?: { at?: string | null; city?: string | null; country?: string | null; result?: string | null };
    timelineSummary?: Array<{ at?: string | null; result?: string | null; city?: string | null; country?: string | null; device?: string | null; lat?: number | null; lng?: number | null }>;
  };
  iot?: { wineryLocation?: string | null; wineryCoordinates?: { lat?: number | null; lng?: number | null } | null };
  tapContext?: { city?: string | null; country?: string | null; lat?: number | null; lng?: number | null };
  tokenization?: { status?: string | null; network?: string | null; txHash?: string | null; tokenId?: string | null };
  tag_tamper?: { available?: boolean; status?: "closed" | "opened" | "invalid" | "unknown" | "not_available" | string; raw?: string | null };
  cta?: { claimOwnership?: boolean; registerWarranty?: boolean; provenance?: boolean; tokenize?: boolean };
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
      tapContext: null,
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

  const isDemoPreview = query.toString().length === 0;
  const response = await fetch(`${apiBase()}/sun?${query.toString()}`, { cache: "no-store" }).catch(() => null);
  const parsedResult = response?.ok
    ? await response.json().catch(() => null) as SunContract | null
    : null;
  const result = parsedResult || sunFallbackResult(params, isDemoPreview);

  // Proactively fetch loyalty overview if we know the tenant
  let loyaltyData = null;
  if (result.ok && result.identity?.tenantSlug) {
    const memKey = "anonymous"; // using anonymous mode for the public passport
    loyaltyData = await fetch(`${apiBase()}/mobile/loyalty/overview?tenantSlug=${result.identity.tenantSlug}&memberKey=${memKey}`, { cache: "no-store" })
      .then((res) => res.json())
      .catch(() => null);
  }

  const bid = String(result.identity?.bid || params.bid || "");
  const uid = String(result.identity?.uid || "");
  const isValid = result.status?.tone === "good";
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
      risk: isValid ? 0 : 1,
      status: result.status?.code || "REVIEW",
      source: "current_mobile_tap",
    }]
    : [];
  const mapPoints = [...wineryPoint, ...timelinePoints, ...currentTapPoint];
  const effectiveMapPoints = mapPoints;
  const orderedTimelinePoints = [...timelinePoints].reverse();
  const mapRoutes = [
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

  const toneClass = result.status?.tone === "good"
    ? "text-emerald-300 border-emerald-300/30 bg-emerald-500/10"
    : result.status?.tone === "risk"
      ? "text-rose-300 border-rose-300/30 bg-rose-500/10"
      : "text-amber-300 border-amber-300/30 bg-amber-500/10";
  const securityTone = isValid ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-rose-300/20 bg-rose-500/10 text-rose-100";
  const riskSignals = (result.provenance?.timelineSummary || []).filter((item) => {
    const verdict = String(item.result || "").toLowerCase();
    return verdict.includes("replay") || verdict.includes("tamper") || verdict.includes("risk");
  }).length;
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      (isValid ? 92 : 48)
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
  const statusIcon = result.status?.tone === "good" ? "🟢" : result.status?.tone === "risk" ? "🔴" : "🟠";
  const productState = String(result.status?.productState || "").toUpperCase();
  const ttStatus = String(result.tag_tamper?.status || "").toLowerCase();
  const encPlainStatusByte = String((result.status as { encPlainStatusByte?: string | null } | undefined)?.encPlainStatusByte || "").toUpperCase();
  const statusByteSignal = encPlainStatusByte === "43" ? "closed" : encPlainStatusByte === "4F" ? "opened" : "unknown";
  const pulseClass = isValid ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" : productState === "REPLAY_SUSPECT" ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]" : "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]";
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
  const riskLevelLabel = trustScore >= 85 ? "Riesgo bajo" : trustScore >= 65 ? "Riesgo moderado" : "Riesgo alto";
  const recommendedAction = trustScore >= 85
    ? { label: "Guardar en mi Passport", href: "/me", helper: "Autenticidad sólida. Continuá con ownership/club." }
    : trustScore >= 65
      ? { label: "Ver detalles de trazabilidad", href: "#geo-trace", helper: "Revisá ruta y consistencia antes de guardar." }
      : { label: "Reportar y reintentar tap", href: "/?contact=sales&intent=sun_mobile#contact-modal", helper: "Señal de riesgo alta. Escaneá físicamente de nuevo." };
  const tenantSlug = String(result.identity?.tenantSlug || "").trim();
  const marketplaceHref = tenantSlug ? `/me/marketplace?tenant=${encodeURIComponent(tenantSlug)}` : "/me/marketplace";
  const blockedTapReason = isValid
    ? ""
    : "Este tap no es apto para ownership/club. Necesitás un tap válido y fresco para continuar.";
  const journeySteps = [
    { id: "scan", label: "Tap NFC", done: true },
    { id: "verify", label: "Verificación", done: Boolean(result.status?.label) },
    { id: "portal", label: "Portal", done: trustTone === "text-emerald-200" },
    { id: "club", label: "Club premium", done: Boolean(result.identity?.tenantSlug) && trustTone === "text-emerald-200" },
  ];
  const sealOpened = statusByteSignal === "opened" || ttStatus === "opened" || productState.includes("OPENED");
  const sealClosed = statusByteSignal === "closed" || ttStatus === "closed" || productState === "VALID_CLOSED";
  const carrierLabel = result.status?.tamperSupported || result.tag_tamper?.available
    ? "NTAG 424 DNA TT"
    : result.technical?.raw
      ? "NTAG 424 DNA"
      : "QR / NFC";
  const sealLabel = sealClosed ? "Sello intacto" : sealOpened ? "Sello abierto" : "Sello no informado";
  const chainLabel = result.tokenization?.status
    ? `${result.tokenization.network || "sandbox"} / ${result.tokenization.status}`
    : "Token sandbox listo";
  const productVisualClass = [
    "sun-product-visual",
    isValid ? "sun-product-visual--valid" : result.status?.tone === "risk" ? "sun-product-visual--risk" : "sun-product-visual--warn",
    sealOpened ? "sun-product-visual--opened" : "",
  ].filter(Boolean).join(" ");
  const trustCopy = trustScore >= 85
    ? "Lectura fresca, identidad consistente y lote activo."
    : trustScore >= 65
      ? "Lectura revisable: conviene mirar ruta y estado del sello."
      : "Lectura de riesgo: no habilitamos ownership hasta repetir el tap.";
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
    <main className="sun-mobile-surface min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col items-center py-6 px-0 font-sans relative overflow-hidden pb-safe pb-32">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-gradient-to-b from-cyan-900/20 to-transparent blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-[390px] min-w-0 z-10 space-y-4 px-3">
         {/* Trust Header */}
         <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2">
               <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                  <span className="text-[10px] font-bold text-white">NX</span>
               </div>
               <span className="text-xs font-bold tracking-widest text-white uppercase">nexID Verified</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
               <span className={`w-1.5 h-1.5 rounded-full ${pulseClass}`}></span>
               <span className="text-[9px] font-bold text-slate-400 uppercase">Live Tap</span>
            </div>
         </div>

         <div className="grid grid-cols-3 gap-2">
           <a href="#geo-trace" className="min-w-0 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-center text-[11px] font-semibold text-cyan-100">Geo trace</a>
           <a href={`/login?consumer=1&next=${encodeURIComponent(marketplaceHref)}`} className="min-w-0 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 py-2 text-center text-[11px] font-semibold text-emerald-100">Registro</a>
           <a href={`/login?consumer=1&next=${encodeURIComponent(tenantSlug ? `/me?tenant=${tenantSlug}` : "/me")}`} className="min-w-0 rounded-xl border border-violet-300/30 bg-violet-500/15 px-2 py-2 text-center text-[11px] font-semibold text-violet-100">Portal</a>
         </div>

         {/* Hero Product Card */}
         <div className="sun-passport-card rounded-[2rem] border border-white/10 bg-slate-900/60 p-1 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="rounded-[1.75rem] border border-white/5 bg-slate-950 p-5 relative z-10 text-center">
               <div className="sun-product-stage mx-auto mb-4">
                  <div className={productVisualClass}>
                     <span className="sun-product-visual__tag">NFC</span>
                  </div>
                  <div className="sun-tap-wave" />
               </div>

               <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">{result.product?.winery || "Bodega Premium"}</p>
               <h1 className="text-xl font-bold text-white leading-tight mb-2">{result.product?.name || "Producto Verificado"}</h1>
               <p className="text-xs text-slate-500">{result.product?.region || "Mendoza, Argentina"} · {result.product?.varietal || "Blend"}</p>

               <div className="mt-6 inline-flex flex-col items-center justify-center">
                  <span className={`text-xs font-bold uppercase tracking-widest ${trustTone === "text-emerald-200" ? "text-emerald-400" : trustTone === "text-amber-200" ? "text-amber-400" : "text-red-400"}`}>
                     {result.status?.label || "AUTÉNTICO"}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Tap #{result.identity?.scanCount ?? 1}</span>
               </div>

               <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                     <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Certificado vivo</p>
                        <p className="mt-1 text-sm font-semibold text-white">{statusHeadline}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{trustCopy}</p>
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

         <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-4">
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

         <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-4">
           <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">Journey post tap</p>
           <div className="mt-3 grid grid-cols-4 gap-2">
             {journeySteps.map((step) => (
               <div key={step.id} className={`rounded-lg border px-2 py-2 text-center text-[10px] ${step.done ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-950/50 text-slate-400"}`}>
                 <p className="font-semibold">{step.done ? "✓" : "•"}</p>
                 <p className="mt-1 leading-tight">{step.label}</p>
               </div>
             ))}
           </div>
           <p className="mt-2 text-[11px] text-slate-300">{statusHeadline}</p>
         </div>

         <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-4">
           <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300">Prioridad operativa</p>
           <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
             <span className={`rounded-full border px-2 py-1 font-semibold ${securityTone}`}>{result.status?.label || "Estado"}</span>
             <span className={`rounded-full border px-2 py-1 font-semibold ${trustTone === "text-emerald-200" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : trustTone === "text-amber-200" ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-rose-300/30 bg-rose-500/10 text-rose-100"}`}>{riskLevelLabel}</span>
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

         <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-4">
           <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Acciones de passport</p>
           <div className="mt-3 grid gap-2">
             <a href="/register" className={`rounded-xl border px-3 py-2 text-xs font-semibold ${isValid ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "border-white/10 bg-slate-950/60 text-slate-400 pointer-events-none"}`}>
               Crear mi nexID Passport
             </a>
             <a href="/me/products" className={`rounded-xl border px-3 py-2 text-xs font-semibold ${isValid ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-slate-950/60 text-slate-400 pointer-events-none"}`}>
               Guardar producto
             </a>
             <a href={marketplaceHref} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${isValid ? "border-violet-300/30 bg-violet-500/15 text-violet-100" : "border-white/10 bg-slate-950/60 text-slate-400 pointer-events-none"}`}>
               Unirme al club de esta marca
             </a>
           </div>
           {isValid ? (
             <p className="mt-2 text-[11px] text-slate-300">Después de iniciar sesión podés reclamar ownership, guardar producto y unirte al tenant automáticamente.</p>
           ) : (
             <p className="mt-2 text-[11px] text-amber-200">{blockedTapReason}</p>
           )}
         </section>


         {/* Mobile Geo Trace / Enterprise Map */}
         <div id="geo-trace" className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 backdrop-blur-xl">
            <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Geo trace enterprise</p>
            <div className="mt-2">
               {effectiveMapPoints.length ? (
                  <WorldMapRealtime
                    title="Ruta de autenticidad"
                    subtitle="Vista tipo network: origen, hops de verificación y tap actual en trazado global."
                    points={effectiveMapPoints}
                    routes={mapRoutes}
                    initialExpanded
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
         {trustTone === "text-emerald-200" && (
             <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 mt-4">
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

                <a href="/me" className="block w-full py-3 rounded-xl border border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-100 text-center text-sm font-bold transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                   Unirme al Club y Sumar Puntos
                </a>
             </div>
         )}
   {/* Actions / Passport Banner */}
         {trustTone === "text-emerald-200" ? (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 mt-4 text-center">
               <h3 className="text-sm font-bold text-white mb-2">Crear mi NexID Passport</h3>
               <p className="text-xs text-cyan-200/70 mb-4">Guardá este producto en tu colección, sumá puntos y accedé a recompensas exclusivas.</p>
               <a href="/me" className="block w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-cyan-950 text-sm font-bold transition-colors">
                  Guardar Producto
               </a>
            </div>
         ) : (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5 mt-4 text-center">
               <h3 className="text-sm font-bold text-white mb-2">Acción Bloqueada</h3>
               <p className="text-xs text-red-200/70 mb-4">Por seguridad, este producto no puede ser guardado en la colección ni sumar puntos.</p>
               <button suppressHydrationWarning className="block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors">
                  Reportar Problema
               </button>
            </div>
         )}

         {/* Post-tap journey (mobile-first) */}
         <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-5 mt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Flujo post tap · SUN mobile</p>
            <h3 className="mt-2 text-sm font-bold text-white">Asociá este tap al tenant y entrá al club premium</h3>
            <div className="mt-3 space-y-2 text-xs text-slate-200">
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">1) Verificás autenticidad con NTAG424 DNA TT y estado anti-tamper.</div>
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">2) Activás ownership + garantía para abrir portal de usuario premium.</div>
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">3) Te unís al club del tenant ({result.identity?.tenantSlug || "tenant-demo"}) y desbloqueás beneficios.</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <a href="/register" className="rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-2 py-2 text-center font-semibold text-emerald-100">Registrarme</a>
              <a href="/me" className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-center font-semibold text-cyan-100">Abrir Portal</a>
            </div>
         </div>

         {/* Technical Spec */}
         <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 mt-4">
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
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">{String(result.tokenization?.status || "none")}</span>
               </div>
            </div>
         </div>

         {bid && uid ? (
           <div className="mt-4">
             <CtaActions bid={bid} uid={uid} />
           </div>
         ) : null}

         {canAutoOnboard ? <OnboardDemoButton bid={bid} /> : null}

      </div>

      <div className="fixed inset-x-0 bottom-3 z-40 mx-auto w-full max-w-[390px] px-3">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/85 p-2 backdrop-blur-xl">
          <a href="/register" className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 text-center text-xs font-semibold text-emerald-100">Registro</a>
          <a href="/me" className="flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 text-center text-xs font-semibold text-cyan-100">Portal</a>
          <a href="/?contact=sales&intent=sun_mobile#contact-modal" className="flex min-h-11 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/15 px-2 text-center text-xs font-semibold text-violet-100">Club</a>
        </div>
      </div>
    </main>
  );
}
