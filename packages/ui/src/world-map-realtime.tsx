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
type MapMode = "classic" | "network";

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

function projectToCanvas(lat: number, lng: number, width: number, height: number) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
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
  const [mapMode, setMapMode] = useState<MapMode>("network");
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
        <button type="button" onClick={() => setMapMode((prev) => (prev === "classic" ? "network" : "classic"))} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100">
          {mapMode === "classic" ? "Mode: classic" : "Mode: network"}
        </button>
      </div>

      {activePoint ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
            {mapMode === "classic" ? (
              <iframe title="world-map-realtime" src={mapUrl} className={`${expanded ? "h-[34rem]" : "h-[24rem]"} w-full`} loading="lazy" />
            ) : (
              <div className={`${expanded ? "h-[34rem]" : "h-[24rem]"} relative overflow-hidden bg-[radial-gradient(circle_at_20%_25%,rgba(34,211,238,.22),transparent_40%),radial-gradient(circle_at_75%_78%,rgba(167,139,250,.2),transparent_42%),linear-gradient(165deg,#020617,#0b1734_55%,#111827)]`}>
                <svg viewBox="0 0 1000 520" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(34,211,238,0.25)" />
                      <stop offset="50%" stopColor="rgba(167,139,250,0.9)" />
                      <stop offset="100%" stopColor="rgba(34,211,238,0.25)" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="1000" height="520" fill="rgba(8,13,33,0.45)" />
                  <ellipse cx="500" cy="260" rx="320" ry="190" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="1.2" />
                  <ellipse cx="500" cy="260" rx="270" ry="160" fill="none" stroke="rgba(125,211,252,0.12)" strokeWidth="1.2" />
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from="0 500 260" to="360 500 260" dur="28s" repeatCount="indefinite" />
                    {[...rankedPoints]
                      .slice(0, 6)
                      .map((point, index, arr) => {
                        if (index === arr.length - 1) return null;
                        const a = projectToCanvas(point.lat, point.lng, 1000, 520);
                        const b = projectToCanvas(arr[index + 1].lat, arr[index + 1].lng, 1000, 520);
                        const cx = (a.x + b.x) / 2;
                        const cy = Math.min(a.y, b.y) - 36;
                        return (
                          <path
                            key={`${point.city}-${index}`}
                            d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                            stroke="url(#routeGradient)"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray="5 6"
                            opacity="0.85"
                          />
                        );
                      })}
                    {rankedPoints.slice(0, 24).map((point, index) => {
                      const coord = projectToCanvas(point.lat, point.lng, 1000, 520);
                      const isActive = index === activeIndex;
                      return (
                        <g key={`${point.city}-${index}`}>
                          <circle cx={coord.x} cy={coord.y} r={isActive ? 10 : 6} fill={isActive ? "rgba(34,211,238,0.95)" : "rgba(129,140,248,0.75)"} />
                          <circle cx={coord.x} cy={coord.y} r={isActive ? 22 : 14} fill="none" stroke="rgba(125,211,252,0.3)" strokeWidth="1.6">
                            <animate attributeName="r" values={`${isActive ? "12;24;12" : "8;16;8"}`} dur={isActive ? "2.3s" : "3.6s"} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.9;0.2;0.9" dur={isActive ? "2.3s" : "3.6s"} repeatCount="indefinite" />
                          </circle>
                        </g>
                      );
                    })}
                  </g>
                </svg>
                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300">
                  Network mode: visual arcs for global scans, opened/tamper/duplicate signals and active hubs.
                </div>
              </div>
            )}
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
