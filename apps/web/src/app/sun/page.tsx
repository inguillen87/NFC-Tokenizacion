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

type SunContract = {
  ok?: boolean;
  status?: { code?: string; label?: string; tone?: "good" | "warn" | "risk"; summary?: string; reason?: string };
  identity?: { bid?: string | null; uid?: string | null; readCounter?: number | null; tagStatus?: string | null; scanCount?: number | null };
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
      images: [{ url: `/og-image?surface=sun&campaign=enterprise&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
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
  const statusHeadline = result.status?.tone === "good"
    ? "Autenticidad verificada"
    : result.status?.tone === "risk"
      ? "Se detectaron señales de riesgo"
      : "Validación en revisión";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-slate-100 sm:py-10">
      <section className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.15),transparent_40%),#020617] p-4 shadow-[0_24px_70px_rgba(2,6,23,.7)] sm:p-6">
        <h1 className="text-xl font-semibold sm:text-2xl">NexID Product Passport</h1>
        <p className="mt-2 text-xs text-slate-300 sm:text-sm">Experiencia pública mobile-first tras el tap NFC: autenticidad, provenance y trazabilidad verificable.</p>
        <section className="mt-3 rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-emerald-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-white">{result.product?.name || "Producto premium"}</p>
            <p className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              Passport live view
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-300">{result.product?.winery || "Bodega"} · {result.product?.region || "Región no informada"} · {result.product?.varietal || "Blend"}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className={`rounded-full border px-2 py-0.5 ${toneClass}`}>{result.status?.label || "VALIDACIÓN"}</span>
            <span className={`rounded-full border px-2 py-0.5 ${trustTone === "text-emerald-200" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : trustTone === "text-amber-200" ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-rose-300/30 bg-rose-500/10 text-rose-100"}`}>Trust {trustScore}</span>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-slate-200">Scans {result.identity?.scanCount ?? "-"}</span>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-slate-200">Token {String(result.tokenization?.status || "none").toUpperCase()}</span>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-slate-400">Authenticity status</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${toneClass}`}>{result.status?.label || "Validación"}</p>
              <p className="text-sm font-semibold text-white">{statusIcon} {statusHeadline}</p>
            </div>
            <p className="mt-2 text-xs text-slate-300 sm:text-sm">{result.status?.summary || "Sin resumen disponible."}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] text-slate-200">
                <p className="uppercase tracking-[0.12em] text-slate-400">Integridad</p>
                <p className="mt-1">{isValid ? "Consistente" : "Requiere validación manual"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] text-slate-200">
                <p className="uppercase tracking-[0.12em] text-slate-400">Provenance</p>
                <p className="mt-1">{timelineCount ? `${timelineCount} eventos históricos` : "Sin eventos históricos"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] text-slate-200">
                <p className="uppercase tracking-[0.12em] text-slate-400">Ledger</p>
                <p className="mt-1">{result.tokenization?.status ? `Token ${String(result.tokenization.status).toUpperCase()}` : "Sin token activo"}</p>
              </div>
            </div>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">BID</p>
            <p className="mt-2 text-sm text-white">{bid || "(missing)"}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">UID</p>
            <p className="mt-2 break-all text-sm text-white">{uid || "(missing)"}</p>
          </article>
        </section>
        <section className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <a href="#sun-timeline" className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100 hover:bg-cyan-500/20">Ir a timeline</a>
          <a href="#sun-map" className="rounded-full border border-indigo-300/30 bg-indigo-500/10 px-3 py-1 text-indigo-100 hover:bg-indigo-500/20">Ir al mapa</a>
          <a href="#sun-actions" className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-emerald-100 hover:bg-emerald-500/20">Ir a acciones</a>
        </section>
        <section className="mt-3 grid gap-2 sm:grid-cols-4">
          <article className={`rounded-xl border p-3 text-xs ${securityTone}`}>
            <p className="uppercase tracking-[0.12em] opacity-80">Security</p>
            <p className="mt-1 text-sm font-semibold">{isValid ? "Tap confiable" : "Revisar tap"}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-400">Scan count</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.identity?.scanCount ?? "-"}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-400">Read counter</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.identity?.readCounter ?? "-"}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-400">Tokenization</p>
            <p className="mt-1 text-sm font-semibold text-white">{String(result.tokenization?.status || "none").toUpperCase()}</p>
          </article>
        </section>
        <section className="mt-3 rounded-xl border border-cyan-300/20 bg-slate-950/70 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-300">Trust score</p>
            <p className={`font-semibold ${trustTone}`}>{trustScore}/100</p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${trustScore >= 85 ? "bg-emerald-400" : trustScore >= 65 ? "bg-amber-300" : "bg-rose-400"}`}
              style={{ width: `${trustScore}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Score compuesto con estado SUN, señales de riesgo en timeline, tokenización y consistencia de escaneos.
          </p>
        </section>
        <section className="mt-3 grid gap-2 sm:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-400">Eventos timeline</p>
            <p className="mt-1 text-base font-semibold text-cyan-100">{timelineCount}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-400">Ciudades verificadas</p>
            <p className="mt-1 text-base font-semibold text-indigo-100">{timelineCities}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs">
            <p className="uppercase tracking-[0.12em] text-slate-400">Último evento</p>
            <p className="mt-1 text-sm font-semibold text-emerald-100">{fmtDate(lastEventAt)}</p>
          </article>
        </section>

        {troubleshooting.length ? (
          <section className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Troubleshooting guiado</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-50">{troubleshooting.map((item) => <li key={item}>{item}</li>)}</ul>
            {canAutoOnboard ? <OnboardDemoButton bid={bid} /> : null}
          </section>
        ) : (
          <section className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-100">Estado consistente</p>
            <p className="mt-1 text-xs text-emerald-50">Producto autenticado. Podés continuar con ownership/warranty/provenance.</p>
          </section>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Product identity</p>
            <p className="mt-2 text-sm font-semibold text-white">{result.product?.name || "Producto no perfilado"}</p>
            <div className="mt-2">
              <KeyValueSpec
                columns={1}
                items={[
                  { label: "Bodega/Región", value: `${result.product?.winery || "-"} · ${result.product?.region || "-"}` },
                  { label: "Varietal/Vintage", value: `${result.product?.varietal || "-"} · ${result.product?.vintage || "-"}` },
                ]}
              />
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Origin</p>
            <p className="mt-2 text-sm text-white">{result.provenance?.origin || "-"}</p>
            <p className="mt-2 text-xs text-slate-300">Harvest year: <b>{result.product?.harvestYear ?? "-"}</b> · Barrel months: <b>{result.product?.barrelMonths ?? "-"}</b></p>
            <p className="mt-1 text-xs text-slate-300">Storage: <b>{result.product?.storage || "-"}</b></p>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">First verified</p>
            <p className="mt-2 text-xs text-slate-300"><b>{fmtDate(result.provenance?.firstVerified?.at)}</b></p>
            <p className="text-xs text-slate-400">{result.provenance?.firstVerified?.city || "-"}, {result.provenance?.firstVerified?.country || "-"}</p>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Last verified location</p>
            <p className="mt-2 text-xs text-slate-300"><b>{fmtDate(result.provenance?.lastVerifiedLocation?.at)}</b></p>
            <p className="text-xs text-slate-400">{result.provenance?.lastVerifiedLocation?.city || "-"}, {result.provenance?.lastVerifiedLocation?.country || "-"}</p>
            <p className="text-xs text-slate-500">Resultado: {result.provenance?.lastVerifiedLocation?.result || "-"}</p>
          </article>
        </section>

        <section id="sun-timeline" className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Provenance timeline summary</p>
          {result.provenance?.timelineSummary?.length ? (
            <div className="mt-2">
              <TimelineRail
                items={result.provenance.timelineSummary.map((item, idx) => ({
                  id: `${item.at || idx}-${idx}`,
                  title: `${item.result || "-"} · ${fmtDate(item.at || null)}`,
                  subtitle: `${item.city || "-"}, ${item.country || "-"}`,
                  meta: item.device || "Unknown device",
                }))}
              />
            </div>
          ) : <EmptyState title="Sin timeline disponible" description="Aún no hay verificaciones para construir el resumen de provenance." className="mt-2" />}
        </section>
        <section id="sun-map" className="mt-4 rounded-xl border border-cyan-300/20 bg-slate-950/60 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-400">Wine journey map</p>
          {mapPoints.length ? (
            <div className="mt-2">
              <WorldMapRealtime
                title="Mapa interactivo del recorrido"
                subtitle="Origen de bodega, taps históricos y tap móvil actual (cuando hay geolocalización disponible)."
                points={mapPoints}
                routes={mapRoutes}
              />
            </div>
          ) : <EmptyState title="Mapa no disponible todavía" description="No se recibió lat/lng en eventos o tap actual. Reintentá con un tap real en dispositivo móvil." className="mt-2" />}
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Tokenization</p>
          <p className="mt-2 text-xs text-slate-300">Status: <b>{result.tokenization?.status || "none"}</b> · Network: <b>{result.tokenization?.network || "-"}</b></p>
          <p className="mt-1 break-all text-xs text-slate-500">Token ID: {result.tokenization?.tokenId || "-"} · Tx: {result.tokenization?.txHash || "-"}</p>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Technical</p>
          <p className="mt-2 text-xs text-slate-300">UID: <b>{uid || "N/A"}</b> · BID: <b>{bid || "N/A"}</b> · Read counter: <b>{result.identity?.readCounter ?? "N/A"}</b></p>
          <details className="mt-2 rounded-lg border border-white/10 bg-slate-900/70 p-2 text-xs text-slate-300">
            <summary className="cursor-pointer text-slate-200">Technical details (raw diagnostics)</summary>
            <p className="mt-2">picc_data: <DeviceSignatureBadge label={result.technical?.raw?.piccDataPrefix || "-"} /></p>
            <p>enc: <DeviceSignatureBadge label={result.technical?.raw?.encPrefix || "-"} /></p>
            <p>cmac: <DeviceSignatureBadge label={result.technical?.raw?.cmacPrefix || "-"} /></p>
            <pre className="mt-2 overflow-x-auto rounded border border-white/10 bg-slate-950/60 p-2">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      </section>

      {result.cta?.claimOwnership && bid && uid ? (
        <section id="sun-actions" className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <p className="text-sm font-semibold text-cyan-100">Passport actions</p>
          <p className="mt-1 text-xs text-cyan-50">Crear mi NexID Passport, guardar este producto y sumar puntos con esta marca.</p>
          <CtaActions bid={bid} uid={uid} />
          <div className="mt-3 grid gap-2 text-[11px] text-cyan-100 sm:grid-cols-2">
            <a className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 hover:bg-cyan-500/20" href={`/sun?${query.toString()}&view=html`} target="_blank" rel="noreferrer">Abrir SUN HTML interactivo</a>
            <a className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 hover:bg-cyan-500/20" href={`/api/public-cta/provenance?bid=${encodeURIComponent(bid)}&uid=${encodeURIComponent(uid)}`} target="_blank" rel="noreferrer">Probar endpoint de provenance</a>
          </div>
          <p className="mt-2 text-[11px] text-cyan-100/80">Nota comercial: este flujo usa <b>request-to-buy</b> (no checkout directo).</p>
        </section>
      ) : (
        <p className="mt-4 text-xs text-amber-200">No CTA available yet: missing bid/uid in SUN result.</p>
      )}

      {!isValid ? (
        <section className="mt-2 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-[11px] text-rose-100">
          Señal de seguridad: si el resultado indica replay o tamper, las acciones de ownership pueden quedar bloqueadas hasta revisión manual.
          <p className="mt-1 text-rose-50/80">Nota: esta pantalla muestra “last verified location”; no representa tracking en tiempo real.</p>
        </section>
      ) : null}
    </main>
  );
}
