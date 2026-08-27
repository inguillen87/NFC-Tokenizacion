"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EmptyState } from "@product/ui";
import type { GlobalOpsPoint } from "@product/ui/global-ops-map";
import { ShieldAlert, ShieldCheck, MapPin, RefreshCw } from "lucide-react";
import { classifyLocationProvenance, locationProvenanceLabel, type LocationProvenanceClass } from "../lib/location-provenance";

const GlobalOpsMap = dynamic(() => import("@product/ui/global-ops-map").then((mod) => mod.GlobalOpsMap), { ssr: false });

type MapPoint = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  scans: number;
  risk: number;
  vertical?: string;
  status?: string;
  source?: string;
  lastSeen?: string;
  tenantSlug?: string;
  uid?: string;
  device?: string;
  locationSource?: string | null;
  locationAccuracyM?: number | null;
};

type EventFilter = "all" | "clean" | "risk";
type ScopeFilter = "selected" | "all";
type LocationFilter = "all" | LocationProvenanceClass;
type MapMode = "demo" | "tenant" | "global";

const LOCATION_FILTERS: Array<{ value: LocationFilter; label: string; tone: string }> = [
  { value: "all", label: "Todas", tone: "bg-white/10 text-white" },
  { value: "consented_gps", label: "GPS consentido", tone: "bg-emerald-500/20 text-emerald-200" },
  { value: "network_approx", label: "Red/IP", tone: "bg-amber-500/20 text-amber-200" },
  { value: "mixed_approx", label: "Mixta", tone: "bg-violet-500/20 text-violet-200" },
  { value: "other_reported", label: "Otra", tone: "bg-slate-500/20 text-slate-200" },
];

export function DemoOpsMap({
  points,
  selectedVertical,
  selectedPack,
  mode = "demo",
  chrome = "full",
}: {
  points: MapPoint[];
  selectedVertical?: string;
  selectedPack?: string;
  mode?: MapMode;
  chrome?: "full" | "compact";
}) {
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [country, setCountry] = useState("ALL");
  const [scope, setScope] = useState<ScopeFilter>("selected");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const countries = useMemo(() => ["ALL", ...Array.from(new Set(points.map((point) => point.country))).sort()], [points]);
  const hasLocationProvenance = useMemo(() => points.some((point) => Boolean(String(point.locationSource || "").trim())), [points]);
  const effectiveLocationFilter: LocationFilter = hasLocationProvenance ? locationFilter : "all";
  const locationCounts = useMemo(() => points.reduce((counts, point) => {
    counts[classifyLocationProvenance(point.locationSource)] += 1;
    return counts;
  }, {
    consented_gps: 0,
    network_approx: 0,
    mixed_approx: 0,
    other_reported: 0,
  } as Record<LocationProvenanceClass, number>), [points]);

  const filteredPoints = useMemo(
    () =>
      points.filter((point) => {
        const countryMatch = country === "ALL" ? true : point.country === country;
        const eventMatch = eventFilter === "all" ? true : eventFilter === "clean" ? point.risk === 0 : point.risk > 0;
        const scopeMatch = mode === "demo" ? (scope === "all" ? true : selectedVertical ? point.vertical === selectedVertical : true) : true;
        const locationMatch = effectiveLocationFilter === "all" ? true : classifyLocationProvenance(point.locationSource) === effectiveLocationFilter;
        return countryMatch && eventMatch && scopeMatch && locationMatch;
      }),
    [country, effectiveLocationFilter, eventFilter, mode, points, scope, selectedVertical],
  );

  const normalizedPoints = useMemo<GlobalOpsPoint[]>(() => filteredPoints.map((point, index) => ({
    id: `${point.tenantSlug || point.vertical || "demo"}-${point.city}-${index}`,
    city: point.city,
    country: point.country,
    lat: point.lat,
    lng: point.lng,
    scans: point.scans,
    risk: point.risk,
    verdict: point.status || (point.risk > 0 ? "RISK" : "VALID"),
    tenantSlug: point.tenantSlug || point.vertical || "demo",
    lastSeen: point.lastSeen || "",
    uid: point.uid,
    device: [point.device, point.locationSource ? locationProvenanceLabel(point.locationSource) : ""].filter(Boolean).join(" · ") || undefined,
    role: classifyLocationProvenance(point.locationSource) === "consented_gps" ? "tap" : "hub",
    locationSource: point.locationSource || undefined,
    locationAccuracyM: point.locationAccuracyM ?? undefined,
  })), [filteredPoints]);

  function resetFilters() {
    setEventFilter("all");
    setCountry("ALL");
    setLocationFilter("all");
    if (mode === "demo") setScope("selected");
  }

  // Visual metric values
  const totalScans = filteredPoints.reduce((acc, curr) => acc + curr.scans, 0);
  const cleanCount = filteredPoints.filter(p => p.risk === 0).length;
  const riskCount = filteredPoints.filter(p => p.risk > 0).length;
  const uniqueCities = new Set(filteredPoints.map(p => p.city)).size;
  const isCompact = chrome === "compact";

  return (
    <div className={`min-w-0 overflow-hidden ${isCompact ? "rounded-xl border border-white/5 bg-slate-950/35 p-0" : "rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl backdrop-blur-xl sm:p-5"}`}>
      {!isCompact ? (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-200 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400 animate-pulse" />
            Mapa Geográfico Operativo
          </h3>
          <p className="text-xs text-slate-400">Mapa operativo de lecturas de producto, zonas, procedencia reportada y riesgo por geolocalización.</p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:text-white transition-colors"
          onClick={resetFilters}
        >
          <RefreshCw className="h-3 w-3" />
          Restablecer
        </button>
      </div>
      ) : null}

      {/* Floating HUD over the map control */}
      {!isCompact ? (
      <div className="mt-4 grid gap-2 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Lecturas agregadas</span>
          <b className="mt-1 block text-sm font-black text-cyan-300">{totalScans}</b>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Hubs de Lectura</span>
          <b className="mt-1 block text-sm font-black text-white">{uniqueCities} ciudades</b>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Zonas sin alertas</span>
          <b className="mt-1 block text-sm font-black text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 inline" /> {cleanCount}
          </b>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Zonas con riesgo</span>
          <b className="mt-1 block text-sm font-black text-rose-400 flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 inline animate-bounce" /> {riskCount}
          </b>
        </div>
      </div>
      ) : null}

      {/* Premium Toggle Buttons for Filters */}
      {!isCompact ? (
      <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filtro Alertas:</span>
          <div className="flex rounded-lg bg-slate-900 p-0.5 border border-white/5">
            <button
              onClick={() => setEventFilter("all")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${eventFilter === "all" ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              Todos
            </button>
            <button
              onClick={() => setEventFilter("clean")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${eventFilter === "clean" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              Sin alerta reportada
            </button>
            <button
              onClick={() => setEventFilter("risk")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${eventFilter === "risk" ? "bg-rose-500/20 text-rose-300 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              Riesgo
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">País:</span>
            <select
              suppressHydrationWarning
              className="rounded-lg border border-white/10 bg-slate-900 p-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {countries.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          {mode === "demo" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scope:</span>
              <div className="flex rounded-lg bg-slate-900 p-0.5 border border-white/5">
                <button
                  onClick={() => setScope("selected")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${scope === "selected" ? "bg-purple-500/20 text-purple-300 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  Demo Pack
                </button>
                <button
                  onClick={() => setScope("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${scope === "all" ? "bg-purple-500/20 text-purple-300 font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  Todo Demo
                </button>
              </div>
            </div>
          )}
        </div>

        {hasLocationProvenance ? (
          <div className="basis-full border-t border-white/5 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Procedencia geográfica:</span>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por procedencia geográfica">
              {LOCATION_FILTERS.map((item) => {
                const count = item.value === "all"
                  ? points.length
                  : locationCounts[item.value];
                return (
                  <button
                    key={item.value}
                    suppressHydrationWarning
                    type="button"
                    aria-pressed={effectiveLocationFilter === item.value}
                    onClick={() => setLocationFilter(item.value)}
                    className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${effectiveLocationFilter === item.value ? `${item.tone} border-white/20` : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}
                  >
                    {item.label} · {count} {count === 1 ? "zona" : "zonas"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {hasLocationProvenance ? (
        <div data-location-provenance-legend="gps-network" className={`${isCompact ? "mx-2 mt-2" : "mt-3"} flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/8 bg-slate-950/65 px-3 py-2 text-[10px] text-slate-300`}>
          <span className="font-black uppercase tracking-[0.12em] text-slate-400">Precisión</span>
          <span className="text-emerald-200"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />GPS consentido: zona aproximada más acotada</span>
          <span className="text-amber-200"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />Red/IP: zona amplia, no posición del teléfono</span>
          <span className="text-violet-200"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" aria-hidden="true" />Mixta/otra: procedencia no homogénea</span>
        </div>
      ) : null}

      <div className={isCompact ? "overflow-hidden rounded-xl border border-white/5 bg-slate-900/25" : "mt-3 overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/25"}>
        {normalizedPoints.length === 0 ? (
          <EmptyState title="Sin hubs visibles" description="Probá cambiar país, procedencia, scope o tipo de evento." className="border-dashed px-4 py-12 text-center text-sm text-slate-400" />
        ) : (
          <div className={isCompact ? "min-w-0" : "min-w-[560px]"}>
          <GlobalOpsMap
            title={mode === "demo" ? "Heatmap operativo demo" : mode === "tenant" ? "Heatmap agregado del tenant" : "Heatmap agregado multi-tenant"}
            subtitle="Mapa de calor y clusters por ciudad. No infiere recorridos entre puntos agregados."
            mode={mode}
            points={normalizedPoints}
            routes={[]}
            playbackEnabled={false}
            riskOnly={eventFilter === "risk"}
            chrome={isCompact ? "compact" : "full"}
            sourceLabel={hasLocationProvenance ? "Coordenadas persistidas con procedencia" : undefined}
            locationNote={hasLocationProvenance ? (effectiveLocationFilter === "all" ? "GPS consentido y red/IP separados" : `Filtro: ${LOCATION_FILTERS.find((item) => item.value === effectiveLocationFilter)?.label || "procedencia"}`) : undefined}
          />
          </div>
        )}
      </div>

      {!isCompact ? (
      <p className="mt-2 text-[10px] text-slate-500">
        Cobertura geografica agregada: {mode === "demo" ? (scope === "selected" ? `pack:${selectedPack || "activo"}` : "todas las verticales demo") : mode === "tenant" ? `tenant:${selectedPack || "activo"}` : "global"}. Los puntos no reconstruyen trayectos.
      </p>
      ) : null}
    </div>
  );
}
