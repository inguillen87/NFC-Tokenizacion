"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "./card";
import { PremiumVectorMap, type VectorMapPoint, type VectorMapRoute } from "./premium-vector-map";

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
type MapRoute = { fromLat: number; fromLng: number; toLat: number; toLng: number; label?: string; tone?: "info" | "warn" };

function parseEventTime(value?: string) {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function WorldMapRealtime({
  title = "Global scan footprint",
  subtitle = "Mapa operativo real de autenticaciones, riesgo y cobertura multi-tenant.",
  points = [],
  routes = [],
  onPointSelect,
  metadataRows,
  initialExpanded = false,
}: {
  title?: string;
  subtitle?: string;
  points?: GeoPoint[];
  onPointSelect?: (point: GeoPoint) => void;
  metadataRows?: (point: GeoPoint) => Array<{ label: string; value: string }>;
  routes?: MapRoute[];
  initialExpanded?: boolean;
}) {
  const [timeWindowMode, setTimeWindowMode] = useState<TimeWindowMode>("24h");
  const [expanded, setExpanded] = useState(initialExpanded);
  const [mapMode, setMapMode] = useState<MapMode>("network");
  const [riskOnly, setRiskOnly] = useState(false);
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

  const rankedPoints = useMemo(() => {
    const filtered = riskOnly ? windowedPoints.filter((point) => (point.risk || 0) > 0) : windowedPoints;
    return [...filtered].sort((a, b) => (b.scans || 0) - (a.scans || 0));
  }, [windowedPoints, riskOnly]);

  useEffect(() => {
    if (!rankedPoints.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > rankedPoints.length - 1) setActiveIndex(0);
  }, [rankedPoints, activeIndex]);

  const activePoint = rankedPoints[activeIndex] || null;
  const totalScans = rankedPoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const riskSignals = rankedPoints.reduce((acc, point) => acc + (point.risk || 0), 0);
  const visibleRoutes = useMemo<MapRoute[]>(() => {
    if (routes.length) return routes.slice(0, 16);
    const fromRanking = rankedPoints.slice(0, 8).flatMap((point, index, arr) => {
      if (index === arr.length - 1) return [];
      return [{
        fromLat: point.lat,
        fromLng: point.lng,
        toLat: arr[index + 1].lat,
        toLng: arr[index + 1].lng,
        tone: (point.risk || arr[index + 1].risk) ? "warn" as const : "info" as const,
      }];
    });
    return fromRanking;
  }, [rankedPoints, routes]);
  const vectorPoints = useMemo<VectorMapPoint[]>(() => rankedPoints.slice(0, 30).map((point, index) => ({
    id: `${point.city}-${point.country || "xx"}-${point.lat.toFixed(4)}-${point.lng.toFixed(4)}-${index}`,
    label: point.city,
    sublabel: point.country,
    lat: point.lat,
    lng: point.lng,
    scans: point.scans || 1,
    risk: point.risk || 0,
    tone: (point.risk || 0) > 0 ? "risk" : point.status === "opened" ? "token" : index === activeIndex ? "tap" : "hub",
  })), [activeIndex, rankedPoints]);
  const vectorRoutes = useMemo<VectorMapRoute[]>(() => visibleRoutes.map((route, index) => ({
    id: `world-route-${index}-${route.fromLat}-${route.toLng}`,
    fromLat: route.fromLat,
    fromLng: route.fromLng,
    toLat: route.toLat,
    toLng: route.toLng,
    label: route.label,
    tone: route.tone === "warn" ? "warn" : "info",
  })), [visibleRoutes]);
  const selectedVectorPointId = vectorPoints[activeIndex]?.id || vectorPoints[0]?.id;
  const emptyStateText = riskOnly
    ? "No hay hubs con señales de riesgo para la ventana seleccionada. Desactivá Risk-only o ampliá la ventana temporal."
    : "No hay hubs geolocalizados para la ventana seleccionada. Generá taps reales o ampliá la ventana temporal.";

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
          <button suppressHydrationWarning key={windowMode} type="button" onClick={() => setTimeWindowMode(windowMode)} className={`rounded-lg border px-3 py-1 ${timeWindowMode === windowMode ? "border-indigo-300/40 bg-indigo-500/15 text-indigo-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
            {windowMode === "all" ? "Window: all" : `Window: ${windowMode}`}
          </button>
        ))}
        <button suppressHydrationWarning type="button" onClick={() => setExpanded((current) => !current)} className="rounded-lg border border-indigo-300/30 bg-indigo-500/10 px-3 py-1 text-indigo-100">
          {expanded ? "Compact view" : "Expand map"}
        </button>
        <button suppressHydrationWarning type="button" onClick={() => setMapMode((prev) => (prev === "classic" ? "network" : "classic"))} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100">
          {mapMode === "classic" ? "Vista: calor" : "Vista: rutas"}
        </button>
        <button suppressHydrationWarning type="button" onClick={() => setRiskOnly((prev) => !prev)} className={`rounded-lg border px-3 py-1 ${riskOnly ? "border-rose-300/35 bg-rose-500/15 text-rose-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
          {riskOnly ? "Risk-only: on" : "Risk-only: off"}
        </button>
      </div>

      {activePoint ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <PremiumVectorMap
            title={mapMode === "classic" ? "Heatmap operativo" : "Atlas de trazabilidad"}
            subtitle="Motor vectorial propio: rutas, riesgo y hubs sin iframe ni API paga."
            caption="Capa visual para autenticaciones, tamper, duplicados y hubs comerciales en vivo."
            points={vectorPoints}
            routes={vectorRoutes}
            selectedPointId={selectedVectorPointId}
            density={mapMode === "classic" ? "heat" : "route"}
            heightClassName={expanded ? "h-[34rem]" : "h-[24rem]"}
            onPointSelect={(point) => {
              const nextIndex = vectorPoints.findIndex((item) => item.id === point.id);
              if (nextIndex >= 0) {
                setActiveIndex(nextIndex);
                onPointSelect?.(rankedPoints[nextIndex]);
              }
            }}
          />
          <div className={`${expanded ? "h-[34rem]" : "h-[24rem]"} space-y-2 overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-2`}>
            {rankedPoints.slice(0, 30).map((point, index) => (
              <button suppressHydrationWarning
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
          {emptyStateText}
        </div>
      )}
    </Card>
  );
}
