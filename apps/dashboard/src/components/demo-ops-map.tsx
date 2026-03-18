"use client";

import { useEffect, useMemo, useState } from "react";
import { WorldMapPlaceholder } from "@product/ui";

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

export function DemoOpsMap({ points, selectedVertical, selectedPack }: { points: MapPoint[]; selectedVertical?: string; selectedPack?: string }) {
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
        const scopeMatch = scope === "all" ? true : selectedVertical ? point.vertical === selectedVertical : true;
        return countryMatch && eventMatch && scopeMatch;
      }),
    [points, country, eventFilter, scope, selectedVertical]
  );

  const playablePoints = useMemo(() => {
    const total = filteredPoints.length;
    if (total === 0) return [];
    const limit = Math.max(1, Math.round((index / 100) * total));
    return filteredPoints.slice(0, limit);
  }, [filteredPoints, index]);

  const riskPoints = useMemo(() => playablePoints.filter((point) => point.risk > 0).length, [playablePoints]);



  useEffect(() => {
    if (!playback) return;
    const timer = setInterval(() => {
      setIndex((value) => (value >= 100 ? 10 : Math.min(100, value + 10)));
    }, 700);
    return () => clearInterval(timer);
  }, [playback]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Ops Map Pro (Enterprise Visual)</h3>
          <p className="text-xs text-slate-400">Playback + filtros + clusters visuales sobre datos reales de demo/live feed.</p>
        </div>
        <button type="button" className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white" onClick={() => setPlayback((value) => !value)}>
          {playback ? "Pause playback" : "Play playback"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
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
        <select className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}>
          <option value="selected">Solo demo seleccionado</option>
          <option value="all">Todo el tráfico demo</option>
        </select>
      </div>

      <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
        Scope actual: <b>{scope === "selected" ? `pack ${selectedPack || "activo"} / vertical ${selectedVertical || "demo"}` : "todas las verticales demo"}</b>.
        {scope === "selected" ? " Así evitamos mezclar ruido de otras demos cuando querés presentar un caso puntual." : " Vista agregada para enseñar calor multi-tenant / multi-artículo sin perder el legado del mapa global."}
      </div>

      <div className="mt-3">
        <WorldMapPlaceholder
          title="Global verification map"
          subtitle="Fuente: eventos live/simulados consolidados por tenant + vertical + estado, con scope entre demo elegido y tráfico global."
          points={playablePoints}
        />
      </div>

      <div className="mt-3">
        <input type="range" min={10} max={100} step={10} value={index} onChange={(event) => setIndex(Number(event.target.value))} className="w-full" />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">{playablePoints.length} hubs activos · {riskPoints} con riesgo · {scope === "selected" ? "foco en el demo elegido" : "vista heat global consolidada"}.</p>
    </div>
  );
}
