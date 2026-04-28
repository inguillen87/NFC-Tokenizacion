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

  const response = await fetch(`${apiBase()}/sun?${query.toString()}`, { cache: "no-store" });
  const result = await response.json().catch(() => ({ ok: false, status: { label: "Invalid response", summary: "No se pudo procesar la respuesta." } })) as SunContract;

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
  const fallbackNetworkPoints = [
    { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458, scans: 1, risk: 0, status: "AUTH_OK", source: "fallback_seed" },
    { city: "Córdoba", country: "AR", lat: -31.4201, lng: -64.1888, scans: 1, risk: 0, status: "EVENT_OK", source: "fallback_seed" },
    { city: "Mexico City", country: "MX", lat: 19.4326, lng: -99.1332, scans: 1, risk: 1, status: "DUPLICATE", source: "fallback_seed" },
    { city: "Bogotá", country: "CO", lat: 4.711, lng: -74.0721, scans: 1, risk: 0, status: "PHARMA_OK", source: "fallback_seed" },
  ];
  const effectiveMapPoints = mapPoints.length ? mapPoints : fallbackNetworkPoints;
  const orderedTimelinePoints = [...timelinePoints].reverse();
  const mapRoutes = [
    ...(wineryPoint.length && orderedTimelinePoints.length ? [{ fromLat: wineryPoint[0].lat, fromLng: wineryPoint[0].lng, toLat: orderedTimelinePoints[0].lat, toLng: orderedTimelinePoints[0].lng, label: "Origen de bodega → primer evento registrado", tone: "info" as const }] : []),
    ...(orderedTimelinePoints.length > 1 ? orderedTimelinePoints.slice(1).map((point, idx) => ({ fromLat: orderedTimelinePoints[idx].lat, fromLng: orderedTimelinePoints[idx].lng, toLat: point.lat, toLng: point.lng, tone: point.risk > 0 ? "warn" as const : "info" as const })) : []),
    ...(orderedTimelinePoints.length && currentTapPoint.length ? [{ fromLat: orderedTimelinePoints[orderedTimelinePoints.length - 1].lat, fromLng: orderedTimelinePoints[orderedTimelinePoints.length - 1].lng, toLat: currentTapPoint[0].lat, toLng: currentTapPoint[0].lng, label: "Último evento → tap actual", tone: currentTapPoint[0].risk > 0 ? "warn" as const : "info" as const }] : []),
  ];

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
  const pulseClass = isValid ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" : productState === "REPLAY_SUSPECT" ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.8)]" : "bg-rose-300 shadow-[0_0_8px_rgba(253,164,175,0.8)]";
  const statusHeadline = productState === "VALID_CLOSED"
    ? "Producto auténtico. Sello intacto."
    : productState === "VALID_MANUAL_OPENED"
      ? "Autenticidad confirmada. Sello marcado como abierto por operador."
    : productState === "VALID_OPENED"
      ? "Producto auténtico, pero el sello fue abierto."
    : productState === "VALID_UNKNOWN_TAMPER"
        ? "Autenticidad confirmada. Estado de apertura no disponible para este lote."
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


  return (
    <main className="min-h-screen bg-[#0a0a0c] text-slate-100 flex flex-col items-center py-6 px-4 font-sans relative overflow-hidden pb-safe pb-12">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-gradient-to-b from-cyan-900/20 to-transparent blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-[420px] z-10 space-y-4">
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
           <a href="#geo-trace" className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-center text-[11px] font-semibold text-cyan-100">Geo trace</a>
           <a href={`/login?consumer=1&next=${encodeURIComponent(marketplaceHref)}`} className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 py-2 text-center text-[11px] font-semibold text-emerald-100">Registrarme</a>
           <a href={`/login?consumer=1&next=${encodeURIComponent(tenantSlug ? `/me?tenant=${tenantSlug}` : "/me")}`} className="rounded-xl border border-violet-300/30 bg-violet-500/15 px-2 py-2 text-center text-[11px] font-semibold text-violet-100">Mi portal</a>
         </div>

         {/* Hero Product Card */}
         <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-1 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            {/* Verdict Glow */}
            <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30 ${trustTone === "text-emerald-200" ? "bg-emerald-500" : trustTone === "text-amber-200" ? "bg-amber-500" : "bg-red-500"}`}></div>

            <div className="rounded-[1.75rem] border border-white/5 bg-slate-950 p-6 relative z-10 text-center">
               <div className="w-24 h-24 mx-auto mb-4 bg-slate-900 rounded-full border-[4px] border-slate-800 flex items-center justify-center text-4xl shadow-inner relative">
                  {trustTone === "text-emerald-200" ? "🍷" : trustTone === "text-amber-200" ? "⚠️" : "❌"}

                  {/* Floating Trust Badge */}
                  <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full border text-[9px] font-bold shadow-lg ${trustTone === "text-emerald-200" ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300" : trustTone === "text-amber-200" ? "border-amber-500/30 bg-amber-500/20 text-amber-300" : "border-red-500/30 bg-red-500/20 text-red-300"}`}>
                     {trustScore}
                  </div>
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
            </div>
         </div>

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
                    metadataRows={(point) => [
                      { label: "Source", value: point.source || "trace" },
                      { label: "Status", value: point.status || "REVIEW" },
                    ]}
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
                <p className="text-[9px] uppercase text-slate-500">Cities</p>
                <p className="text-xs font-semibold text-white">{timelineCities}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1.5 text-center">
                <p className="text-[9px] uppercase text-slate-500">Last</p>
                <p className="text-[10px] font-semibold text-white">{lastEventAt ? fmtDate(lastEventAt) : "N/A"}</p>
              </div>
            </div>
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
                      <span className="text-lg">🍇</span>
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
               <button className="block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors">
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

      <div className="fixed inset-x-0 bottom-3 z-40 mx-auto w-full max-w-[375px] px-3">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/85 p-2 backdrop-blur-xl">
          <a href="/register" className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 text-center text-xs font-semibold text-emerald-100">Registro</a>
          <a href="/me" className="flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 text-center text-xs font-semibold text-cyan-100">Portal</a>
          <a href="/?contact=sales&intent=sun_mobile#contact-modal" className="flex min-h-11 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/15 px-2 text-center text-xs font-semibold text-violet-100">Club</a>
        </div>
      </div>
    </main>
  );
}
