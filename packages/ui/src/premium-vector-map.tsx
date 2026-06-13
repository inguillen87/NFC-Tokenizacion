"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { formatTrustTileUrl, resolveTrustMapSource, type TrustMapSourceOverrides } from "./trust-map-source";

export type VectorMapTone = "origin" | "tap" | "hub" | "risk" | "token";
export type VectorMapEvidenceTone = "origin" | "tap" | "token" | "risk" | "loyalty" | "marketplace";

export type VectorMapPoint = {
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  scans?: number;
  risk?: number;
  tone?: VectorMapTone;
  stageLabel?: string;
  evidence?: string;
  lastSeen?: string;
};

export type VectorMapRoute = {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  label?: string;
  tone?: "info" | "warn" | "success";
  distanceLabel?: string;
  evidence?: string;
};

export type VectorMapEvidenceStep = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: VectorMapEvidenceTone;
};

export type VectorMapLedgerItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: VectorMapEvidenceTone;
};

type MapDensity = "balanced" | "heat" | "route";
type MapChrome = "full" | "compact" | "minimal";

const WIDTH = 1200;
const HEIGHT = 620;
const LIGHT_PUBLIC_RASTER_TEMPLATE = "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";

type AtlasRegionTone = "americas" | "europe" | "africa" | "asia" | "oceania" | "south";

type AtlasRegion = {
  id: string;
  name: string;
  d: string;
  tone: AtlasRegionTone;
  opacity: number;
};

const ATLAS_REGIONS: AtlasRegion[] = [
  {
    id: "north-america",
    name: "North America",
    tone: "americas",
    opacity: 0.7,
    d: "M136 202 C124 163 151 126 202 111 C247 98 296 76 349 101 C401 126 448 151 460 196 C470 233 431 255 384 259 C339 263 330 293 287 309 C237 328 201 310 180 275 C162 247 147 232 136 202 Z",
  },
  {
    id: "central-america",
    name: "Central America",
    tone: "americas",
    opacity: 0.58,
    d: "M288 296 C327 285 366 295 403 318 C386 340 350 347 313 337 C287 331 266 316 288 296 Z",
  },
  {
    id: "south-america",
    name: "South America",
    tone: "americas",
    opacity: 0.64,
    d: "M362 340 C414 364 452 416 451 470 C450 522 411 572 365 589 C341 537 312 496 318 445 C323 397 332 365 362 340 Z",
  },
  {
    id: "europe",
    name: "Europe",
    tone: "europe",
    opacity: 0.64,
    d: "M560 154 C594 119 657 112 704 137 C746 160 745 207 711 230 C678 252 625 240 587 220 C551 201 538 177 560 154 Z",
  },
  {
    id: "africa",
    name: "Africa",
    tone: "africa",
    opacity: 0.62,
    d: "M601 254 C653 224 718 243 749 300 C778 353 754 427 702 478 C647 456 613 397 590 337 C576 302 572 269 601 254 Z",
  },
  {
    id: "asia",
    name: "Asia",
    tone: "asia",
    opacity: 0.66,
    d: "M707 162 C783 105 929 112 1034 174 C1117 223 1111 311 1020 337 C959 354 910 330 863 361 C814 394 748 354 718 303 C690 254 665 194 707 162 Z",
  },
  {
    id: "oceania",
    name: "Oceania",
    tone: "oceania",
    opacity: 0.6,
    d: "M905 423 C950 395 1015 410 1050 451 C1017 499 942 512 899 477 C879 459 878 438 905 423 Z",
  },
  {
    id: "antarctica-shelf",
    name: "South shelf",
    tone: "south",
    opacity: 0.28,
    d: "M94 552 C232 531 398 538 526 551 C660 564 825 555 1104 538 L1130 600 L76 600 Z",
  },
];

const TERRAIN_LINES = [
  "M162 195 C221 176 300 165 425 190",
  "M206 257 C267 246 331 247 399 267",
  "M332 393 C370 420 392 466 386 522",
  "M586 190 C626 178 666 180 707 201",
  "M618 294 C663 309 701 342 729 393",
  "M734 221 C820 197 925 204 1018 247",
  "M786 301 C866 292 942 300 1009 327",
  "M915 453 C952 439 994 443 1030 464",
];

const OCEAN_LANES = [
  "M214 378 C342 318 494 305 640 340 C792 376 925 365 1050 304",
  "M154 256 C318 250 432 282 557 306 C726 338 885 321 1045 245",
  "M284 530 C425 478 560 456 707 473 C853 489 972 488 1102 455",
  "M456 174 C536 213 591 248 652 316 C713 384 782 416 880 434",
];

const TRACE_WINDOWS = [
  { x: 92, y: 94, width: 246, height: 108, opacity: 0.18 },
  { x: 418, y: 72, width: 318, height: 130, opacity: 0.14 },
  { x: 754, y: 116, width: 338, height: 154, opacity: 0.16 },
  { x: 250, y: 392, width: 284, height: 112, opacity: 0.15 },
  { x: 688, y: 374, width: 356, height: 124, opacity: 0.13 },
];

const ROUTE_CORRIDORS = [
  "M118 425 C254 338 421 322 594 352 C756 380 905 356 1088 248",
  "M160 305 C330 276 482 303 628 331 C774 360 910 338 1052 286",
  "M314 534 C456 462 610 447 782 474 C900 492 1002 487 1118 452",
  "M464 154 C538 214 587 280 640 360 C696 442 766 478 876 494",
];

const ATLAS_LABELS = [
  { label: "AMERICAS", x: 240, y: 166 },
  { label: "EUROPE", x: 612, y: 158 },
  { label: "AFRICA", x: 632, y: 340 },
  { label: "ASIA", x: 850, y: 190 },
  { label: "EXPORT LANES", x: 760, y: 516 },
];

const CITY_LIGHTS: Array<{ lat: number; lng: number; opacity: number }> = [
  { lat: -34.6, lng: -58.4, opacity: 0.72 },
  { lat: -33.0, lng: -68.8, opacity: 0.88 },
  { lat: -23.5, lng: -46.6, opacity: 0.64 },
  { lat: -12.0, lng: -77.0, opacity: 0.54 },
  { lat: 19.4, lng: -99.1, opacity: 0.64 },
  { lat: 25.7, lng: -80.2, opacity: 0.58 },
  { lat: 40.7, lng: -74.0, opacity: 0.62 },
  { lat: 51.5, lng: -0.1, opacity: 0.66 },
  { lat: 48.8, lng: 2.3, opacity: 0.62 },
  { lat: 47.3, lng: 8.5, opacity: 0.74 },
  { lat: 25.2, lng: 55.2, opacity: 0.52 },
  { lat: 1.3, lng: 103.8, opacity: 0.58 },
  { lat: 35.6, lng: 139.6, opacity: 0.62 },
  { lat: -33.8, lng: 151.2, opacity: 0.46 },
];

const MAP_PLACE_LABELS = [
  { label: "ARGENTINA", lat: -38.4, lng: -64.2, tone: "country" },
  { label: "BRASIL", lat: -10.6, lng: -53.1, tone: "country" },
  { label: "CHILE", lat: -31.5, lng: -71.1, tone: "country" },
  { label: "URUGUAY", lat: -32.8, lng: -55.8, tone: "country" },
  { label: "MENDOZA", lat: -32.9, lng: -68.8, tone: "city" },
  { label: "SAO PAULO", lat: -23.5, lng: -46.6, tone: "city" },
  { label: "MIAMI", lat: 25.7, lng: -80.2, tone: "city" },
  { label: "ZURICH", lat: 47.3, lng: 8.5, tone: "city" },
  { label: "EUROPE", lat: 49.5, lng: 12.5, tone: "region" },
  { label: "NORTH AMERICA", lat: 46, lng: -103, tone: "region" },
  { label: "ASIA", lat: 42, lng: 88, tone: "region" },
  { label: "OCEANIA", lat: -24, lng: 134, tone: "region" },
] as const;

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * WIDTH;
  const clippedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clippedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * HEIGHT;
  return { x, y };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function fittedViewBox(points: VectorMapPoint[], routes: VectorMapRoute[], density: MapDensity) {
  if (density !== "route") return `0 0 ${WIDTH} ${HEIGHT}`;
  const coords = [
    ...points.map((point) => project(point.lat, point.lng)),
    ...routes.flatMap((route) => [project(route.fromLat, route.fromLng), project(route.toLat, route.toLng)]),
  ];
  if (!coords.length) return `0 0 ${WIDTH} ${HEIGHT}`;
  const minX = Math.min(...coords.map((coord) => coord.x));
  const maxX = Math.max(...coords.map((coord) => coord.x));
  const minY = Math.min(...coords.map((coord) => coord.y));
  const maxY = Math.max(...coords.map((coord) => coord.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const width = Math.min(WIDTH, Math.max(150, spanX * 4.2));
  const height = Math.min(HEIGHT, Math.max(116, spanY * 4.8));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const x = clamp(centerX - width / 2, 0, WIDTH - width);
  const y = clamp(centerY - height / 2, 0, HEIGHT - height);
  return `${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
}

function parseViewBox(value: string) {
  const [x, y, width, height] = value.split(" ").map((item) => Number(item));
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(width) ? width : WIDTH,
    height: Number.isFinite(height) ? height : HEIGHT,
  };
}

function mapTilesForViewBox(viewBox: string, density: MapDensity, rasterTileTemplate: string) {
  const box = parseViewBox(viewBox);
  const zoom = density === "route"
    ? box.width < 190 ? 6 : box.width < 360 ? 5 : box.width < 680 ? 4 : 3
    : density === "heat" ? 3 : 3;
  const tilesPerAxis = 2 ** zoom;
  const tileWidth = WIDTH / tilesPerAxis;
  const tileHeight = HEIGHT / tilesPerAxis;
  const minX = Math.floor(box.x / tileWidth) - 1;
  const maxX = Math.ceil((box.x + box.width) / tileWidth) + 1;
  const minY = Math.max(0, Math.floor(box.y / tileHeight) - 1);
  const maxY = Math.min(tilesPerAxis - 1, Math.ceil((box.y + box.height) / tileHeight) + 1);
  const tiles: Array<{ key: string; href: string; x: number; y: number; width: number; height: number }> = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const wrappedX = ((x % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}-${x}`,
        href: formatTrustTileUrl(rasterTileTemplate, zoom, wrappedX, y),
        x: x * tileWidth,
        y: y * tileHeight,
        width: tileWidth,
        height: tileHeight,
      });
    }
  }
  return tiles;
}

function routePath(route: VectorMapRoute) {
  const a = project(route.fromLat, route.fromLng);
  const b = project(route.toLat, route.toLng);
  const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const lift = route.tone === "warn" ? 78 : Math.max(48, Math.min(108, distance * 0.18));
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - lift;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function toneFor(point: VectorMapPoint): VectorMapTone {
  if (point.tone) return point.tone;
  if ((point.risk || 0) > 0) return "risk";
  return "hub";
}

function pointColor(tone: VectorMapTone) {
  if (tone === "origin") return "#34d399";
  if (tone === "tap") return "#22d3ee";
  if (tone === "risk") return "#fb7185";
  if (tone === "token") return "#a78bfa";
  return "#38bdf8";
}

function heatColor(tone: VectorMapTone) {
  if (tone === "origin") return "rgba(52,211,153,0.34)";
  if (tone === "tap") return "rgba(34,211,238,0.34)";
  if (tone === "risk") return "rgba(251,113,133,0.38)";
  if (tone === "token") return "rgba(167,139,250,0.34)";
  return "rgba(56,189,248,0.28)";
}

function routeColor(tone?: VectorMapRoute["tone"]) {
  if (tone === "warn") return "#fb7185";
  if (tone === "success") return "#34d399";
  return "#67e8f9";
}

function evidenceStyle(tone?: VectorMapEvidenceTone) {
  if (tone === "origin") return { borderColor: "rgba(52,211,153,.28)", background: "rgba(6,78,59,.34)", color: "#bbf7d0" };
  if (tone === "tap") return { borderColor: "rgba(34,211,238,.3)", background: "rgba(8,47,73,.38)", color: "#cffafe" };
  if (tone === "token") return { borderColor: "rgba(167,139,250,.34)", background: "rgba(76,29,149,.32)", color: "#ddd6fe" };
  if (tone === "risk") return { borderColor: "rgba(251,113,133,.34)", background: "rgba(127,29,29,.3)", color: "#ffe4e6" };
  if (tone === "loyalty") return { borderColor: "rgba(45,212,191,.3)", background: "rgba(19,78,74,.3)", color: "#ccfbf1" };
  if (tone === "marketplace") return { borderColor: "rgba(251,191,36,.32)", background: "rgba(113,63,18,.26)", color: "#fef3c7" };
  return { borderColor: "rgba(148,163,184,.22)", background: "rgba(15,23,42,.62)", color: "#e2e8f0" };
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

export function PremiumVectorMap({
  points,
  routes = [],
  selectedPointId,
  onPointSelect,
  title = "Mapa vivo",
  subtitle = "Rutas, taps y evidencia sin ruido cartografico.",
  caption,
  className = "",
  heightClassName = "h-[24rem]",
  density = "balanced",
  chrome = "full",
  maxPoints = 48,
  maxRoutes = 24,
  evidenceSteps = [],
  ledgerItems = [],
  mapSource,
}: {
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
  chrome?: MapChrome;
  maxPoints?: number;
  maxRoutes?: number;
  evidenceSteps?: VectorMapEvidenceStep[];
  ledgerItems?: VectorMapLedgerItem[];
  mapSource?: TrustMapSourceOverrides;
}) {
  const rawId = useId();
  const idPrefix = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, ""), [rawId]);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const visiblePoints = points.slice(0, maxPoints);
  const visibleRoutes = routes.slice(0, maxRoutes);
  const viewBox = fittedViewBox(visiblePoints, visibleRoutes, density);
  const viewBoxMetrics = parseViewBox(viewBox);
  const isTightRouteView = density === "route" && viewBoxMetrics.width < 260;
  const routeHaloColor = isLightTheme ? "#ffffff" : "#020617";
  const routeHaloOpacity = isLightTheme ? "0.86" : "0.42";
  const labelPanelFill = isLightTheme ? "rgba(255,255,255,0.9)" : "rgba(2,6,23,0.74)";
  const labelPanelStrokeOpacity = isLightTheme ? "0.42" : "0.32";
  const labelTextFill = isLightTheme ? "#0f172a" : "#e0f2fe";
  const labelMutedFill = isLightTheme ? "#334155" : "#94a3b8";
  const labelHaloColor = isLightTheme ? "rgba(255,255,255,0.92)" : "rgba(2,6,23,0.72)";
  const pointCenterFill = isLightTheme ? "rgba(255,255,255,0.88)" : "rgba(2,6,23,0.7)";
  const atlasLabelFill = isLightTheme ? "#155e75" : "#bae6fd";
  const atlasHaloColor = isLightTheme ? "rgba(255,255,255,0.92)" : "rgba(2,6,23,0.7)";
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      const explicitTheme = root.getAttribute("data-theme") || root.getAttribute("data-nexid-theme");
      setIsLightTheme(root.classList.contains("theme-light") || explicitTheme === "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme", "data-nexid-theme"] });
    return () => observer.disconnect();
  }, []);
  const trustMapSource = useMemo(() => {
    const resolved = resolveTrustMapSource(mapSource);
    if (isLightTheme && resolved.mode === "public-raster" && resolved.rasterTileTemplate.includes("/dark_all/")) {
      return {
        ...resolved,
        rasterTileTemplate: LIGHT_PUBLIC_RASTER_TEMPLATE,
        detail: "Fallback publico claro sin API key; reemplazable por PMTiles o tiles propios.",
      };
    }
    return resolved;
  }, [isLightTheme, mapSource]);
  const mapTiles = mapTilesForViewBox(viewBox, density, trustMapSource.rasterTileTemplate);
  const maxScan = Math.max(1, ...visiblePoints.map((point) => point.scans || 1));
  const selectedPoint = visiblePoints.find((point) => point.id === selectedPointId) || visiblePoints[0] || null;
  const riskCount = visiblePoints.filter((point) => (point.risk || 0) > 0 || toneFor(point) === "risk").length;
  const routeCount = visibleRoutes.length;
  const tokenCount = visiblePoints.filter((point) => toneFor(point) === "token").length;
  const totalEvents = visiblePoints.reduce((sum, point) => sum + (point.scans || 0), 0);
  const focusedRoute = selectedPoint
    ? visibleRoutes.find((route) => {
        const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
        return (close(route.fromLat, selectedPoint.lat) && close(route.fromLng, selectedPoint.lng))
          || (close(route.toLat, selectedPoint.lat) && close(route.toLng, selectedPoint.lng));
      })
    : null;
  const selectedTone = selectedPoint ? toneFor(selectedPoint) : "hub";
  const mapStorySteps: VectorMapEvidenceStep[] = evidenceSteps.length
    ? evidenceSteps.slice(0, 4)
    : selectedPoint
      ? [
          {
            id: "selected",
            label: selectedPoint.stageLabel || (selectedTone === "origin" ? "Origen" : selectedTone === "tap" ? "Tap" : selectedTone === "token" ? "Token/NFT" : "Evento"),
            value: selectedPoint.label,
            detail: selectedPoint.evidence || selectedPoint.sublabel || selectedPoint.lastSeen || "Evidencia seleccionada",
            tone: selectedTone === "hub" ? "tap" : selectedTone,
          },
          focusedRoute
            ? {
                id: "route",
                label: "Ruta de confianza",
                value: focusedRoute.distanceLabel || focusedRoute.label || "Origen a tap",
                detail: focusedRoute.evidence || "Movimiento trazado sobre motor vectorial propio",
                tone: focusedRoute.tone === "warn" ? "risk" : "origin",
              }
            : {
                id: "coverage",
                label: "Cobertura",
                value: `${routeCount} rutas activas`,
                detail: "Lecturas y puntos de custodia listos para auditoria",
                tone: "loyalty",
              },
        ]
      : [];
  const mapLedgerItems = ledgerItems.slice(0, 4);

  function handlePointKey(event: KeyboardEvent<SVGGElement>, point: VectorMapPoint) {
    if (!onPointSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPointSelect(point);
    }
  }

  return (
    <div
      className={[
        "relative isolate overflow-hidden rounded-xl border border-cyan-300/15 bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(2,6,23,0.38)]",
        heightClassName,
        className,
      ].join(" ")}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio={density === "route" ? "xMidYMid meet" : "xMidYMid slice"}
        className="absolute inset-0 h-full w-full"
        aria-hidden={chrome === "minimal"}
        data-nexid-map="premium-vector-map"
        data-nexid-map-engine={trustMapSource.mode}
        data-nexid-map-source={trustMapSource.id}
        data-nexid-map-theme={isLightTheme ? "light" : "dark"}
        data-nexid-pmtiles-url={trustMapSource.pmtilesUrl || undefined}
      >
        <defs>
          <linearGradient id={`${idPrefix}-radar-gradient`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-ocean`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--nexid-vector-ocean-1, #061d32)" />
            <stop offset="46%" stopColor="var(--nexid-vector-ocean-2, #071523)" />
            <stop offset="100%" stopColor="var(--nexid-vector-ocean-3, #0b1026)" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-route-band`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="48%" stopColor="#67e8f9" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-land`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--nexid-vector-land-1, #0f766e)" stopOpacity="var(--nexid-vector-land-opacity-1, 0.34)" />
            <stop offset="52%" stopColor="var(--nexid-vector-land-2, #0e7490)" stopOpacity="var(--nexid-vector-land-opacity-2, 0.24)" />
            <stop offset="100%" stopColor="var(--nexid-vector-land-3, #1e3a8a)" stopOpacity="var(--nexid-vector-land-opacity-3, 0.18)" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-land-edge`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--nexid-vector-land-edge-1, #67e8f9)" stopOpacity="var(--nexid-vector-land-edge-opacity-1, 0.18)" />
            <stop offset="50%" stopColor="var(--nexid-vector-land-edge-2, #ccfbf1)" stopOpacity="var(--nexid-vector-land-edge-opacity-2, 0.46)" />
            <stop offset="100%" stopColor="var(--nexid-vector-land-edge-3, #a78bfa)" stopOpacity="var(--nexid-vector-land-edge-opacity-3, 0.16)" />
          </linearGradient>
          <radialGradient id={`${idPrefix}-trace-wash`} cx="52%" cy="46%" r="72%">
            <stop offset="0%" stopColor="var(--nexid-vector-trace-wash-1, rgba(20,184,166,0.08))" />
            <stop offset="46%" stopColor="var(--nexid-vector-trace-wash-2, rgba(8,47,73,0.055))" />
            <stop offset="100%" stopColor="var(--nexid-vector-trace-wash-3, rgba(2,6,23,0))" />
          </radialGradient>
          <radialGradient id={`${idPrefix}-vignette`} cx="50%" cy="48%" r="66%">
            <stop offset="0%" stopColor="var(--nexid-vector-vignette-1, rgba(34,211,238,0.12))" />
            <stop offset="58%" stopColor="var(--nexid-vector-vignette-2, rgba(15,23,42,0.12))" />
            <stop offset="100%" stopColor="var(--nexid-vector-vignette-3, rgba(2,6,23,0.76))" />
          </radialGradient>
          <filter id={`${idPrefix}-soft-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.13 0 0 0 0 0.83 0 0 0 0 0.93 0 0 0 .45 0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${idPrefix}-basemap-noise`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.022" numOctaves="2" seed="8" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.10 0 0 0 0 0.55 0 0 0 0 0.65 0 0 0 .18 0" />
          </filter>
          <pattern id={`${idPrefix}-micro-grid`} width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 H 0 V 60" fill="none" stroke="var(--nexid-vector-grid-major, rgba(125,211,252,0.075))" strokeWidth="1" />
          </pattern>
          <pattern id={`${idPrefix}-scan-grid`} width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M 18 0 H 0 V 18" fill="none" stroke="var(--nexid-vector-grid-minor, rgba(148,163,184,0.08))" strokeWidth="0.6" />
          </pattern>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-ocean)`} />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-trace-wash)`} />
        
        {/* Radar global scanning sweep */}
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-radar-gradient)`} className="pointer-events-none" opacity="0.12">
          <animate attributeName="x" values={`-${WIDTH};${WIDTH}`} dur="6s" repeatCount="indefinite" />
        </rect>
        {mapTiles.length ? (
          <g opacity={density === "route" ? "1" : "0.98"}>
            {mapTiles.map((tile) => (
              <image
                key={tile.key}
                href={tile.href}
                x={tile.x}
                y={tile.y}
                width={tile.width}
                height={tile.height}
                preserveAspectRatio="none"
              />
            ))}
            <rect width={WIDTH} height={HEIGHT} fill={density === "route" ? "var(--nexid-vector-tile-overlay-route, rgba(2,6,23,0.16))" : "var(--nexid-vector-tile-overlay, rgba(2,6,23,0.22))"} />
            <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-trace-wash)`} opacity={density === "route" ? "var(--nexid-vector-trace-opacity-route, 0.1)" : "var(--nexid-vector-trace-opacity, 0.14)"} />
          </g>
        ) : null}
        <rect width={WIDTH} height={HEIGHT} filter={`url(#${idPrefix}-basemap-noise)`} opacity={mapTiles.length ? "var(--nexid-vector-noise-opacity-tiles, 0.006)" : density === "route" ? "var(--nexid-vector-noise-opacity-route, 0.05)" : "var(--nexid-vector-noise-opacity, 0.18)"} />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-micro-grid)`} opacity={mapTiles.length ? "var(--nexid-vector-grid-opacity-tiles, 0.018)" : density === "route" ? "var(--nexid-vector-grid-opacity-route, 0.22)" : "var(--nexid-vector-grid-opacity, 0.72)"} />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-scan-grid)`} opacity={mapTiles.length ? "var(--nexid-vector-scan-opacity-tiles, 0.008)" : density === "route" ? "var(--nexid-vector-scan-opacity-route, 0.05)" : "var(--nexid-vector-scan-opacity, 0.18)"} />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-vignette)`} />

        <g opacity={mapTiles.length ? "0.006" : density === "route" ? "0.08" : "0.48"}>
          {TRACE_WINDOWS.map((window) => (
            <rect
              key={`trace-window-${window.x}-${window.y}`}
              x={window.x}
              y={window.y}
              width={window.width}
              height={window.height}
              rx="22"
              fill="none"
              stroke="rgba(125,211,252,0.22)"
              strokeWidth="1.2"
              strokeDasharray="2 9"
              opacity={window.opacity}
            />
          ))}
        </g>

        <g opacity={mapTiles.length ? "0.02" : density === "route" ? "0.2" : "0.58"}>
          {PARALLELS.map((lat) => {
            const y = project(lat, 0).y;
            return <line key={`lat-${lat}`} x1="58" x2={WIDTH - 58} y1={y} y2={y} stroke="rgba(125,211,252,0.12)" strokeWidth="1.1" strokeDasharray="8 14" />;
          })}
          {MERIDIANS.map((lng) => {
            const x = project(0, lng).x;
            return <line key={`lng-${lng}`} x1={x} x2={x} y1="42" y2={HEIGHT - 42} stroke="rgba(125,211,252,0.10)" strokeWidth="1.1" strokeDasharray="8 14" />;
          })}
        </g>

        <g opacity={mapTiles.length ? "0.006" : density === "route" ? "0.14" : "0.42"}>
          {ROUTE_CORRIDORS.map((path, index) => (
            <path
              key={`route-corridor-${index}`}
              d={path}
              fill="none"
              stroke={`url(#${idPrefix}-route-band)`}
              strokeWidth={index === 0 ? "4" : "2.8"}
              strokeLinecap="round"
              opacity={index === 0 ? "0.52" : "0.28"}
            />
          ))}
          {OCEAN_LANES.map((path, index) => (
            <path
              key={`data-lane-${index}`}
              d={path}
              fill="none"
              stroke="rgba(186,230,253,0.12)"
              strokeWidth="1.1"
              strokeDasharray={index % 2 === 0 ? "2 13" : "7 18"}
              strokeLinecap="round"
              opacity="0.52"
            />
          ))}
        </g>

        {!mapTiles.length ? (
        <g opacity={density === "route" ? "0.92" : chrome === "minimal" ? "0.28" : "0.42"}>
          {ATLAS_REGIONS.map((region) => (
            <g key={region.id}>
              <path d={region.d} fill={`url(#${idPrefix}-land)`} opacity={density === "route" ? region.opacity : region.opacity * 0.62} />
              <path d={region.d} fill="none" stroke={`url(#${idPrefix}-land-edge)`} strokeWidth={density === "route" ? "2.2" : "1.2"} opacity={density === "route" ? "0.72" : "0.36"} />
              <path d={region.d} fill="none" stroke="rgba(226,232,240,0.22)" strokeWidth="0.8" strokeDasharray={density === "route" ? "9 14" : "4 14"} opacity={density === "route" ? "0.34" : "0.24"} />
            </g>
          ))}
          <g opacity={chrome === "minimal" ? "0.18" : density === "route" ? "0.36" : "0.36"}>
            {TERRAIN_LINES.map((path, index) => (
              <path
                key={`terrain-${index}`}
                d={path}
                fill="none"
                stroke={index % 2 === 0 ? "rgba(103,232,249,0.3)" : "rgba(45,212,191,0.24)"}
                strokeWidth="0.9"
                strokeLinecap="round"
                strokeDasharray={index % 2 === 0 ? "2 10" : "1 8"}
              />
            ))}
          </g>
        </g>
        ) : null}

        {!mapTiles.length ? <g opacity={density === "route" ? "0.48" : chrome === "minimal" ? "0.18" : "0.28"}>
          {ATLAS_LABELS.map((item) => (
            <text
              key={item.label}
              x={item.x}
              y={item.y}
              fill={atlasLabelFill}
              fontSize="15"
              fontWeight="900"
              letterSpacing="4"
              opacity={isLightTheme ? "0.44" : "0.58"}
              paintOrder="stroke"
              stroke={atlasHaloColor}
              strokeWidth="5"
            >
              {item.label}
            </text>
          ))}
        </g> : null}

        {!mapTiles.length ? <g opacity={density === "route" ? "0.72" : "0.22"}>
          {MAP_PLACE_LABELS.map((item) => {
            const dot = project(item.lat, item.lng);
            const isCity = item.tone === "city";
            return (
              <text
                key={`place-label-${item.label}`}
                x={dot.x}
                y={dot.y}
                textAnchor="middle"
                fill={isCity ? labelTextFill : atlasLabelFill}
                fontSize={isCity ? "13" : "16"}
                fontWeight={isCity ? "850" : "950"}
                letterSpacing={isCity ? "1.6" : "4.2"}
                opacity={isLightTheme ? (isCity ? "0.58" : "0.32") : (isCity ? "0.68" : "0.38")}
                paintOrder="stroke"
                stroke={labelHaloColor}
                strokeWidth={isCity ? "4" : "5"}
              >
                {item.label}
              </text>
            );
          })}
        </g> : null}

        {mapTiles.length ? (
          <text
            x={WIDTH - 24}
            y={HEIGHT - 16}
            textAnchor="end"
            fill={labelMutedFill}
            fontSize="10"
            fontWeight="700"
            opacity="0.72"
            paintOrder="stroke"
            stroke={labelHaloColor}
            strokeWidth="3"
          >
            {trustMapSource.attribution}
          </text>
        ) : null}

        <g opacity={chrome === "minimal" ? "0.03" : density === "route" ? "0.08" : "0.42"}>
          {CITY_LIGHTS.map((light, index) => {
            const dot = project(light.lat, light.lng);
            return (
              <circle
                key={`city-light-${index}`}
                cx={dot.x}
                cy={dot.y}
                r="3.2"
                fill="#dff9ff"
                opacity={light.opacity}
                filter={`url(#${idPrefix}-soft-glow)`}
              />
            );
          })}
        </g>

        <g opacity={density === "route" ? "0.95" : "0.76"}>
          {visiblePoints.map((point) => {
            const dot = project(point.lat, point.lng);
            const tone = toneFor(point);
            const normalized = Math.max(0.18, Math.min(1, (point.scans || 1) / maxScan));
            const radius = density === "heat" ? 26 + normalized * 38 : 12 + normalized * 13;
            const color = pointColor(tone);
            return density === "route" ? (
              <g key={`signal-${point.id}`}>
                <circle cx={dot.x} cy={dot.y} r={radius} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 8" opacity={tone === "risk" ? "0.32" : "0.14"} />
                <circle cx={dot.x} cy={dot.y} r={Math.max(7, radius * 0.32)} fill={heatColor(tone)} opacity={tone === "risk" ? "0.14" : "0.055"} />
              </g>
            ) : (
              <circle
                key={`heat-${point.id}`}
                cx={dot.x}
                cy={dot.y}
                r={radius}
                fill={heatColor(tone)}
                opacity={tone === "risk" ? "0.36" : "0.22"}
              />
            );
          })}
        </g>

        <g>
          {visibleRoutes.map((route, index) => {
            const d = routePath(route);
            const color = routeColor(route.tone);
            const speed = route.tone === "warn" ? "2.1s" : "3.2s";
            const from = project(route.fromLat, route.fromLng);
            const to = project(route.toLat, route.toLng);
            const labelX = (from.x + to.x) / 2;
            const labelY = Math.min(from.y, to.y) - 28;
            const label = route.distanceLabel || route.label;
            return (
              <g key={route.id}>
                <path d={d} fill="none" stroke={routeHaloColor} strokeWidth={route.tone === "warn" ? "12" : "10"} strokeLinecap="round" opacity={routeHaloOpacity} />
                <path d={d} fill="none" stroke={color} strokeWidth={route.tone === "warn" ? "4.6" : "3.8"} strokeLinecap="round" opacity="0.16" filter={`url(#${idPrefix}-soft-glow)`} />
                <path d={d} fill="none" stroke={color} strokeWidth={route.tone === "warn" ? "2.8" : "2.2"} strokeLinecap="round" strokeDasharray="10 14" opacity="0.94" filter={`url(#${idPrefix}-soft-glow)`}>
                  <animate attributeName="stroke-dashoffset" values="0;-72" dur={speed} repeatCount="indefinite" />
                </path>
                <circle r={route.tone === "warn" ? "4.5" : "3.6"} fill={color} opacity={index > 9 ? "0.4" : "0.82"}>
                  <animateMotion dur={route.tone === "warn" ? "4.2s" : "5.5s"} repeatCount="indefinite" path={d} />
                </circle>
                {label && chrome !== "minimal" ? (
                  <g transform={`translate(${labelX.toFixed(1)} ${labelY.toFixed(1)})`} opacity={index > 6 ? "0.68" : "0.92"}>
                    <rect x="-58" y="-14" width="116" height="27" rx="13.5" fill={labelPanelFill} stroke={color} strokeOpacity={labelPanelStrokeOpacity} />
                    <text x="0" y="4" textAnchor="middle" fill={labelTextFill} fontSize="12" fontWeight="850" letterSpacing="1.4" paintOrder="stroke" stroke={labelHaloColor} strokeWidth="2">
                      {label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>

        <g>
          {visiblePoints.map((point) => {
            const dot = project(point.lat, point.lng);
            const tone = toneFor(point);
            const color = pointColor(tone);
            const selected = selectedPoint?.id === point.id;
            const radius = selected ? 10 : tone === "origin" || tone === "tap" ? 8 : 6.2;
            const shouldLabel = chrome !== "minimal" && !isTightRouteView && (selected || tone === "origin" || tone === "tap" || tone === "risk");
            return (
              <g
                key={`point-${point.id}`}
                role={onPointSelect ? "button" : undefined}
                tabIndex={onPointSelect ? 0 : undefined}
                aria-label={`${point.label}${point.sublabel ? `, ${point.sublabel}` : ""}`}
                onClick={() => onPointSelect?.(point)}
                onKeyDown={(event) => handlePointKey(event, point)}
                style={{ cursor: onPointSelect ? "pointer" : "default" }}
              >
                <circle cx={dot.x} cy={dot.y} r={radius + 10} fill="none" stroke={color} strokeWidth="2" opacity={selected ? "0.58" : "0.28"}>
                  <animate attributeName="r" values={`${radius + 5};${radius + 18};${radius + 5}`} dur={selected ? "2.1s" : "3.4s"} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.75;0.12;0.75" dur={selected ? "2.1s" : "3.4s"} repeatCount="indefinite" />
                </circle>
                <circle cx={dot.x} cy={dot.y} r={radius + 3} fill={pointCenterFill} stroke={color} strokeWidth="1.2" />
                <circle cx={dot.x} cy={dot.y} r={radius} fill={color} stroke="#f8fafc" strokeWidth={selected ? "3" : "2"} filter={`url(#${idPrefix}-soft-glow)`} />
                
                {/* Radar Crosshair for Selected Point */}
                {selected && (
                  <g transform={`translate(${dot.x} ${dot.y})`} className="pointer-events-none">
                    {/* Rotating outer radar crosshair */}
                    <circle r={radius + 15} fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="3 4" opacity="0.8">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Tick lines */}
                    <line x1={-(radius + 20)} y1="0" x2={-(radius + 11)} y2="0" stroke={color} strokeWidth="1" opacity="0.85" />
                    <line x1={radius + 11} y1="0" x2={radius + 20} y2="0" stroke={color} strokeWidth="1" opacity="0.85" />
                    <line x1="0" y1={-(radius + 20)} x2="0" y2={-(radius + 11)} stroke={color} strokeWidth="1" opacity="0.85" />
                    <line x1="0" y1={radius + 11} x2="0" y2={radius + 20} stroke={color} strokeWidth="1" opacity="0.85" />
                  </g>
                )}

                {shouldLabel ? (
                  <g transform={`translate(${dot.x + 16} ${dot.y - 18})`}>
                    <rect x="0" y="-18" width={Math.max(70, Math.min(155, point.label.length * 8 + 24))} height="28" rx="14" fill={labelPanelFill} stroke={color} strokeOpacity={labelPanelStrokeOpacity} />
                    <text x="12" y="1" fill={labelTextFill} fontSize={selected ? "13" : "12"} fontWeight="850" paintOrder="stroke" stroke={labelHaloColor} strokeWidth="2">
                      {point.label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {chrome !== "minimal" ? (
        <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
          <div className="rounded-xl border border-white/10 bg-slate-950/76 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur-md">
            <p className="font-black uppercase tracking-[0.14em] text-cyan-200">{title}</p>
            <p className="mt-0.5 max-w-[28rem] text-[11px] text-slate-300">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-500/12 px-2 py-1 text-cyan-100">{visiblePoints.length} puntos</span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/12 px-2 py-1 text-emerald-100">{routeCount} rutas</span>
            <span className="rounded-full border border-rose-300/25 bg-rose-500/12 px-2 py-1 text-rose-100">{riskCount} riesgo</span>
            {tokenCount ? <span className="rounded-full border border-violet-300/25 bg-violet-500/12 px-2 py-1 text-violet-100">{tokenCount} NFT</span> : null}
            <span className="rounded-full border border-violet-300/25 bg-violet-500/12 px-2 py-1 text-violet-100">{trustMapSource.badge}</span>
          </div>
        </div>
      ) : null}

      {chrome === "full" || (chrome === "compact" && mapStorySteps.length) ? (
        <div className={[
          "absolute bottom-3 left-3 right-3 z-10 grid gap-2 md:items-end",
          chrome === "full" ? "md:grid-cols-[minmax(0,1fr)_minmax(16rem,.9fr)_auto]" : "hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,.9fr)]",
        ].join(" ")}>
          <div className="rounded-xl border border-white/10 bg-slate-950/78 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur-md">
            <p className="font-semibold text-white">{selectedPoint ? `${selectedPoint.label}${selectedPoint.sublabel ? `, ${selectedPoint.sublabel}` : ""}` : "Sin punto seleccionado"}</p>
            <p className="mt-0.5 text-[11px] text-slate-300">
              {caption || "Mapa propio para trazabilidad, actividad y rutas de confianza."}
            </p>
          </div>
          {mapStorySteps.length ? (
            <div className="grid gap-1.5 rounded-xl border border-white/10 bg-slate-950/72 p-2 shadow-xl backdrop-blur-md sm:grid-cols-2">
              {mapStorySteps.map((step) => (
                <div key={step.id} className="min-w-0 rounded-lg border px-2 py-1.5 text-[10px]" style={evidenceStyle(step.tone)}>
                  <p className="truncate font-black uppercase tracking-[0.12em] opacity-75">{step.label}</p>
                  <p className="truncate text-[12px] font-semibold text-white">{step.value}</p>
                  {step.detail ? <p className="line-clamp-2 text-[10px] opacity-80">{step.detail}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {chrome === "full" ? (
            <div className="rounded-xl border border-cyan-300/18 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold text-cyan-100 shadow-xl backdrop-blur-md">
              <p>{formatMetric(totalEvents)} eventos</p>
              {mapLedgerItems.map((item) => (
                <p key={item.id} className="mt-1 max-w-[10rem] truncate text-[10px] font-semibold opacity-85" style={{ color: evidenceStyle(item.tone).color }}>
                  {item.label}: {item.value}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
