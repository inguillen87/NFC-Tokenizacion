"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EmptyState, FilterBar, type GlobalOpsPoint, type GlobalOpsRoute } from "@product/ui";

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

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Global Ops Map</h3>
          <p className="text-xs text-slate-400">Vista enterprise con hubs, rutas y playback para taps premium.</p>
        </div>
        <button suppressHydrationWarning type="button" className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300" onClick={resetFilters}>Reset filters</button>
      </div>

      <div className="mt-3">
        <FilterBar contentClassName={mode === "demo" ? "md:grid-cols-3" : "md:grid-cols-2"}>
          <select suppressHydrationWarning className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={eventFilter} onChange={(event) => setEventFilter(event.target.value as EventFilter)}>
            <option value="all">Todos los eventos</option>
            <option value="clean">AUTH OK</option>
            <option value="risk">Solo riesgo</option>
          </select>
          <select suppressHydrationWarning className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {mode === "demo" ? (
            <select suppressHydrationWarning className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}>
              <option value="selected">Solo demo seleccionado</option>
              <option value="all">Todo el tráfico demo</option>
            </select>
          ) : <div />}
        </FilterBar>
      </div>

      <div className="mt-3">
        {normalizedPoints.length === 0 ? (
          <EmptyState title="Sin hubs visibles" description="Probá cambiar país, scope o tipo de evento." className="border-dashed px-4 py-10 text-center text-sm text-slate-400" />
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

      <p className="mt-2 text-[11px] text-slate-500">
        Scope actual: {mode === "demo" ? (scope === "selected" ? `pack ${selectedPack || "activo"}` : "todas las verticales demo") : mode === "tenant" ? "tenant operativo" : "global"}.
      </p>
    </div>
  );
}
