"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type MapLibreRuntime = {
  Map: new (...args: any[]) => any;
};

const MAPLIBRE_JS = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

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

async function ensureCss(href: string) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-global-ops-map-css='${href}']`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.globalOpsMapCss = href;
  document.head.appendChild(link);
}

async function ensureScript(src: string) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[data-global-ops-map-js='${src}']`)) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.globalOpsMapJs = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function pointsToFeatureCollection(points: GlobalOpsPoint[]) {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: {
        id: point.id,
        city: point.city,
        country: point.country,
        scans: point.scans,
        risk: point.risk,
        verdict: point.verdict,
        tenantSlug: point.tenantSlug,
        lastSeen: point.lastSeen,
      },
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
    })),
  };
}

function routesToFeatureCollection(routes: GlobalOpsRoute[]) {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        id: route.id,
        risk: route.risk,
        taps: route.taps,
        uid: route.uid,
      },
      geometry: {
        type: "LineString",
        coordinates: [[route.fromLng, route.fromLat], [route.toLng, route.toLat]],
      },
    })),
  };
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
  const [mapRuntimeReady, setMapRuntimeReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!webglReady || !mapContainerRef.current || mapRef.current) return;
      try {
        await ensureCss(MAPLIBRE_CSS);
        await ensureScript(MAPLIBRE_JS);
        const maplibregl = (window as any).maplibregl as MapLibreRuntime | undefined;
        if (!maplibregl?.Map || cancelled) {
          setMapRuntimeReady(false);
          return;
        }

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          center: [-8, 18],
          zoom: 1.25,
          pitch: 25,
          attributionControl: false,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          map.addSource("ops-points", { type: "geojson", data: pointsToFeatureCollection([]), cluster: true, clusterRadius: 40, clusterMaxZoom: 7 });
          map.addSource("ops-routes", { type: "geojson", data: routesToFeatureCollection([]) });

          map.addLayer({
            id: "ops-routes-risk",
            type: "line",
            source: "ops-routes",
            filter: [">", ["get", "risk"], 0],
            paint: { "line-color": "#fb7185", "line-width": 2.2, "line-opacity": 0.75 },
          });

          map.addLayer({
            id: "ops-routes-clean",
            type: "line",
            source: "ops-routes",
            filter: ["<=", ["get", "risk"], 0],
            paint: { "line-color": "#22d3ee", "line-width": 1.4, "line-opacity": 0.55 },
          });

          map.addLayer({
            id: "ops-heat",
            type: "heatmap",
            source: "ops-points",
            maxzoom: 8,
            paint: {
              "heatmap-weight": ["interpolate", ["linear"], ["get", "scans"], 0, 0, 100, 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 8, 1.4],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 1, 8, 8, 26],
              "heatmap-opacity": 0.4,
            },
          });

          map.addLayer({
            id: "ops-clusters",
            type: "circle",
            source: "ops-points",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": ["step", ["get", "point_count"], "#0ea5e9", 10, "#2563eb", 30, "#7c3aed"],
              "circle-radius": ["step", ["get", "point_count"], 11, 10, 16, 30, 22],
              "circle-opacity": 0.82,
            },
          });

          map.addLayer({
            id: "ops-points-unclustered",
            type: "circle",
            source: "ops-points",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["case", [">", ["get", "risk"], 0], "#fb7185", "#22d3ee"],
              "circle-radius": ["interpolate", ["linear"], ["get", "scans"], 1, 4, 80, 10],
              "circle-stroke-width": 1.2,
              "circle-stroke-color": "#f8fafc",
              "circle-opacity": 0.93,
            },
          });

          map.on("click", "ops-points-unclustered", (event: any) => {
            const feature = event.features?.[0];
            if (!feature) return;
            const id = String(feature.properties?.id || "");
            const selected = visiblePoints.find((item) => item.id === id);
            if (!selected) return;
            setInternalSelectedId(selected.id);
            onPointSelect?.(selected);
          });

          map.on("click", "ops-clusters", (event: any) => {
            const feature = event.features?.[0];
            const clusterId = feature?.properties?.cluster_id;
            if (clusterId === undefined) return;
            const source = map.getSource("ops-points");
            source?.getClusterExpansionZoom?.(clusterId, (error: unknown, zoom: number) => {
              if (error) return;
              map.easeTo({ center: feature.geometry.coordinates, zoom });
            });
          });

          map.on("error", () => setMapRuntimeReady(false));
          setMapRuntimeReady(true);
        });
      } catch {
        if (!cancelled) setMapRuntimeReady(false);
      }
    }

    mountMap();

    return () => {
      cancelled = true;
    };
  }, [onPointSelect, visiblePoints, webglReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapRuntimeReady) return;

    const pointsSource = map.getSource("ops-points");
    const routesSource = map.getSource("ops-routes");

    pointsSource?.setData?.(pointsToFeatureCollection(visiblePoints));

    const animatedRoutes = playback
      ? visibleRoutes.slice(0, Math.max(1, Math.floor((progress / 100) * visibleRoutes.length)))
      : visibleRoutes;
    routesSource?.setData?.(routesToFeatureCollection(animatedRoutes));
  }, [mapRuntimeReady, playback, progress, visiblePoints, visibleRoutes]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  const canRenderMap = webglReady && mapRuntimeReady;

  return (
    <Card className="overflow-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Global Ops Map {canRenderMap ? "MapLibre GL" : "Fallback"}</p>
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
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
            {!canRenderMap ? (
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
            ) : null}
            {!canRenderMap ? (
              <div className="absolute left-3 top-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-100">
                WebGL/map runtime unavailable. Showing operational fallback view.
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300">
              Scatter/arc/trips rendering with clustered hubs and capped routes for performance ({visibleRoutes.length} routes rendered).
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
