"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import type {
  MapDensity,
  VectorMapEvidenceStep,
  VectorMapLedgerItem,
  VectorMapPoint,
  VectorMapRoute,
} from "./premium-vector-map";
import { resolveTrustMapSource, type TrustMapSourceOverrides } from "./trust-map-source";

type RealGeographicMapProps = {
  points: VectorMapPoint[];
  routes?: VectorMapRoute[];
  selectedPointId?: string;
  onPointSelect?: (point: VectorMapPoint) => void;
  title?: string;
  subtitle?: string;
  caption?: string;
  className?: string;
  heightClassName?: string;
  density?: MapDensity;
  chrome?: "full" | "compact" | "minimal" | "enterprise-atlas";
  maxPoints?: number;
  maxRoutes?: number;
  evidenceSteps?: VectorMapEvidenceStep[];
  ledgerItems?: VectorMapLedgerItem[];
  mapSource?: TrustMapSourceOverrides;
  ariaLabel?: string;
};

type PointFeature = {
  type: "Feature";
  properties: {
    id: string;
    label: string;
    sublabel: string;
    evidence: string;
    lastSeen: string;
    tone: string;
    scans: number;
    risk: number;
    heatWeight: number;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
};

type RouteFeature = {
  type: "Feature";
  properties: { id: string; label: string; evidence: string; tone: string };
  geometry: { type: "LineString"; coordinates: [[number, number], [number, number]] };
};

type PointCollection = { type: "FeatureCollection"; features: PointFeature[] };
type RouteCollection = { type: "FeatureCollection"; features: RouteFeature[] };
type MapTheme = "light" | "dark";

const EMPTY_POINTS: PointCollection = { type: "FeatureCollection", features: [] };
const EMPTY_ROUTES: RouteCollection = { type: "FeatureCollection", features: [] };

function resolveDocumentMapTheme(root: HTMLElement): MapTheme {
  const explicitTheme = root.getAttribute("data-theme") || root.getAttribute("data-nexid-theme");
  if (explicitTheme === "dark") return "dark";
  if (explicitTheme === "light") return "light";
  if (root.classList.contains("theme-dark")) return "dark";
  return "light";
}

function isCoordinate(point: { lat: number; lng: number }) {
  return Number.isFinite(point.lat)
    && Number.isFinite(point.lng)
    && point.lat >= -90
    && point.lat <= 90
    && point.lng >= -180
    && point.lng <= 180;
}

function pointTone(point: VectorMapPoint) {
  if ((point.risk || 0) > 0) return "risk";
  if (point.tone) return point.tone;
  return "tap";
}

export function buildTrustMapPointGeoJson(points: VectorMapPoint[], density: MapDensity): PointCollection {
  return {
    type: "FeatureCollection",
    features: points.filter(isCoordinate).map((point) => {
      const scans = Math.max(0, Number(point.scans || 0));
      const safeScans = Math.max(1, scans);
      // Stable logarithmic volume scale: 1, 10, 100 and 1000+ remain comparable.
      // Risk is deliberately excluded from this weight and rendered in its own layer.
      const heatWeight = density === "heat"
        ? Math.min(1, Math.max(0.08, Math.log10(safeScans) / 3))
        : 0;
      return {
        type: "Feature",
        properties: {
          id: point.id,
          label: point.label,
          sublabel: point.sublabel || "",
          evidence: point.evidence || "",
          lastSeen: point.lastSeen || "",
          tone: pointTone(point),
          scans,
          risk: Math.max(0, Number(point.risk || 0)),
          heatWeight,
        },
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      } satisfies PointFeature;
    }),
  };
}

export function buildTrustMapRouteGeoJson(routes: VectorMapRoute[]): RouteCollection {
  return {
    type: "FeatureCollection",
    features: routes.filter((route) => isCoordinate({ lat: route.fromLat, lng: route.fromLng })
      && isCoordinate({ lat: route.toLat, lng: route.toLng })).map((route) => ({
      type: "Feature",
      properties: {
        id: route.id,
        label: route.label || "Relación reportada",
        evidence: route.evidence || "",
        tone: route.tone || "info",
      },
      geometry: {
        type: "LineString",
        coordinates: [[route.fromLng, route.fromLat], [route.toLng, route.toLat]],
      },
    })),
  };
}

function mapStyle(tileTemplate: string, attribution: string, light: boolean) {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [tileTemplate],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      { id: "nexid-map-background", type: "background", paint: { "background-color": light ? "#eaf7fb" : "#061322" } },
      {
        id: "nexid-map-basemap",
        type: "raster",
        source: "basemap",
        paint: light
          ? { "raster-opacity": 0.96 }
          : {
              "raster-opacity": 0.92,
              "raster-brightness-max": 0.58,
              "raster-saturation": -0.32,
              "raster-contrast": 0.16,
            },
      },
    ],
  };
}

function addEvidenceLayers(map: MapLibreMap, points: PointCollection, routes: RouteCollection, density: MapDensity, selectedPointId?: string) {
  map.addSource("nexid-evidence-points", { type: "geojson", data: points, cluster: density !== "route", clusterRadius: 34, clusterMaxZoom: 12 });
  map.addSource("nexid-evidence-heat", { type: "geojson", data: points });
  map.addSource("nexid-evidence-routes", { type: "geojson", data: routes });

  map.addLayer({
    id: "nexid-evidence-heatmap",
    type: "heatmap",
    source: "nexid-evidence-heat",
    maxzoom: 14,
    filter: ["all", ["!=", ["get", "tone"], "origin"], [">", ["get", "scans"], 0]],
    layout: { visibility: density === "heat" ? "visible" : "none" },
    paint: {
      "heatmap-weight": ["get", "heatWeight"],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.62, 8, 1.35, 13, 2],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 14, 7, 24, 12, 38],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.78, 11, 0.56, 14, 0.12],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(14,165,233,0)",
        0.18, "rgba(14,165,233,.36)",
        0.42, "rgba(15,118,110,.58)",
        0.68, "rgba(37,99,235,.72)",
        1, "rgba(109,40,217,.88)",
      ],
    },
  });

  map.addLayer({
    id: "nexid-evidence-route-shadow",
    type: "line",
    source: "nexid-evidence-routes",
    paint: { "line-color": "rgba(2,6,23,.68)", "line-width": 7, "line-opacity": 0.7 },
  });
  map.addLayer({
    id: "nexid-evidence-routes",
    type: "line",
    source: "nexid-evidence-routes",
    paint: {
      "line-color": ["match", ["get", "tone"], "warn", "#fb7185", "success", "#34d399", "#22d3ee"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.4, 9, 3.2],
      "line-opacity": 0.9,
      "line-dasharray": [2, 2],
    },
  });

  map.addLayer({
    id: "nexid-evidence-clusters",
    type: "circle",
    source: "nexid-evidence-points",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], "#0891b2", 10, "#0f766e", 50, "#2563eb", 200, "#6d28d9"],
      "circle-radius": ["step", ["get", "point_count"], 12, 10, 16, 50, 21, 200, 27],
      "circle-stroke-color": "rgba(255,255,255,.9)",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.92,
    },
  });
  map.addLayer({
    id: "nexid-evidence-point-halo",
    type: "circle",
    source: "nexid-evidence-points",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 8, 10, 18],
      "circle-color": ["match", ["get", "tone"], "origin", "rgba(52,211,153,.16)", "risk", "rgba(251,113,133,.17)", "token", "rgba(167,139,250,.17)", "rgba(34,211,238,.15)"],
      "circle-stroke-width": 1,
      "circle-stroke-color": ["match", ["get", "tone"], "origin", "#34d399", "risk", "#fb7185", "token", "#a78bfa", "#22d3ee"],
      "circle-opacity": 0.72,
    },
  });
  map.addLayer({
    id: "nexid-evidence-points-layer",
    type: "circle",
    source: "nexid-evidence-points",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4, 10, 7],
      "circle-color": ["match", ["get", "tone"], "origin", "#34d399", "risk", "#fb7185", "token", "#a78bfa", "#22d3ee"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.4,
      "circle-opacity": 0.96,
    },
  });
  map.addLayer({
    id: "nexid-evidence-selected",
    type: "circle",
    source: "nexid-evidence-points",
    filter: ["==", ["get", "id"], selectedPointId || "__none__"],
    paint: { "circle-radius": 13, "circle-color": "rgba(255,255,255,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 },
  });
}

function fitEvidence(maplibre: typeof import("maplibre-gl"), map: MapLibreMap, points: PointCollection, routes: RouteCollection, reducedMotion: boolean) {
  const coordinates: [number, number][] = [
    ...points.features.map((feature) => feature.geometry.coordinates),
    ...routes.features.flatMap((feature) => feature.geometry.coordinates),
  ];
  if (!coordinates.length) {
    map.jumpTo({ center: [-64.2, -34.6], zoom: 3.2 });
    return;
  }
  if (coordinates.length === 1) {
    map.easeTo({ center: coordinates[0], zoom: 8, duration: reducedMotion ? 0 : 450 });
    return;
  }
  const bounds = new maplibre.LngLatBounds();
  coordinates.forEach((coordinate) => bounds.extend(coordinate));
  map.fitBounds(bounds, { padding: { top: 86, bottom: 78, left: 54, right: 54 }, maxZoom: 9.4, duration: reducedMotion ? 0 : 650 });
}

function appendPopupLine(root: HTMLElement, value: string, className?: string) {
  if (!value) return;
  const line = document.createElement(className === "title" ? "strong" : "span");
  line.textContent = value;
  line.style.display = "block";
  line.style.marginTop = className === "title" ? "0" : "4px";
  root.appendChild(line);
}

export function RealGeographicMap({
  points,
  routes = [],
  selectedPointId,
  onPointSelect,
  title = "Mapa de eventos reportados",
  subtitle = "Puntos geográficos observados; no infiere autenticaciones ni recorridos físicos.",
  caption,
  className = "",
  heightClassName = "h-[24rem]",
  density = "balanced",
  chrome = "full",
  maxPoints = 120,
  maxRoutes = 72,
  evidenceSteps = [],
  ledgerItems = [],
  mapSource,
  ariaLabel,
}: RealGeographicMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const pointsRef = useRef(points);
  const onPointSelectRef = useRef(onPointSelect);
  const titleId = useId();
  const summaryId = useId();
  const [mapTheme, setMapTheme] = useState<MapTheme | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapWarning, setMapWarning] = useState<string | null>(null);

  pointsRef.current = points;
  onPointSelectRef.current = onPointSelect;

  const visiblePoints = useMemo(() => (density === "heat"
    ? [...points].sort((left, right) => Number(right.scans || 0) - Number(left.scans || 0))
    : points).slice(0, maxPoints), [density, maxPoints, points]);
  const visibleRoutes = useMemo(() => routes.slice(0, maxRoutes), [maxRoutes, routes]);
  const pointGeoJson = useMemo(() => buildTrustMapPointGeoJson(visiblePoints, density), [density, visiblePoints]);
  const routeGeoJson = useMemo(() => buildTrustMapRouteGeoJson(visibleRoutes), [visibleRoutes]);
  const coordinateSignature = useMemo(() => `${pointGeoJson.features.map((feature) => `${feature.properties.id}:${feature.geometry.coordinates.join(",")}:${feature.properties.scans}`).join("|")}::${routeGeoJson.features.map((feature) => `${feature.properties.id}:${feature.geometry.coordinates.flat().join(",")}`).join("|")}`, [pointGeoJson, routeGeoJson]);
  const trustMapSource = useMemo(() => resolveTrustMapSource(mapSource), [mapSource]);
  const selectedPoint = visiblePoints.find((point) => point.id === selectedPointId) || null;
  const totalEvents = visiblePoints.reduce((sum, point) => sum + Math.max(0, Number(point.scans || 0)), 0);
  const riskCount = visiblePoints.filter((point) => pointTone(point) === "risk" || Number(point.risk || 0) > 0).length;
  const compactChrome = chrome === "minimal" || chrome === "enterprise-atlas";
  const isLightTheme = mapTheme !== "dark";
  const mapCanvasLabel = ariaLabel || title;

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setMapTheme(resolveDocumentMapTheme(root));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme", "data-nexid-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mapTheme === null) return;
    let cancelled = false;
    let resizeCleanup: (() => void) | undefined;
    setLoaded(false);
    setMapError(null);
    setMapWarning(null);

    const boot = async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibre;
      const baseStyle = trustMapSource.rasterTileTemplate
        ? mapStyle(trustMapSource.rasterTileTemplate, trustMapSource.attribution, isLightTheme)
        : isLightTheme
          ? trustMapSource.styleUrl
          : trustMapSource.darkStyleUrl;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: baseStyle as never,
        center: [-64.2, -34.6],
        zoom: 3.2,
        attributionControl: false,
        cooperativeGestures: true,
        fadeDuration: 0,
      });
      mapRef.current = map;
      const canvas = map.getCanvas();
      canvas.setAttribute("aria-label", mapCanvasLabel);
      canvas.setAttribute("aria-describedby", summaryId);
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        if (cancelled) return;
        addEvidenceLayers(map, pointGeoJson, routeGeoJson, density, selectedPointId);
        fitEvidence(maplibre, map, pointGeoJson, routeGeoJson, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        setLoaded(true);
      });
      map.on("error", (event) => {
        if (cancelled || !event?.error) return;
        if (!map.loaded()) {
          setMapError("No se pudieron cargar las teselas del mapa.");
          return;
        }
        setMapWarning("Algunas teselas no se pudieron cargar. El resumen textual conserva la evidencia disponible.");
      });
      map.on("click", "nexid-evidence-clusters", async (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const source = map.getSource("nexid-evidence-points") as GeoJSONSource | undefined;
        const clusterId = feature?.properties?.cluster_id;
        const coordinate = (feature?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
        if (!source || clusterId == null || !coordinate) return;
        const expansionZoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: coordinate, zoom: expansionZoom, duration: 420 });
      });
      map.on("click", "nexid-evidence-points-layer", (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const id = String(feature?.properties?.id || "");
        const coordinate = (feature?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
        const point = pointsRef.current.find((item) => item.id === id);
        if (!point || !coordinate) return;
        onPointSelectRef.current?.(point);
        popupRef.current?.remove();
        const card = document.createElement("div");
        card.className = "nexid-map-popup-card";
        appendPopupLine(card, point.label, "title");
        appendPopupLine(card, point.sublabel || "");
        appendPopupLine(card, point.evidence || "");
        appendPopupLine(card, point.scans ? `${point.scans} eventos observados` : "Punto geográfico reportado");
        popupRef.current = new maplibre.Popup({ closeButton: false, closeOnClick: true, className: "nexid-map-popup" })
          .setLngLat(coordinate)
          .setDOMContent(card)
          .addTo(map);
      });
      map.on("mouseenter", "nexid-evidence-points-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "nexid-evidence-points-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "nexid-evidence-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "nexid-evidence-clusters", () => { map.getCanvas().style.cursor = ""; });

      if ("ResizeObserver" in window && containerRef.current) {
        const observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);
        resizeCleanup = () => observer.disconnect();
      }
    };
    void boot().catch(() => {
      if (!cancelled) setMapError("No se pudo iniciar MapLibre en este dispositivo.");
    });
    return () => {
      cancelled = true;
      resizeCleanup?.();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
    // Density changes cluster/source semantics, so rebuild the engine as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, mapTheme, trustMapSource.attribution, trustMapSource.darkStyleUrl, trustMapSource.rasterTileTemplate, trustMapSource.styleUrl]);

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.setAttribute("aria-label", mapCanvasLabel);
    canvas.setAttribute("aria-describedby", summaryId);
  }, [mapCanvasLabel, summaryId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("nexid-evidence-points") as GeoJSONSource | undefined)?.setData(pointGeoJson as never);
    (map.getSource("nexid-evidence-heat") as GeoJSONSource | undefined)?.setData(pointGeoJson as never);
    (map.getSource("nexid-evidence-routes") as GeoJSONSource | undefined)?.setData(routeGeoJson as never);
    const maplibre = maplibreRef.current;
    if (maplibre) fitEvidence(maplibre, map, pointGeoJson, routeGeoJson, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinateSignature, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getLayer("nexid-evidence-selected")) return;
    map.setFilter("nexid-evidence-selected", ["==", ["get", "id"], selectedPointId || "__none__"]);
  }, [loaded, selectedPointId]);

  return (
    <section
      className={["nexid-real-map relative isolate overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950 shadow-[0_20px_58px_rgba(15,23,42,.18)]", heightClassName, className].join(" ")}
      data-nexid-map="maplibre-gl"
      data-nexid-map-engine="maplibre-gl"
      data-nexid-map-source={trustMapSource.id}
      data-nexid-map-theme={mapTheme || "light"}
      data-map-density={density}
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <div ref={containerRef} className="absolute inset-0" />

      <div className={`pointer-events-none absolute left-3 top-3 z-10 max-w-[min(31rem,calc(100%-6.5rem))] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md ${isLightTheme ? "border-slate-200 bg-white/90 text-slate-900" : "border-white/10 bg-slate-950/82 text-white"}`}>
        <h3 id={titleId} className="text-xs font-black uppercase tracking-[0.12em] sm:text-sm">{title}</h3>
        {!compactChrome ? <p className={`mt-1 text-[10px] leading-4 sm:text-xs ${isLightTheme ? "text-slate-600" : "text-slate-300"}`}>{subtitle}</p> : null}
        <span className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${isLightTheme ? "border-cyan-700/20 bg-cyan-50 text-cyan-800" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"}`}>MapLibre GL · {trustMapSource.attribution}</span>
      </div>

      {loaded && !mapError ? (
        <div className={`pointer-events-none absolute bottom-8 left-3 z-10 flex flex-wrap gap-1.5 rounded-lg border p-2 text-[9px] font-bold shadow-lg backdrop-blur ${isLightTheme ? "border-slate-200 bg-white/88 text-slate-700" : "border-white/10 bg-slate-950/82 text-slate-200"}`} aria-label="Leyenda del mapa">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />Evento</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Origen declarado</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Riesgo separado</span>
          {density === "heat" ? <span className="basis-full">Calor = volumen observado · escala 1 / 10 / 100 / 1000+</span> : null}
        </div>
      ) : null}

      {!loaded && !mapError ? (
        <div className={`absolute inset-0 z-20 grid place-items-center text-center text-sm ${isLightTheme ? "bg-slate-50/92 text-slate-600" : "bg-slate-950/88 text-slate-300"}`} role="status" aria-busy="true">
          <span><i className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-400 motion-reduce:animate-none" />Cargando mapa geográfico real…</span>
        </div>
      ) : null}
      {mapError ? (
        <div className={`absolute inset-0 z-20 grid place-items-center p-6 text-center text-sm ${isLightTheme ? "bg-white text-slate-700" : "bg-slate-950 text-slate-300"}`} role="alert">
          <div><b className="block text-rose-500">Mapa no disponible</b><span className="mt-1 block">{mapError} Conservamos el resumen textual; no mostramos geografía inventada.</span></div>
        </div>
      ) : null}
      {loaded && !mapError && mapWarning ? (
        <div className={`absolute inset-x-3 top-[5.5rem] z-20 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur ${isLightTheme ? "border-amber-300 bg-amber-50/95 text-amber-950" : "border-amber-300/35 bg-amber-950/90 text-amber-100"}`} role="status">
          {mapWarning}
        </div>
      ) : null}
      {loaded && !mapError && pointGeoJson.features.length === 0 ? (
        <div className={`pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border p-4 text-center text-sm shadow-xl backdrop-blur ${isLightTheme ? "border-slate-200 bg-white/92 text-slate-700" : "border-white/10 bg-slate-950/88 text-slate-300"}`}>
          <b className={isLightTheme ? "text-slate-950" : "text-white"}>Sin ubicaciones observadas para mostrar</b>
          <span className="mt-1 block">Cuando exista un evento con coordenadas válidas aparecerá aquí. No generamos puntos artificiales.</span>
        </div>
      ) : null}

      <p id={summaryId} className="sr-only">{ariaLabel || `${subtitle} ${pointGeoJson.features.length} puntos geográficos, ${routeGeoJson.features.length} relaciones reportadas, ${totalEvents} eventos observados y ${riskCount} señales de riesgo separadas.`}</p>

      {selectedPoint ? (
        <div className={`pointer-events-none absolute bottom-8 right-3 z-10 hidden max-w-[18rem] rounded-lg border p-2 text-xs shadow-xl backdrop-blur sm:block ${isLightTheme ? "border-slate-200 bg-white/90 text-slate-700" : "border-white/10 bg-slate-950/84 text-slate-300"}`}>
          <b className={isLightTheme ? "text-slate-950" : "text-white"}>{selectedPoint.label}</b>
          {selectedPoint.sublabel ? <span className="mt-1 block">{selectedPoint.sublabel}</span> : null}
        </div>
      ) : null}

      {(caption || evidenceSteps.length || ledgerItems.length) ? (
        <details className={`absolute bottom-2 right-3 z-20 max-w-[min(23rem,calc(100%-1.5rem))] rounded-lg border text-xs shadow-xl backdrop-blur ${isLightTheme ? "border-slate-200 bg-white/92 text-slate-700" : "border-white/10 bg-slate-950/90 text-slate-300"}`}>
          <summary className="min-h-11 cursor-pointer px-3 py-2 font-bold">Evidencia y resumen del mapa</summary>
          <div className="max-h-56 overflow-auto border-t border-current/10 px-3 py-2">
            {caption ? <p>{caption}</p> : null}
            {[...evidenceSteps, ...ledgerItems].slice(0, 6).map((item) => <p key={item.id} className="mt-2"><b>{item.label}:</b> {item.value}{item.detail ? ` · ${item.detail}` : ""}</p>)}
            {visiblePoints.length ? (
              <div className="mt-3 grid gap-1.5">
                {visiblePoints.slice(0, 8).map((point) => (
                  <button key={point.id} type="button" className={`min-h-11 rounded-lg border px-2 py-1 text-left ${isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5"}`} onClick={() => onPointSelect?.(point)}>
                    <b className="block">{point.label}</b><span>{point.sublabel || `${point.scans || 0} eventos`}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export const EMPTY_TRUST_MAP_POINTS = EMPTY_POINTS;
export const EMPTY_TRUST_MAP_ROUTES = EMPTY_ROUTES;
