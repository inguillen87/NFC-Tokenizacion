"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "./card";

type GeoPoint = {
  city: string;
  country?: string;
  scans?: number;
  risk?: number;
  lat: number;
  lng: number;
  vertical?: string;
  status?: string;
  source?: string;
  lastSeen?: string;
};

type TimeWindowMode = "5m" | "1h" | "24h" | "all";

function parseEventTime(value?: string) {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function buildMapUrl(points: GeoPoint[], active: GeoPoint | null) {
  if (!active) return "";
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats) - 0.25;
  const maxLat = Math.max(...lats) + 0.25;
  const minLng = Math.min(...lngs) - 0.35;
  const maxLng = Math.max(...lngs) + 0.35;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${active.lat}%2C${active.lng}`;
}

export function WorldMapRealtime({
  title = "Global scan footprint",
  subtitle = "Mapa operativo real de autenticaciones, riesgo y cobertura multi-tenant.",
  points = [],
  onPointSelect,
  metadataRows,
  initialExpanded = false,
}: {
  title?: string;
  subtitle?: string;
  points?: GeoPoint[];
  onPointSelect?: (point: GeoPoint) => void;
  metadataRows?: (point: GeoPoint) => Array<{ label: string; value: string }>;
  routes?: Array<{ fromLat: number; fromLng: number; toLat: number; toLng: number; label?: string; tone?: "info" | "warn" }>;
  initialExpanded?: boolean;
}) {
  const [timeWindowMode, setTimeWindowMode] = useState<TimeWindowMode>("24h");
  const [expanded, setExpanded] = useState(initialExpanded);
  const [activeIndex, setActiveIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const cutoffMs =
    timeWindowMode === "5m"
      ? now - 5 * 60 * 1000
      : timeWindowMode === "1h"
      ? now - 60 * 60 * 1000
      : timeWindowMode === "24h"
      ? now - 24 * 60 * 60 * 1000
      : 0;

  const windowedPoints = useMemo(
    () => points.filter((point) => (timeWindowMode === "all" ? true : parseEventTime(point.lastSeen) >= cutoffMs)),
    [points, timeWindowMode, cutoffMs]
  );

  const rankedPoints = useMemo(
    () => [...windowedPoints].sort((a, b) => (b.scans || 0) - (a.scans || 0)),
    [windowedPoints]
  );

  useEffect(() => {
    if (!rankedPoints.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > rankedPoints.length - 1) setActiveIndex(0);
  }, [rankedPoints, activeIndex]);

  const activePoint = rankedPoints[activeIndex] || null;
  const mapUrl = useMemo(() => buildMapUrl(rankedPoints, activePoint), [rankedPoints, activePoint]);
  const totalScans = rankedPoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const riskSignals = rankedPoints.reduce((acc, point) => acc + (point.risk || 0), 0);

  return (
    <Card className="worldmap-card relative overflow-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">stream online</div>
          <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-slate-300">{hydrated ? new Date(now).toLocaleTimeString("es-AR") : "--:--:--"}</div>
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">{totalScans.toLocaleString()} scans</div>
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-rose-100">{riskSignals.toLocaleString()} risk</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {(["5m", "1h", "24h", "all"] as TimeWindowMode[]).map((windowMode) => (
          <button key={windowMode} type="button" onClick={() => setTimeWindowMode(windowMode)} className={`rounded-lg border px-3 py-1 ${timeWindowMode === windowMode ? "border-indigo-300/40 bg-indigo-500/15 text-indigo-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
            {windowMode === "all" ? "Window: all" : `Window: ${windowMode}`}
          </button>
        ))}
        <button type="button" onClick={() => setExpanded((current) => !current)} className="rounded-lg border border-indigo-300/30 bg-indigo-500/10 px-3 py-1 text-indigo-100">
          {expanded ? "Compact view" : "Expand map"}
        </button>
      </div>

      {activePoint ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
            <iframe title="world-map-realtime" src={mapUrl} className={`${expanded ? "h-[34rem]" : "h-[24rem]"} w-full`} loading="lazy" />
          </div>
          <div className={`${expanded ? "h-[34rem]" : "h-[24rem]"} space-y-2 overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-2`}>
            {rankedPoints.slice(0, 30).map((point, index) => (
              <button
                key={`${point.city}-${point.country || "--"}-${point.lat}-${point.lng}-${index}`}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  onPointSelect?.(point);
                }}
                className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${index === activeIndex ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}
              >
                <p className="font-semibold">{point.city}, {point.country || "--"}</p>
                <p>Scans: {point.scans || 0} · Risk: {point.risk || 0}</p>
                <p className="text-[11px] opacity-80">({point.lat.toFixed(4)}, {point.lng.toFixed(4)})</p>
                {point.lastSeen ? <p className="text-[11px] opacity-80">Last seen: {point.lastSeen}</p> : null}
                {(metadataRows?.(point) || []).map((row) => (
                  <p key={row.label} className="text-[11px] opacity-75">{row.label}: {row.value}</p>
                ))}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          No hay hubs geolocalizados para la ventana seleccionada. Generá taps reales o ampliá la ventana temporal.
        </div>
      )}
    </Card>
  );
}
