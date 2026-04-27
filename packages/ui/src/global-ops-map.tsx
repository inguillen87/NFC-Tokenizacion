"use client";

import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import { HexagonLayer, HeatmapLayer } from "@deck.gl/aggregation-layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { Map } from "react-map-gl/maplibre";
import { Card } from "./card";

export type GlobalOpsPoint = {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  scans: number;
  risk: number;
  verdict: string;
  tenantSlug: string;
  lastSeen: string;
  uid?: string;
  device?: string;
};

export type GlobalOpsRoute = {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  uid: string;
  risk: number;
  taps: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

type Mode = "tenant" | "global" | "demo";
type TimeWindow = "1h" | "24h" | "7d" | "all";

function toMs(value?: string) {
  if (!value) return 0;
  const n = Date.parse(value);
  return Number.isNaN(n) ? 0 : n;
}

function project(lat: number, lng: number, width = 1200, height = 620) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, lift = 46) {
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - lift;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

function hasWebGlSupport() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function GlobalOpsMap({
  points,
  routes,
  mode,
  selectedPointId,
  onPointSelect,
  playbackEnabled,
  riskOnly,
}: {
  points: GlobalOpsPoint[];
  routes: GlobalOpsRoute[];
  mode: Mode;
  selectedPointId?: string;
  onPointSelect?: (point: GlobalOpsPoint) => void;
  playbackEnabled?: boolean;
  riskOnly?: boolean;
}) {
  const [tenant, setTenant] = useState("ALL");
  const [country, setCountry] = useState("ALL");
  const [windowMode, setWindowMode] = useState<TimeWindow>("24h");
  const [verdict, setVerdict] = useState("ALL");
  const [localRiskOnly, setLocalRiskOnly] = useState(Boolean(riskOnly));
  const [playback, setPlayback] = useState(Boolean(playbackEnabled));
  const [progress, setProgress] = useState(100);
  const [internalSelectedId, setInternalSelectedId] = useState(selectedPointId || "");
  const [webglReady, setWebglReady] = useState(false);
  const [mapRuntimeReady, setMapRuntimeReady] = useState(true);

  useEffect(() => setWebglReady(hasWebGlSupport()), []);
  useEffect(() => setInternalSelectedId(selectedPointId || ""), [selectedPointId]);
  useEffect(() => setLocalRiskOnly(Boolean(riskOnly)), [riskOnly]);

  useEffect(() => {
    if (!playback) return;
    const id = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 20 : prev + 10));
    }, 900);
    return () => clearInterval(id);
  }, [playback]);

  const now = Date.now();
  const cutoff = windowMode === "1h" ? now - 3600_000 : windowMode === "24h" ? now - 24 * 3600_000 : windowMode === "7d" ? now - 7 * 24 * 3600_000 : 0;

  const tenants = useMemo(() => ["ALL", ...Array.from(new Set(points.map((p) => p.tenantSlug))).filter(Boolean).sort()], [points]);
  const countries = useMemo(() => ["ALL", ...Array.from(new Set(points.map((p) => p.country))).filter(Boolean).sort()], [points]);
  const verdicts = useMemo(() => ["ALL", ...Array.from(new Set(points.map((p) => p.verdict))).filter(Boolean).sort()], [points]);

  const basePoints = useMemo(() => points.filter((point) => {
    const ts = toMs(point.lastSeen);
    const tenantMatch = tenant === "ALL" ? true : point.tenantSlug === tenant;
    const countryMatch = country === "ALL" ? true : point.country === country;
    const verdictMatch = verdict === "ALL" ? true : point.verdict === verdict;
    const timeMatch = cutoff === 0 ? true : ts >= cutoff;
    const riskMatch = localRiskOnly ? point.risk > 0 : true;
    return tenantMatch && countryMatch && verdictMatch && timeMatch && riskMatch;
  }), [country, cutoff, localRiskOnly, points, tenant, verdict]);

  const clusteredPoints = useMemo(() => {
    if (basePoints.length <= 80) return basePoints;
    const bins = new Map<string, GlobalOpsPoint>();
    for (const point of basePoints) {
      const key = `${Math.round(point.lat * 2) / 2}:${Math.round(point.lng * 2) / 2}`;
      const current = bins.get(key);
      if (!current) {
        bins.set(key, { ...point, id: `cluster-${key}`, city: `${point.city} cluster`, scans: point.scans, risk: point.risk });
      } else {
        current.scans += point.scans;
        current.risk += point.risk;
      }
    }
    return Array.from(bins.values());
  }, [basePoints]);

  const visiblePoints = useMemo(() => {
    const limit = Math.max(1, Math.floor((progress / 100) * clusteredPoints.length));
    return clusteredPoints.slice(0, limit);
  }, [clusteredPoints, progress]);

  const visibleRoutes = useMemo(() => {
    const filtered = routes
      .filter((route) => {
        if (localRiskOnly && route.risk <= 0) return false;
        const routeTime = toMs(route.lastSeenAt);
        if (cutoff && routeTime < cutoff) return false;
        return true;
      })
      .sort((a, b) => toMs(a.lastSeenAt) - toMs(b.lastSeenAt));
    const max = mode === "global" ? 140 : 80;
    const sliced = filtered.slice(-max);
    const limit = Math.max(1, Math.floor((progress / 100) * sliced.length));
    return sliced.slice(0, limit);
  }, [cutoff, localRiskOnly, mode, progress, routes]);

  const selectedPoint = visiblePoints.find((point) => point.id === internalSelectedId) || visiblePoints[0] || null;
  const kpiCountries = new Set(visiblePoints.map((point) => point.country)).size;
  const replayTamper = visiblePoints.filter((point) => ["REPLAY_SUSPECT", "DUPLICATE", "TAMPER", "TAMPERED"].includes(point.verdict)).length;

  const fallbackRows = visiblePoints.slice(0, 12);
  const canRenderMap = webglReady && mapRuntimeReady;

  const mapLayers = useMemo(() => {
    if (!canRenderMap) return [];

    const pointLayer = new ScatterplotLayer<GlobalOpsPoint>({
      id: "ops-points",
      data: visiblePoints,
      pickable: true,
      opacity: 0.92,
      filled: true,
      radiusUnits: "pixels",
      radiusMinPixels: 3,
      radiusMaxPixels: 18,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => Math.min(14, 5 + d.scans / 40),
      getFillColor: (d) => d.risk > 0 ? [251, 113, 133, 230] : [56, 189, 248, 220],
      getLineColor: (d) => d.id === selectedPoint?.id ? [255, 255, 255, 230] : [2, 6, 23, 100],
      lineWidthMinPixels: 1.5,
      onClick: (info) => {
        if (!info.object) return;
        setInternalSelectedId(info.object.id);
        onPointSelect?.(info.object);
      },
    });

    const arcLayer = new ArcLayer<GlobalOpsRoute>({
      id: "ops-routes",
      data: visibleRoutes,
      pickable: false,
      getSourcePosition: (d) => [d.fromLng, d.fromLat],
      getTargetPosition: (d) => [d.toLng, d.toLat],
      getSourceColor: (d) => d.risk > 0 ? [251, 113, 133, 170] : [34, 211, 238, 150],
      getTargetColor: (d) => d.risk > 0 ? [251, 113, 133, 240] : [34, 211, 238, 220],
      getWidth: (d) => d.risk > 0 ? 2.8 : 1.7,
      greatCircle: true,
    });

    const hexLayer = new HexagonLayer<GlobalOpsPoint>({
      id: "ops-hex",
      data: visiblePoints,
      getPosition: (d) => [d.lng, d.lat],
      radius: mode === "global" ? 95_000 : 62_000,
      elevationScale: 10,
      extruded: false,
      pickable: false,
      colorRange: [
        [6, 78, 59, 60],
        [8, 145, 178, 85],
        [37, 99, 235, 110],
        [217, 70, 239, 130],
      ],
      getColorWeight: (d) => d.risk > 0 ? d.risk * 2 + d.scans : d.scans,
    });

    const heatLayer = new HeatmapLayer<GlobalOpsPoint>({
      id: "ops-heat",
      data: visiblePoints,
      getPosition: (d) => [d.lng, d.lat],
      getWeight: (d) => (d.risk > 0 ? 2 : 1) * Math.max(1, d.scans / 3),
      radiusPixels: mode === "global" ? 44 : 34,
      intensity: 0.7,
      threshold: 0.06,
      visible: mode !== "tenant",
    });

    const tripData = visibleRoutes.map((route, idx) => {
      const start = Math.max(0, idx * 14);
      return {
        ...route,
        path: [[route.fromLng, route.fromLat], [route.toLng, route.toLat]],
        timestamps: [start, start + 100],
      };
    });

    const tripsLayer = new TripsLayer({
      id: "ops-trips",
      data: tripData,
      getPath: (d: { path: [number, number][] }) => d.path,
      getTimestamps: (d: { timestamps: number[] }) => d.timestamps,
      getColor: (d: { risk: number }) => d.risk > 0 ? [251, 113, 133, 210] : [34, 211, 238, 180],
      opacity: 0.65,
      widthMinPixels: 2,
      trailLength: 42,
      currentTime: Math.min(100, progress),
      rounded: true,
      visible: playback,
    });

    return [hexLayer, heatLayer, arcLayer, tripsLayer, pointLayer];
  }, [canRenderMap, mode, onPointSelect, playback, progress, selectedPoint?.id, visiblePoints, visibleRoutes]);

  return (
    <Card className="overflow-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Global Ops Map {canRenderMap ? "DeckGL/MapLibre" : "Fallback"}</p>
          <p className="text-xs text-slate-400">Control plane operativo para hubs, journeys y riesgo ({mode}).</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">Hubs: <b>{visiblePoints.length}</b></div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">Countries: <b>{kpiCountries}</b></div>
          <div className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-2 py-1 text-rose-100">Risk nodes: <b>{visiblePoints.filter((p) => p.risk > 0).length}</b></div>
          <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-amber-100">Replay/tamper: <b>{replayTamper}</b></div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-6">
        <select className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white" value={tenant} onChange={(event) => setTenant(event.target.value)}>
          {tenants.map((item) => <option key={item} value={item}>{item === "ALL" ? "Tenant: all" : item}</option>)}
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white" value={country} onChange={(event) => setCountry(event.target.value)}>
          {countries.map((item) => <option key={item} value={item}>{item === "ALL" ? "Country: all" : item}</option>)}
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white" value={windowMode} onChange={(event) => setWindowMode(event.target.value as TimeWindow)}>
          <option value="1h">1h</option>
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="all">all</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white" value={verdict} onChange={(event) => setVerdict(event.target.value)}>
          {verdicts.map((item) => <option key={item} value={item}>{item === "ALL" ? "Verdict: all" : item}</option>)}
        </select>
        <button type="button" onClick={() => setLocalRiskOnly((v) => !v)} className={`rounded-lg border px-2 py-1 text-xs ${localRiskOnly ? "border-rose-300/30 bg-rose-500/10 text-rose-100" : "border-white/10 bg-white/5 text-slate-200"}`}>{localRiskOnly ? "Risk-only: on" : "Risk-only: off"}</button>
        <button type="button" onClick={() => setPlayback((value) => !value)} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">{playback ? "Pause playback" : "Play playback"}</button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.25),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(167,139,250,.2),transparent_40%),linear-gradient(160deg,#020617,#0f172a,#111827)]">
          <div className="relative h-[29rem]">
            {canRenderMap ? (
              <DeckGL
                initialViewState={{ latitude: 18, longitude: -8, zoom: 1.25, pitch: 24, bearing: 0 }}
                controller
                layers={mapLayers}
                getCursor={({ isDragging }) => isDragging ? "grabbing" : "crosshair"}
              >
                <Map
                  reuseMaps
                  mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                  onError={() => setMapRuntimeReady(false)}
                />
              </DeckGL>
            ) : (
              <svg viewBox="0 0 1200 620" className="absolute inset-0 h-full w-full">
                <rect x="0" y="0" width="1200" height="620" fill="rgba(15,23,42,.45)" />
                <ellipse cx="600" cy="310" rx="410" ry="240" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="1.5" />
                <ellipse cx="600" cy="310" rx="320" ry="190" fill="none" stroke="rgba(34,211,238,.18)" strokeWidth="1.2" />
                {visibleRoutes.map((route) => {
                  const a = project(route.fromLat, route.fromLng);
                  const b = project(route.toLat, route.toLng);
                  const riskStroke = route.risk > 0 ? "rgba(251,113,133,.85)" : "rgba(34,211,238,.65)";
                  return (
                    <path key={route.id} d={curve(a, b, route.risk > 0 ? 56 : 42)} stroke={riskStroke} strokeWidth={route.risk > 0 ? 2.8 : 2} fill="none" strokeDasharray="4 5" opacity="0.95" />
                  );
                })}
                {visiblePoints.map((point) => {
                  const dot = project(point.lat, point.lng);
                  const isSelected = selectedPoint?.id === point.id;
                  return (
                    <g key={point.id}>
                      <circle cx={dot.x} cy={dot.y} r={isSelected ? 10 : Math.min(8, 4 + point.scans / 40)} fill={point.risk > 0 ? "rgba(251,113,133,.95)" : "rgba(56,189,248,.9)"} />
                    </g>
                  );
                })}
              </svg>
            )}
            {!canRenderMap ? (
              <div className="absolute left-3 top-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-100">
                WebGL or map runtime unavailable. Showing operational fallback view.
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300">
              Scatter/arc/trips {canRenderMap ? "rendering" : "simulation"} with clustered hubs and capped routes for performance ({visibleRoutes.length} routes rendered).
            </div>
          </div>
        </div>

        <aside className="h-[29rem] overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Node drawer</p>
          {selectedPoint ? (
            <div className="mt-2 space-y-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 p-3">
              <p className="font-semibold text-cyan-100">{selectedPoint.city}, {selectedPoint.country}</p>
              <p>UID: <b>{selectedPoint.uid || "n/a"}</b></p>
              <p>Tenant: <b>{selectedPoint.tenantSlug || "n/a"}</b></p>
              <p>Último evento: <b>{selectedPoint.lastSeen || "n/a"}</b></p>
              <p>Device: <b>{selectedPoint.device || "n/a"}</b></p>
              <p>Risk: <b>{selectedPoint.risk}</b> · Verdict: <b>{selectedPoint.verdict}</b></p>
            </div>
          ) : <p className="mt-2 text-slate-400">Seleccioná un punto para ver detalle.</p>}

          <div className="mt-3 space-y-2">
            {fallbackRows.map((point) => (
              <button key={point.id} type="button" onClick={() => {
                setInternalSelectedId(point.id);
                onPointSelect?.(point);
              }} className={`w-full rounded-lg border px-2 py-2 text-left ${selectedPoint?.id === point.id ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/10 bg-slate-900/70"}`}>
                <p className="font-semibold">{point.city}, {point.country}</p>
                <p className="text-[11px] text-slate-400">scans {point.scans} · risk {point.risk} · {point.tenantSlug || "--"}</p>
              </button>
            ))}
            {!fallbackRows.length ? <p className="text-slate-400">No data for selected filters.</p> : null}
          </div>
        </aside>
      </div>

      <div className="mt-3">
        <input type="range" min={10} max={100} step={10} value={progress} onChange={(event) => setProgress(Number(event.target.value))} className="w-full" />
      </div>
    </Card>
  );
}
