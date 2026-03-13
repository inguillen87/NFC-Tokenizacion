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
};

type EventFilter = "all" | "clean" | "risk";

const STYLE_URL = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL || "";

export function DemoOpsMap({ points }: { points: MapPoint[] }) {
  const [playback, setPlayback] = useState(false);
  const [index, setIndex] = useState(100);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [country, setCountry] = useState("ALL");

  const countries = useMemo(() => ["ALL", ...Array.from(new Set(points.map((point) => point.country))).sort()], [points]);

  const filteredPoints = useMemo(
    () =>
      points.filter((point) => {
        const countryMatch = country === "ALL" ? true : point.country === country;
        const eventMatch = eventFilter === "all" ? true : eventFilter === "clean" ? point.risk === 0 : point.risk > 0;
        return countryMatch && eventMatch;
      }),
    [points, country, eventFilter]
  );

  const playablePoints = useMemo(() => {
    const total = filteredPoints.length;
    if (total === 0) return [];
    const limit = Math.max(1, Math.round((index / 100) * total));
    return filteredPoints.slice(0, limit);
  }, [filteredPoints, index]);



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

      <div className="mt-3 grid gap-2 md:grid-cols-2">
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
      </div>

      <div className="mt-3">
        <WorldMapPlaceholder
          title="Global verification map"
          subtitle="Fuente: eventos live/simulados consolidados por tenant + vertical + estado."
          points={playablePoints}
        />
      </div>

      <div className="mt-3">
        <input type="range" min={10} max={100} step={10} value={index} onChange={(event) => setIndex(Number(event.target.value))} className="w-full" />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {STYLE_URL
          ? `Map style configured: ${STYLE_URL}.`
          : "Enterprise style URL missing: set NEXT_PUBLIC_MAPLIBRE_STYLE_URL to use your hosted style in production."}
      </p>
    </div>
  );
}
