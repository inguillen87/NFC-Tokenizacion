"use client";

import { useMemo, useState } from "react";
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

type MetricMode = "scans" | "risk";
type TimeWindowMode = "5m" | "1h" | "24h" | "all";

const continentLabels = [
  { name: "NORTH AMERICA", x: 18, y: 26 },
  { name: "SOUTH AMERICA", x: 28, y: 64 },
  { name: "EUROPE", x: 51, y: 25 },
  { name: "AFRICA", x: 52, y: 58 },
  { name: "ASIA", x: 73, y: 34 },
  { name: "OCEANIA", x: 84, y: 71 },
];

function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

export function WorldMapPlaceholder({
  title = "Global scan footprint",
  subtitle = "Mapa operativo de autenticaciones, riesgo y cobertura multi-tenant.",
  points = [],
  onPointSelect,
  metadataRows,
  routes = [],
}: {
  title?: string;
  subtitle?: string;
  points?: GeoPoint[];
  onPointSelect?: (point: GeoPoint) => void;
  metadataRows?: (point: GeoPoint) => Array<{ label: string; value: string }>;
  routes?: Array<{ fromLat: number; fromLng: number; toLat: number; toLng: number; label?: string; tone?: "info" | "warn" }>;
}) {
  const safePoints = points;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [metricMode, setMetricMode] = useState<MetricMode>("scans");
  const [timeWindowMode, setTimeWindowMode] = useState<TimeWindowMode>("24h");

  const parseEventTime = (value?: string) => {
    if (!value) return Date.now();
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    return Date.now();
  };

  const normalizeStatus = (value?: string) => {
    const raw = (value || "").toUpperCase();
    if (raw.includes("VALID") || raw.includes("AUTH_OK") || raw.includes("OK")) return "AUTH_OK";
    if (raw.includes("TAMPER") || raw.includes("OPENED")) return "TAMPER_RISK";
    if (raw.includes("DUPLICATE") || raw.includes("REPLAY")) return "DUPLICATE_RISK";
    return "REVIEW";
  };

  const cutoffMs =
    timeWindowMode === "5m"
      ? Date.now() - 5 * 60 * 1000
      : timeWindowMode === "1h"
      ? Date.now() - 60 * 60 * 1000
      : timeWindowMode === "24h"
      ? Date.now() - 24 * 60 * 60 * 1000
      : 0;

  const windowedPoints = useMemo(
    () =>
      safePoints.filter((point) => {
        if (timeWindowMode === "all") return true;
        return parseEventTime(point.lastSeen) >= cutoffMs;
      }),
    [safePoints, timeWindowMode, cutoffMs]
  );
  const totalScans = windowedPoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const riskSignals = windowedPoints.reduce((acc, point) => acc + (point.risk || 0), 0);

  const projectedPoints = useMemo(
    () => windowedPoints.map((point, idx) => ({ id: `${point.city}-${point.lat}-${point.lng}-${idx}`, point, pos: project(point.lat, point.lng) })),
    [windowedPoints]
  );
  const projectedRoutes = useMemo(
    () =>
      routes.map((route, idx) => ({
        id: `${route.fromLat}-${route.fromLng}-${route.toLat}-${route.toLng}-${idx}`,
        from: project(route.fromLat, route.fromLng),
        to: project(route.toLat, route.toLng),
        label: route.label,
        tone: route.tone || "info",
      })),
    [routes]
  );

  const activePoint = projectedPoints.find((item) => item.id === activeId) || projectedPoints[0];
  const rankedPoints = useMemo(() => [...windowedPoints].sort((a, b) => (b.scans || 0) - (a.scans || 0)).slice(0, 4), [windowedPoints]);
  const statusCounts = useMemo(
    () =>
      windowedPoints.reduce(
        (acc, point) => {
          const key = normalizeStatus(point.status);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        { AUTH_OK: 0, TAMPER_RISK: 0, DUPLICATE_RISK: 0, REVIEW: 0 } as Record<string, number>
      ),
    [windowedPoints]
  );

  const heatBackground = useMemo(() => {
    const layers = projectedPoints.map((item) => {
      const scanWeight = (item.point.scans || 1) / Math.max(1, totalScans);
      const riskWeight = (item.point.risk || 0) / Math.max(1, riskSignals || 1);
      const weight = metricMode === "risk" ? riskWeight : scanWeight;
      const intensity = Math.max(16, Math.min(34, 12 + Math.round(weight * 120)));
      const color = metricMode === "risk" ? "rgba(251,113,133,0.25)" : "rgba(45,212,191,0.22)";
      return `radial-gradient(circle at ${item.pos.x}% ${item.pos.y}%, ${color} 0%, rgba(15,23,42,0) ${intensity}%)`;
    });
    return layers.join(",");
  }, [metricMode, projectedPoints, totalScans, riskSignals]);

  return (
    <Card className="worldmap-card relative overflow-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">{windowedPoints.length} hubs</div>
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">{totalScans.toLocaleString()} scans</div>
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-rose-100">{riskSignals.toLocaleString()} risk</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <button type="button" onClick={() => setMetricMode("scans")} className={`rounded-lg border px-3 py-1 ${metricMode === "scans" ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
          Heat: scans
        </button>
        <button type="button" onClick={() => setMetricMode("risk")} className={`rounded-lg border px-3 py-1 ${metricMode === "risk" ? "border-rose-300/40 bg-rose-500/15 text-rose-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
          Heat: risk
        </button>
        {(["5m", "1h", "24h", "all"] as TimeWindowMode[]).map((windowMode) => (
          <button key={windowMode} type="button" onClick={() => setTimeWindowMode(windowMode)} className={`rounded-lg border px-3 py-1 ${timeWindowMode === windowMode ? "border-indigo-300/40 bg-indigo-500/15 text-indigo-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
            {windowMode === "all" ? "Window: all" : `Window: ${windowMode}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setMetricMode("scans");
            setTimeWindowMode("24h");
          }}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-slate-300"
        >
          Reset filters
        </button>
      </div>

      <div className="worldmap-shell mt-4 grid h-[21rem] place-items-center rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.16),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.16),transparent_40%),#020617] md:h-[25rem]">
        <div className="worldmap-canvas relative h-[18rem] w-full max-w-5xl overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/95 shadow-[inset_0_0_80px_rgba(2,6,23,0.85)] md:h-[21rem]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute inset-0" style={{ backgroundImage: heatBackground }} />

          {continentLabels.map((label) => (
            <div key={label.name} className="pointer-events-none absolute -translate-x-1/2 text-[9px] font-semibold tracking-[0.12em] text-cyan-100/55 md:text-[10px]" style={{ left: `${label.x}%`, top: `${label.y}%` }}>
              {label.name}
            </div>
          ))}

          <svg viewBox="0 0 1000 420" className="absolute inset-0 h-full w-full opacity-60" aria-hidden>
            <g fill="rgba(56,189,248,0.15)" stroke="rgba(125,211,252,0.4)" strokeWidth="1.2">
              <path d="M102 136l34-24 58 8 28 30 38 9 22 44-20 41-66 24-36-20-26-35-32-8-32-37z" />
              <path d="M278 267l45 9 18 24 30 16 14 45-25 44-44 11-31-22-8-45 8-40z" />
              <path d="M406 120l63-22 108 10 86 19 68-8 58 29-7 33-65 15-31 33-83-1-52 26-47 11-88-24-38-31z" />
              <path d="M549 262l59-15 45 14 46 29-18 48-66 16-48-23-29-44z" />
              <path d="M734 254l69-8 64 12 42 27 2 38-50 22-70-9-57-27z" />
              <path d="M848 117l40-20 56 8 30 20-12 25-45 13-38-7-23-20z" />
            </g>
          </svg>
          {projectedRoutes.length ? (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-75" aria-hidden>
              {projectedRoutes.map((route) => (
                <line
                  key={route.id}
                  x1={route.from.x}
                  y1={route.from.y}
                  x2={route.to.x}
                  y2={route.to.y}
                  stroke={route.tone === "warn" ? "rgba(251,113,133,0.9)" : "rgba(103,232,249,0.85)"}
                  strokeWidth="0.35"
                  strokeDasharray="1.3 1.3"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="-6" dur="0.7s" repeatCount="indefinite" />
                </line>
              ))}
            </svg>
          ) : null}

          {projectedPoints.map((item) => {
            const isActive = activePoint?.id === item.id;
            const size = Math.max(10, Math.min(24, 10 + Math.round((item.point.scans || 0) / 1400)));
            const tone = (item.point.risk || 0) > 0 ? "bg-rose-300 shadow-[0_0_22px_rgba(251,113,133,0.95)]" : "bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.95)]";
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.point.city} ${item.point.country || ""}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${item.pos.x}%`, top: `${item.pos.y}%` }}
                onMouseEnter={() => setActiveId(item.id)}
                onFocus={() => setActiveId(item.id)}
                onClick={() => {
                  setActiveId(item.id);
                  onPointSelect?.(item.point);
                }}
              >
                <span className={`absolute inline-flex h-7 w-7 rounded-full ${isActive ? "animate-ping" : ""} bg-cyan-300/40`} />
                <span className={`relative inline-block rounded-full ${tone}`} style={{ width: size, height: size }} />
              </button>
            );
          })}

          {activePoint ? (
            <div
              className="pointer-events-none absolute z-20 hidden w-[12rem] -translate-x-1/2 rounded-lg border border-cyan-300/30 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-100 shadow-[0_10px_30px_rgba(2,6,23,.6)] md:block"
              style={{ left: `${Math.min(90, Math.max(10, activePoint.pos.x))}%`, top: `calc(${Math.min(90, Math.max(12, activePoint.pos.y))}% - 3.2rem)` }}
            >
              <p className="font-semibold text-white">{activePoint.point.city}{activePoint.point.country ? ` · ${activePoint.point.country}` : ""}</p>
              <p className="text-cyan-200">Scans: {(activePoint.point.scans || 0).toLocaleString()}</p>
              <p className="text-rose-200">Risk: {(activePoint.point.risk || 0).toLocaleString()}</p>
              {activePoint.point.vertical ? <p className="text-slate-300">Vertical: {activePoint.point.vertical}</p> : null}
              <p className="text-slate-300">Status: {normalizeStatus(activePoint.point.status)}</p>
              {activePoint.point.source ? <p className="text-slate-400">Source: {activePoint.point.source}</p> : null}
              {activePoint.point.lastSeen ? <p className="text-slate-400">Last seen: {activePoint.point.lastSeen}</p> : null}
              {(metadataRows?.(activePoint.point) || []).map((row) => (
                <p key={row.label} className="text-slate-400">{row.label}: {row.value}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {windowedPoints.length === 0 ? (
        <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          No hay eventos para la ventana seleccionada. Probá cambiar a 24h o all.
        </div>
      ) : null}

      {activePoint ? (
        <div className="mt-3 rounded-lg border border-cyan-300/25 bg-slate-900/85 px-3 py-2 text-[11px] text-slate-100 md:hidden">
          <p className="font-semibold text-white">{activePoint.point.city}{activePoint.point.country ? ` · ${activePoint.point.country}` : ""}</p>
          <p className="text-cyan-200">Scans: {(activePoint.point.scans || 0).toLocaleString()} · Risk: {(activePoint.point.risk || 0).toLocaleString()}</p>
          <p className="text-slate-300">{activePoint.point.vertical ? `Vertical: ${activePoint.point.vertical} · ` : ""}Status: {normalizeStatus(activePoint.point.status)}</p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
        {rankedPoints.map((point) => (
          <div key={`${point.city}-${point.country || "--"}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
            <p className="font-semibold text-white">{point.city} {point.country ? `· ${point.country}` : ""}</p>
            <p className="text-cyan-200">{(point.scans || 0).toLocaleString()} scans · {(point.risk || 0).toLocaleString()} risk</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-3">
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">AUTH_OK · tráfico normal</div>
        <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-200">DUPLICATE_RISK · repetición anómala</div>
        <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-rose-200">TAMPER_RISK · estado abierto/sospechoso</div>
      </div>

      <div className="mt-2 grid gap-2 text-[11px] md:grid-cols-4">
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/5 px-2 py-1 text-emerald-200">AUTH_OK: {statusCounts.AUTH_OK}</div>
        <div className="rounded-lg border border-rose-300/20 bg-rose-500/5 px-2 py-1 text-rose-200">TAMPER_RISK: {statusCounts.TAMPER_RISK}</div>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 px-2 py-1 text-cyan-200">DUPLICATE_RISK: {statusCounts.DUPLICATE_RISK}</div>
        <div className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-slate-300">REVIEW: {statusCounts.REVIEW}</div>
      </div>
    </Card>
  );
}
