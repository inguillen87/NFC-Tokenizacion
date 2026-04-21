"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, FilterBar, WorldMapRealtime } from "@product/ui";
import { RealOpsMap } from "./real-ops-map";

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
  const [playback, setPlayback] = useState(false);
  const [index, setIndex] = useState(100);
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

  const playablePoints = useMemo(() => {
    const total = filteredPoints.length;
    if (total === 0) return [];
    const limit = Math.max(1, Math.round((index / 100) * total));
    return filteredPoints.slice(0, limit);
  }, [filteredPoints, index]);

  const riskPoints = useMemo(() => playablePoints.filter((point) => point.risk > 0).length, [playablePoints]);
  const uniqueCountries = useMemo(() => new Set(playablePoints.map((point) => point.country)).size, [playablePoints]);
  const coverage = filteredPoints.length > 0 ? Math.round((playablePoints.length / filteredPoints.length) * 100) : 0;

  useEffect(() => {
    if (!playback) return;
    const timer = setInterval(() => {
      setIndex((value) => (value >= 100 ? 10 : Math.min(100, value + 10)));
    }, 700);
    return () => clearInterval(timer);
  }, [playback]);

  function resetFilters() {
    setPlayback(false);
    setIndex(100);
    setEventFilter("all");
    setCountry("ALL");
    if (mode === "demo") setScope("selected");
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Ops Map Pro (Enterprise Visual)</h3>
          <p className="text-xs text-slate-400">
            {mode === "tenant"
              ? "Playback + filtros sobre eventos operativos reales de tu tenant."
              : mode === "global"
                ? "Playback + filtros sobre datos operativos multi-tenant."
                : "Playback + filtros + clusters visuales sobre datos reales de demo/live feed."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white" onClick={() => setPlayback((value) => !value)}>
            {playback ? "Pause playback" : "Play playback"}
          </button>
          <button type="button" className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p className="text-slate-400">Visible hubs</p>
          <p className="mt-1 text-lg font-semibold text-white">{playablePoints.length}</p>
          <p className="text-[11px] text-slate-500">{coverage}% del scope filtrado</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p className="text-slate-400">Risk nodes</p>
          <p className="mt-1 text-lg font-semibold text-white">{riskPoints}</p>
          <p className="text-[11px] text-slate-500">alertas visibles en el mapa</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p className="text-slate-400">Countries</p>
          <p className="mt-1 text-lg font-semibold text-white">{uniqueCountries}</p>
          <p className="text-[11px] text-slate-500">cobertura geográfica actual</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p className="text-slate-400">Playback</p>
          <p className="mt-1 text-lg font-semibold text-white">{index}%</p>
          <p className="text-[11px] text-slate-500">ventana de reproducción</p>
        </div>
      </div>

      <div className="mt-3">
        <FilterBar contentClassName={mode === "demo" ? "md:grid-cols-3" : "md:grid-cols-2"}>
          <select className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={eventFilter} onChange={(event) => setEventFilter(event.target.value as EventFilter)}>
            <option value="all">Todos los eventos</option>
            <option value="clean">AUTH OK</option>
            <option value="risk">Solo riesgo</option>
          </select>
          <select className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          {mode === "demo" ? (
            <select className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}>
              <option value="selected">Solo demo seleccionado</option>
              <option value="all">Todo el tráfico demo</option>
            </select>
          ) : <div />}
        </FilterBar>
      </div>

      {mode === "demo" ? (
        <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
          Scope actual: <b>{scope === "selected" ? `pack ${selectedPack || "activo"} / vertical ${selectedVertical || "demo"}` : "todas las verticales demo"}</b>.
          {scope === "selected" ? " Así evitamos mezclar ruido de otras demos cuando querés presentar un caso puntual." : " Vista agregada para enseñar calor multi-tenant / multi-artículo sin perder el legado del mapa global."}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          Scope actual: <b>{mode === "tenant" ? "tenant operativo activo" : "multi-tenant operacional"}</b>. Filtros orientados a operación real.
        </div>
      )}

      <div className="mt-3">
        {playablePoints.length === 0 ? (
          <EmptyState title="Sin hubs visibles" description="Probá cambiar país, scope o tipo de evento." className="border-dashed px-4 py-10 text-center text-sm text-slate-400" />
        ) : mode === "demo" ? (
          <WorldMapRealtime
            title="Global verification map"
            subtitle="Fuente: eventos live/simulados consolidados por tenant + vertical + estado, con scope entre demo elegido y tráfico global."
            points={playablePoints}
            metadataRows={(point) => [
              { label: "Pack/vertical", value: point.vertical || "-" },
              { label: "Mode", value: mode },
            ]}
          />
        ) : (
          <RealOpsMap
            points={playablePoints}
            scopeLabel={mode === "tenant" ? "tenant operativo activo" : "multi-tenant operacional"}
          />
        )}
      </div>

      <div className="mt-3">
        <input type="range" min={10} max={100} step={10} value={index} onChange={(event) => setIndex(Number(event.target.value))} className="w-full" />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {playablePoints.length} hubs activos · {riskPoints} con riesgo · {mode === "demo" ? (scope === "selected" ? "foco en el demo elegido" : "vista heat global consolidada") : mode === "tenant" ? "foco en el tenant operativo" : "vista global operacional"}.
      </p>
    </div>
  );
}
