"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EmptyState, FilterBar, type GlobalOpsPoint, type GlobalOpsRoute } from "@product/ui";
import { ShieldAlert, ShieldCheck, MapPin, RefreshCw, Layers } from "lucide-react";

const GlobalOpsMap = dynamic(() => import("@product/ui").then((mod) => mod.GlobalOpsMap), { ssr: false });

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
};

type EventFilter = "all" | "clean" | "risk";
type ScopeFilter = "selected" | "all";
type MapMode = "demo" | "tenant" | "global";

export function DemoOpsMap({
  points,
  selectedVertical,
  selectedPack,
  mode = "demo",
}: {
  points: MapPoint[];
  selectedVertical?: string;
  selectedPack?: string;
  mode?: MapMode;
}) {
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [country, setCountry] = useState("ALL");
  const [scope, setScope] = useState<ScopeFilter>("selected");

  const countries = useMemo(() => ["ALL", ...Array.from(new Set(points.map((point) => point.country))).sort()], [points]);

  const filteredPoints = useMemo(
    () =>
      points.filter((point) => {
        const countryMatch = country === "ALL" ? true : point.country === country;
        const eventMatch = eventFilter === "all" ? true : eventFilter === "clean" ? point.risk === 0 : point.risk > 0;
        const scopeMatch = mode === "demo" ? (scope === "all" ? true : selectedVertical ? point.vertical === selectedVertical : true) : true;
        return countryMatch && eventMatch && scopeMatch;
      }),
    [country, eventFilter, mode, points, scope, selectedVertical],
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
    lastSeen: point.lastSeen || new Date().toISOString(),
    uid: point.uid,
    device: point.device,
  })), [filteredPoints]);

  const routes = useMemo<GlobalOpsRoute[]>(() => normalizedPoints.slice(1, 120).map((point, index) => ({
    id: `demo-route-${index}-${point.id}`,
    fromLat: normalizedPoints[index]?.lat ?? point.lat,
    fromLng: normalizedPoints[index]?.lng ?? point.lng,
    toLat: point.lat,
    toLng: point.lng,
    uid: point.uid || point.id,
    risk: point.risk,
    taps: point.scans,
    firstSeenAt: normalizedPoints[index]?.lastSeen ?? point.lastSeen,
    lastSeenAt: point.lastSeen,
  })), [normalizedPoints]);

  function resetFilters() {
    setEventFilter("all");
    setCountry("ALL");
    if (mode === "demo") setScope("selected");
  }

  // Visual metric values
  const totalScans = filteredPoints.reduce((acc, curr) => acc + curr.scans, 0);
  const cleanCount = filteredPoints.filter(p => p.risk === 0).length;
  const riskCount = filteredPoints.filter(p => p.risk > 0).length;
  const uniqueCities = new Set(filteredPoints.map(p => p.city)).size;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-200 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400 animate-pulse" />
            Mapa Geográfico Operativo
          </h3>
          <p className="text-xs text-slate-400">Rastreo satelital en vivo de taps de producto, procedencias y detección de fraude por geolocalización.</p>
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

      {/* Floating HUD over the map control */}
      <div className="mt-4 grid gap-2 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Taps Geotrazados</span>
          <b className="mt-1 block text-sm font-black text-cyan-300">{totalScans}</b>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Hubs de Lectura</span>
          <b className="mt-1 block text-sm font-black text-white">{uniqueCities} ciudades</b>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Autenticaciones OK</span>
          <b className="mt-1 block text-sm font-black text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 inline" /> {cleanCount}
          </b>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
          <span className="text-slate-400">Alertas de Riesgo</span>
          <b className="mt-1 block text-sm font-black text-rose-400 flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 inline animate-bounce" /> {riskCount}
          </b>
        </div>
      </div>

      {/* Premium Toggle Buttons for Filters */}
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
              Autenticado
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
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/5 bg-slate-900/25">
        {normalizedPoints.length === 0 ? (
          <EmptyState title="Sin hubs visibles" description="Probá cambiar país, scope o tipo de evento." className="border-dashed px-4 py-12 text-center text-sm text-slate-400" />
        ) : (
          <GlobalOpsMap
            title={mode === "demo" ? "Heatmap operativo demo" : mode === "tenant" ? "Heatmap tenant en vivo" : "Heatmap global multi-tenant"}
            subtitle="Mapa de calor, clusters y rutas punteadas entre eventos de tap."
            mode={mode}
            points={normalizedPoints}
            routes={routes}
            playbackEnabled
            riskOnly={eventFilter === "risk"}
          />
        )}
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        Ubicación física mapeada: {mode === "demo" ? (scope === "selected" ? `pack:${selectedPack || "activo"}` : "todas las verticales demo") : mode === "tenant" ? `tenant:${selectedPack || "activo"}` : "global"}.
      </p>
    </div>
  );
}
