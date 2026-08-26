"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { RealGeographicMap } from "./real-geographic-map";
import type { VectorMapPoint, VectorMapRoute } from "./premium-vector-map";

function determinantAffineShim(this: { determinant?: () => number }) {
  return typeof this?.determinant === "function" ? this.determinant() : 1;
}

function patchMatrixPrototype(matrix4Prototype?: Record<string, unknown>) {
  if (!matrix4Prototype || typeof matrix4Prototype.determinantAffine === "function") return;

  try {
    Object.defineProperty(matrix4Prototype, "determinantAffine", {
      configurable: true,
      value: determinantAffineShim,
    });
  } catch {
    matrix4Prototype.determinantAffine = determinantAffineShim;
  }
}

function patchMatrixInstance(matrix?: unknown) {
  if (!matrix || typeof matrix !== "object") return;

  patchMatrixPrototype(Object.getPrototypeOf(matrix) as Record<string, unknown> | undefined);

  const matrixRecord = matrix as Record<string, unknown>;
  if (typeof matrixRecord.determinantAffine === "function") return;

  try {
    Object.defineProperty(matrixRecord, "determinantAffine", {
      configurable: true,
      value: determinantAffineShim,
    });
  } catch {
    matrixRecord.determinantAffine = determinantAffineShim;
  }
}

function ensureThreeRendererCompatibility() {
  patchMatrixPrototype((THREE.Matrix4 as unknown as { prototype?: Record<string, unknown> }).prototype);

  const globalScope = globalThis as typeof globalThis & { THREE?: typeof THREE };
  patchMatrixPrototype((globalScope.THREE?.Matrix4 as unknown as { prototype?: Record<string, unknown> } | undefined)?.prototype);
  globalScope.THREE = THREE;

  if (typeof window !== "undefined") {
    const win = window as typeof window & { THREE?: typeof THREE };
    patchMatrixPrototype((win.THREE?.Matrix4 as unknown as { prototype?: Record<string, unknown> } | undefined)?.prototype);
    win.THREE = THREE;
  }
}

ensureThreeRendererCompatibility();

const Globe = dynamic(async () => {
  ensureThreeRendererCompatibility();
  const module = await import("react-globe.gl");
  return module.default;
}, { ssr: false });

class GlobeRuntimeBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const COUNTRY_GEOJSON_URL = "/assets/geo/ne_110m_admin_0_countries.geojson";
const THREE_GLOBE_ASSET_BASE = "https://cdn.jsdelivr.net/npm/three-globe/example/img";
const PROFESSIONAL_GLOBE_IMAGE_URL = `${THREE_GLOBE_ASSET_BASE}/earth-blue-marble.jpg`;
const PROFESSIONAL_GLOBE_BUMP_URL = `${THREE_GLOBE_ASSET_BASE}/earth-topology.png`;
const PROFESSIONAL_GLOBE_BACKGROUND_URL = `${THREE_GLOBE_ASSET_BASE}/night-sky.png`;
const CITY_COUNTRY_HINTS: Record<string, string> = {
  mendoza: "Argentina",
  "san martin": "Argentina",
  cordoba: "Argentina",
  rosario: "Argentina",
  "buenos aires": "Argentina",
  zurich: "Switzerland",
  miami: "United States of America",
  "sao paulo": "Brazil",
  "san pablo": "Brazil",
  london: "United Kingdom",
  paris: "France",
  madrid: "Spain",
  shanghai: "China",
};

const COUNTRY_ALIASES: Record<string, string> = {
  argentina: "Argentina",
  ar: "Argentina",
  brasil: "Brazil",
  brazil: "Brazil",
  br: "Brazil",
  chile: "Chile",
  cl: "Chile",
  china: "China",
  cn: "China",
  espana: "Spain",
  españa: "Spain",
  es: "Spain",
  france: "France",
  francia: "France",
  fr: "France",
  reino_unido: "United Kingdom",
  "reino unido": "United Kingdom",
  spain: "Spain",
  suiza: "Switzerland",
  switzerland: "Switzerland",
  ch: "Switzerland",
  usa: "United States of America",
  us: "United States of America",
  "united states": "United States of America",
  "united states of america": "United States of America",
  "estados unidos": "United States of America",
  gb: "United Kingdom",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
};

const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
  Argentina: "Argentina",
  Brazil: "Brasil",
  Chile: "Chile",
  China: "China",
  France: "Francia",
  Spain: "España",
  Switzerland: "Suiza",
  "United Kingdom": "Reino Unido",
  "United States of America": "Estados Unidos",
};

const CONTINENT_DISPLAY_NAMES: Record<string, string> = {
  Africa: "África",
  Asia: "Asia",
  Europe: "Europa",
  "North America": "Norteamérica",
  Oceania: "Oceanía",
  "South America": "Sudamérica",
};

export type GlobePoint = {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  scans?: number;
  risk?: number;
  status?: string;
  vertical?: string;
};

export type GlobeRoute = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  label?: string;
  tone?: "info" | "warn" | "success";
};

type CountryFeature = {
  type: string;
  properties?: {
    ADMIN?: string;
    NAME?: string;
    CONTINENT?: string;
  };
  geometry?: unknown;
};

type GlobeHoverCard = {
  eyebrow: string;
  title: string;
  subtitle: string;
  meta: string;
  tone: string;
};

type GlobeRenderMode = "auto" | "globe" | "preview";

type GlobeRoutePathPoint = {
  lat: number;
  lng: number;
  altitude: number;
  color: string;
};

type GlobeRoutePath = {
  label: string;
  tone: NonNullable<GlobeRoute["tone"]>;
  color: string;
  distance: string;
  coords: GlobeRoutePathPoint[];
};

type GlobeHeatmapLayer = {
  id: string;
  points: GlobePoint[];
};

type GlobeHtmlMarker = GlobePoint & {
  id: string;
  rank: number;
  toneColor: string;
  countryLabel: string;
  markerKind: "origen" | "tap" | "riesgo" | "pasaporte" | "hotspot";
};

function rgbaFromHex(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

function pointWeight(point: GlobePoint) {
  return Math.max(1, Math.min(16, 1 + Math.log10(Math.max(1, point.scans || 1)) * 5));
}

function hexHeatColor(weight: number, alpha = 0.88) {
  if (weight >= 13) return `rgba(109, 40, 217, ${alpha})`;
  if (weight >= 8) return `rgba(37, 99, 235, ${alpha})`;
  if (weight >= 3) return `rgba(15, 118, 110, ${alpha})`;
  return `rgba(34, 211, 238, ${alpha})`;
}

function normalizeCountryName(value?: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function canonicalCountryName(value?: string) {
  const normalized = normalizeCountryName(value);
  if (!normalized) return "";
  return COUNTRY_ALIASES[normalized] || value || "";
}

function displayCountryName(value?: string) {
  const canonical = canonicalCountryName(value);
  return COUNTRY_DISPLAY_NAMES[canonical] || value || "";
}

function displayContinentName(value?: string) {
  if (!value) return "Cobertura global";
  return CONTINENT_DISPLAY_NAMES[value] || value;
}

function inferCountryName(point: GlobePoint) {
  if (point.country) return canonicalCountryName(point.country);

  const city = normalizeCountryName(point.city);
  const matchedCity = Object.keys(CITY_COUNTRY_HINTS).find((key) => city.includes(key));
  return matchedCity ? canonicalCountryName(CITY_COUNTRY_HINTS[matchedCity]) : "";
}

function featureCountryName(feature: CountryFeature) {
  return feature.properties?.ADMIN || feature.properties?.NAME || "";
}

function formatKm(value: number) {
  if (!Number.isFinite(value)) return "";
  return `${Math.round(value).toLocaleString("es-AR")} km`;
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function closestPoint(points: GlobePoint[], lat: number, lng: number) {
  return points.reduce<{ point: GlobePoint | null; distance: number }>(
    (best, point) => {
      const distance = Math.hypot(point.lat - lat, point.lng - lng);
      return distance < best.distance ? { point, distance } : best;
    },
    { point: null, distance: Number.POSITIVE_INFINITY },
  ).point;
}

function routeTitle(route: GlobeRoute, points: GlobePoint[]) {
  if (route.label) return route.label;
  const from = closestPoint(points, route.fromLat, route.fromLng);
  const to = closestPoint(points, route.toLat, route.toLng);
  if (from && to) return `${from.city} → ${to.city}`;
  return "Conexión reportada";
}

function routeMeta(route: GlobeRoute, points: GlobePoint[]) {
  const from = closestPoint(points, route.fromLat, route.fromLng);
  const to = closestPoint(points, route.toLat, route.toLng);
  const distance = haversineKm(route.fromLat, route.fromLng, route.toLat, route.toLng);
  const fromCountry = displayCountryName(inferCountryName(from || ({ city: "", lat: 0, lng: 0 } as GlobePoint)));
  const toCountry = displayCountryName(inferCountryName(to || ({ city: "", lat: 0, lng: 0 } as GlobePoint)));
  if (from && to) return `${from.city}, ${fromCountry} → ${to.city}, ${toCountry} · ${formatKm(distance)}`;
  return `Origen y destino reportados - ${formatKm(distance)}`;
}

function routeDistanceLabel(route?: GlobeRoute) {
  if (!route) return "";
  return formatKm(haversineKm(route.fromLat, route.fromLng, route.toLat, route.toLng));
}

function routeTone(route?: GlobeRoute): NonNullable<GlobeRoute["tone"]> {
  return route?.tone || "info";
}

function routeColor(route?: GlobeRoute) {
  const tone = routeTone(route);
  if (tone === "warn") return "#fb7185";
  if (tone === "success") return "#34d399";
  return "#22d3ee";
}

function toCartesian(lat: number, lng: number) {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.cos(lngRad),
    y: Math.sin(latRad),
    z: cosLat * Math.sin(lngRad),
  };
}

function toLatLng(point: { x: number; y: number; z: number }) {
  const hyp = Math.sqrt(point.x * point.x + point.z * point.z);
  return {
    lat: (Math.atan2(point.y, hyp) * 180) / Math.PI,
    lng: (Math.atan2(point.z, point.x) * 180) / Math.PI,
  };
}

function interpolateGreatCircle(fromLat: number, fromLng: number, toLat: number, toLng: number, t: number) {
  const from = toCartesian(fromLat, fromLng);
  const to = toCartesian(toLat, toLng);
  const dot = Math.max(-1, Math.min(1, from.x * to.x + from.y * to.y + from.z * to.z));
  const omega = Math.acos(dot);

  if (omega < 0.0001) {
    return {
      lat: fromLat + (toLat - fromLat) * t,
      lng: fromLng + (toLng - fromLng) * t,
    };
  }

  const sinOmega = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / sinOmega;
  const b = Math.sin(t * omega) / sinOmega;
  return toLatLng({
    x: a * from.x + b * to.x,
    y: a * from.y + b * to.y,
    z: a * from.z + b * to.z,
  });
}

function buildRoutePath(route: GlobeRoute, points: GlobePoint[], compactHud: boolean): GlobeRoutePath {
  const color = routeColor(route);
  const steps: number = compactHud ? 22 : 34;
  const coords = Array.from({ length: steps }, (_, index) => {
    const t = steps === 1 ? 0 : index / (steps - 1);
    const position = interpolateGreatCircle(route.fromLat, route.fromLng, route.toLat, route.toLng, t);
    const peak = Math.sin(Math.PI * t);
    return {
      ...position,
      altitude: (compactHud ? 0.014 : 0.018) + peak * (compactHud ? 0.048 : 0.075),
      color,
    };
  });

  return {
    label: routeTitle(route, points),
    tone: routeTone(route),
    color,
    distance: routeDistanceLabel(route),
    coords,
  };
}

function markerKind(point: GlobePoint): GlobeHtmlMarker["markerKind"] {
  if (point.risk || point.status === "risk") return "riesgo";
  if (point.status === "origin") return "origen";
  if (point.status === "passport") return "pasaporte";
  return (point.scans || 0) > 500 ? "hotspot" : "tap";
}

function makeGlobeMarkerElement(marker: GlobeHtmlMarker, compactHud: boolean) {
  const el = document.createElement("div");
  const size = compactHud ? "10px" : "11px";
  const labelSize = compactHud ? "10px" : "11px";
  const titleSize = compactHud ? "12px" : "13px";
  el.className = "nexid-globe-marker";
  el.style.cssText = [
    "pointer-events:none",
    "transform:translate(-50%,-112%)",
    "transition:opacity 220ms ease, transform 220ms ease",
    `--nexid-marker-tone:${marker.toneColor}`,
  ].join(";");
  el.innerHTML = `
    <span style="
      display:inline-flex;align-items:center;gap:6px;
      border:1px solid ${rgbaFromHex(marker.toneColor, 0.48)};
      border-radius:999px;
      background:linear-gradient(135deg,rgba(2,6,23,.88),rgba(8,47,73,.74));
      box-shadow:0 12px 34px rgba(0,0,0,.38),0 0 22px ${rgbaFromHex(marker.toneColor, 0.24)};
      color:#e0f2fe;
      padding:${compactHud ? "5px 7px" : "6px 9px"};
      backdrop-filter:blur(14px);
      white-space:nowrap;
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <i style="width:${size};height:${size};border-radius:999px;background:${marker.toneColor};box-shadow:0 0 14px ${marker.toneColor};display:inline-block;flex:0 0 auto;"></i>
      <b style="display:grid;gap:1px;text-align:left;line-height:1;">
        <small style="color:${marker.toneColor};font-size:${labelSize};font-weight:950;letter-spacing:.14em;text-transform:uppercase;">${marker.markerKind}</small>
        <strong style="color:#fff;font-size:${titleSize};font-weight:950;letter-spacing:0;">${marker.city}</strong>
        <em style="color:#bae6fd;font-size:${compactHud ? "9px" : "10px"};font-style:normal;font-weight:750;">${marker.countryLabel || `${marker.scans || 1} taps`}</em>
      </b>
    </span>
  `;
  return el;
}

function GlobeLoadingBackdrop({
  isLightTheme,
  className = "",
}: {
  isLightTheme: boolean;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 z-0 overflow-hidden rounded-2xl transition-opacity duration-500 ${className}`}
      aria-hidden="true"
    >
      <div
        className={`absolute inset-0 ${
          isLightTheme
            ? "bg-[radial-gradient(circle_at_45%_36%,rgba(14,165,233,.18),transparent_34%),linear-gradient(135deg,rgba(224,242,254,.78),rgba(248,250,252,.72))]"
            : "bg-[radial-gradient(circle_at_44%_34%,rgba(34,211,238,.18),transparent_34%),radial-gradient(circle_at_68%_70%,rgba(52,211,153,.1),transparent_30%),linear-gradient(135deg,rgba(2,6,23,.72),rgba(8,47,73,.48))]"
        }`}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(125,211,252,.07)_1px,transparent_1px),linear-gradient(rgba(125,211,252,.07)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-55" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/18 bg-cyan-300/5 blur-2xl" />
    </div>
  );
}

function pointTone(point: GlobePoint) {
  if (point.risk || point.status === "risk") return "#fb7185";
  if (point.status === "origin") return "#34d399";
  if (point.status === "passport") return "#a78bfa";
  return "#22d3ee";
}

function finiteNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeGlobePoint(point: GlobePoint): GlobePoint | null {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  return {
    ...point,
    scans: Math.max(0, finiteNumber(point.scans, 0)),
    risk: Math.max(0, finiteNumber(point.risk, 0)),
  };
}

function sanitizeGlobeRoute(route: GlobeRoute): GlobeRoute | null {
  if (
    !Number.isFinite(route.fromLat) ||
    !Number.isFinite(route.fromLng) ||
    !Number.isFinite(route.toLat) ||
    !Number.isFinite(route.toLng)
  ) {
    return null;
  }
  return route;
}

function MapLibreGlobeFallback({
  points,
  routes,
  className = "",
}: {
  points: GlobePoint[];
  routes: GlobeRoute[];
  className?: string;
}) {
  const mapPoints = points.map<VectorMapPoint>((point, index) => ({
    id: `globe-fallback-${point.city}-${point.lat.toFixed(4)}-${point.lng.toFixed(4)}-${index}`,
    label: point.city,
    sublabel: point.country,
    lat: point.lat,
    lng: point.lng,
    scans: Math.max(0, point.scans || 0),
    risk: Math.max(0, point.risk || 0),
    tone: point.risk || point.status === "risk" ? "risk" : index === 0 ? "origin" : "hub",
    evidence: point.vertical || "Ubicacion reportada",
  }));
  const mapRoutes = routes.map<VectorMapRoute>((route, index) => ({
    id: `globe-fallback-route-${index}`,
    fromLat: route.fromLat,
    fromLng: route.fromLng,
    toLat: route.toLat,
    toLng: route.toLng,
    label: route.label || "Relacion reportada",
    tone: route.tone,
    evidence: "Relacion declarada; no prueba un recorrido fisico",
  }));

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden rounded-2xl ${className}`} data-globe-fallback="maplibre">
      <RealGeographicMap
        points={mapPoints}
        routes={mapRoutes}
        density="route"
        chrome="minimal"
        title="Mapa geografico alternativo"
        subtitle="Ubicaciones y relaciones reportadas"
        caption="MapLibre con cartografia real. Las lineas muestran relaciones declaradas, no recorridos fisicos."
        className="h-full rounded-none border-0 shadow-none"
        heightClassName="h-full"
        ariaLabel="Mapa geografico alternativo con ubicaciones reportadas"
      />
    </div>
  );
}

export function Globe3dMap({
  points = [],
  routes = [],
  width = 600,
  height = 500,
  className = "",
  offset = [0, 0],
  theme = "auto",
  mode = "auto",
}: {
  points?: GlobePoint[];
  routes?: GlobeRoute[];
  width?: number;
  height?: number;
  className?: string;
  offset?: [number, number];
  theme?: "light" | "dark" | "auto";
  mode?: GlobeRenderMode;
}) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [containerWidth, setContainerWidth] = useState(width);
  const [globeReady, setGlobeReady] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [hasRenderedCanvas, setHasRenderedCanvas] = useState(false);
  const globeReadyRef = useRef(false);
  const [countryPolygons, setCountryPolygons] = useState<CountryFeature[]>([]);
  const [hoverCard, setHoverCard] = useState<GlobeHoverCard | null>(null);
  const finitePoints = useMemo(
    () => points.map(sanitizeGlobePoint).filter((point): point is GlobePoint => Boolean(point)),
    [points],
  );
  const finiteRoutes = useMemo(
    () => routes.map(sanitizeGlobeRoute).filter((route): route is GlobeRoute => Boolean(route)),
    [routes],
  );

  useEffect(() => {
    setMounted(true);
    ensureThreeRendererCompatibility();
    
    if (theme !== "auto") {
      setIsLightTheme(theme === "light");
      return;
    }

    // Theme synchronization
    const root = document.documentElement;
    const syncTheme = () => {
      const explicitTheme = root.getAttribute("data-theme") || root.getAttribute("data-nexid-theme");
      setIsLightTheme(root.classList.contains("theme-light") || explicitTheme === "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme", "data-nexid-theme"] });
    return () => observer.disconnect();
  }, [theme]);

  const handleGlobeRuntimeError = useCallback((_error?: Error) => {
    ensureThreeRendererCompatibility();
    const hasCanvas = Boolean(containerRef.current?.querySelector("canvas"));
    if (hasCanvas) {
      globeReadyRef.current = true;
      setHasRenderedCanvas(true);
      setGlobeFailed(false);
      setGlobeReady(true);
      return;
    }
    setGlobeFailed(true);
    setGlobeReady(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const isGlobeRuntimeError = (reason: unknown) => {
      const message =
        reason instanceof Error
          ? `${reason.name} ${reason.message} ${reason.stack || ""}`
          : typeof reason === "string"
            ? reason
            : (() => {
                try {
                  return JSON.stringify(reason);
                } catch {
                  return String(reason);
                }
              })();
      return /determinantAffine|react-globe|three-globe|WebGLRenderer|matrixWorld/i.test(message);
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!isGlobeRuntimeError(event.error || event.message)) return;
      event.preventDefault();
      handleGlobeRuntimeError(event.error instanceof Error ? event.error : undefined);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!isGlobeRuntimeError(event.reason)) return;
      event.preventDefault();
      handleGlobeRuntimeError(event.reason instanceof Error ? event.reason : undefined);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [handleGlobeRuntimeError, mounted]);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const root = containerRef.current;

    const syncRenderedCanvas = () => {
      const nextHasCanvas = Boolean(root.querySelector("canvas"));
      setHasRenderedCanvas((previous) => (previous === nextHasCanvas ? previous : nextHasCanvas));
      if (!nextHasCanvas) return;

      globeReadyRef.current = true;
      setGlobeReady(true);
      setGlobeFailed(false);
    };

    const scrubGlobeNavText = () => {
      const root = containerRef.current;
      if (!root) return;
      const navTextPattern = /(left-click|mouse-wheel|middle-click|right-click|arrastr[aá]|rotar|zoom|pan)/i;

      root.querySelectorAll(".scene-nav-info").forEach((node) => {
        node.textContent = "";
        node.setAttribute("aria-hidden", "true");
        if (node instanceof HTMLElement) node.style.display = "none";
      });

      root.querySelectorAll("div, span").forEach((node) => {
        const text = node.textContent?.trim() || "";
        if (!text || node.children.length > 0 || !navTextPattern.test(text)) return;
        node.textContent = "";
        node.setAttribute("aria-hidden", "true");
        if (node instanceof HTMLElement) node.style.display = "none";
      });
    };

    syncRenderedCanvas();
    scrubGlobeNavText();
    const observer = new MutationObserver(() => {
      syncRenderedCanvas();
      scrubGlobeNavText();
    });
    observer.observe(root, { childList: true, subtree: true });
    const interval = window.setInterval(syncRenderedCanvas, 600);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [mounted]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const syncSize = () => {
      const nextWidth = Math.floor(node.getBoundingClientRect().width || width);
      if (nextWidth > 0) setContainerWidth(Math.max(280, Math.min(width, nextWidth)));
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(node);
    window.addEventListener("resize", syncSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, [width]);

  useEffect(() => {
    if (!mounted || countryPolygons.length > 0) return;

    let cancelled = false;
    fetch(COUNTRY_GEOJSON_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.features)) return;
        setCountryPolygons(
          data.features.filter((feature: CountryFeature) => feature.properties?.CONTINENT !== "Antarctica"),
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mounted, countryPolygons.length]);

  const renderWidth = Math.max(260, Math.min(width, containerWidth || width));
  const compactRequested = height <= 240;
  const mediumRequested = height <= 360;
  const minRenderHeight = compactRequested ? 180 : mediumRequested ? 220 : 300;
  const aspectHeight = Math.round(renderWidth * (height / Math.max(width, 1)));
  const renderHeight = Math.min(height, Math.max(minRenderHeight, aspectHeight));
  const compactHud = renderWidth < 360 || height <= 260 || (height <= 320 && renderWidth < 460);
  const routePreviewOnly = mode === "preview" || (mode === "auto" && (renderWidth < 300 || height <= 190));
  const globeImageUrl = PROFESSIONAL_GLOBE_IMAGE_URL;
  const globeBumpUrl = PROFESSIONAL_GLOBE_BUMP_URL;
  const activeCountryNames = useMemo(
    () => new Set(finitePoints.map((point) => normalizeCountryName(inferCountryName(point))).filter(Boolean)),
    [finitePoints],
  );
  const hexPoints = useMemo(
    () => finitePoints.filter((point) => point.status !== "origin" && Number(point.scans || 0) > 0),
    [finitePoints],
  );
  const ringPoints = useMemo(
    () =>
      finitePoints
        .filter((point) => point.status !== "origin")
        .slice(0, 18)
        .map((point) => ({
          ...point,
          tone: point.risk || point.status === "risk" ? "#fb7185" : point.status === "passport" ? "#a78bfa" : "#22d3ee",
        })),
    [finitePoints],
  );
  const defaultHoverCard = useMemo<GlobeHoverCard>(() => {
    const scans = finitePoints.reduce((sum, point) => sum + (point.scans || 0), 0);
    const regions = new Set(finitePoints.map((point) => inferCountryName(point) || point.city).filter(Boolean)).size;
    return {
      eyebrow: "nexID Global Trust Mesh",
      title: "Red global de producto",
      subtitle: "Pasá el mouse por un país, ciudad, ruta o hotspot.",
      meta: `${points.length} nodos · ${routes.length} rutas · ${scans.toLocaleString("es-AR")} taps · ${regions} regiones`,
      tone: "#22d3ee",
    };
  }, [finitePoints, finiteRoutes, points.length, routes.length]);

  const globeFocus = useMemo(() => {
    if (!finitePoints.length) return { lat: 10, lng: -28, altitude: 2.15 };

    const latMin = Math.min(...finitePoints.map((point) => point.lat));
    const latMax = Math.max(...finitePoints.map((point) => point.lat));
    const lngMin = Math.min(...finitePoints.map((point) => point.lng));
    const lngMax = Math.max(...finitePoints.map((point) => point.lng));
    const lat = (latMin + latMax) / 2;
    const lng = (lngMin + lngMax) / 2;
    const span = Math.max(latMax - latMin, lngMax - lngMin);
    const altitude = span > 96 ? 2.45 : span > 56 ? 2.08 : span > 22 ? 1.68 : 1.34;
    return { lat, lng, altitude };
  }, [finitePoints]);

  const setPointHover = useCallback((point?: GlobePoint | null) => {
    if (!point) {
      setHoverCard(null);
      return;
    }

    const country = displayCountryName(inferCountryName(point));
    const risk = point.risk || point.status === "risk";
    setHoverCard({
      eyebrow: risk ? "Riesgo operativo" : point.status === "origin" ? "Origen declarado" : "Evento NFC reportado",
      title: point.city,
      subtitle: country || "Ubicación reportada",
      meta: `${point.scans || 1} taps${risk ? ` · riesgo ${point.risk || 1}` : ""}${point.vertical ? ` · ${point.vertical}` : ""}`,
      tone: pointTone(point),
    });
  }, []);

  const setCountryHover = useCallback((feature?: CountryFeature | null) => {
    if (!feature) {
      setHoverCard(null);
      return;
    }

    const country = featureCountryName(feature);
    const canonicalCountry = canonicalCountryName(country);
    const normalized = normalizeCountryName(canonicalCountry);
    const activePoints = finitePoints.filter((point) => normalizeCountryName(inferCountryName(point)) === normalized);
    const scans = activePoints.reduce((sum, point) => sum + (point.scans || 0), 0);
    const active = activeCountryNames.has(normalized);

    setHoverCard({
      eyebrow: active ? "País con actividad nexID" : "Capa geográfica",
      title: displayCountryName(canonicalCountry) || "País",
      subtitle: displayContinentName(feature.properties?.CONTINENT),
      meta: active
        ? `${activePoints.length} nodos · ${scans.toLocaleString("es-AR")} eventos NFC reportados`
        : "Sin eventos NFC visibles en la ventana actual",
      tone: active ? "#34d399" : "#67e8f9",
    });
  }, [activeCountryNames, finitePoints]);

  const setRouteHover = useCallback((route?: GlobeRoute | null) => {
    if (!route) {
      setHoverCard(null);
      return;
    }

    setHoverCard({
      eyebrow: route.tone === "warn" ? "Conexión con alerta" : "Conexión de eventos",
      title: route.label || "Conexión reportada",
      subtitle: "Origen declarado, evento NFC y evidencia comercial; no prueba recorrido físico",
      meta: routeMeta(route, finitePoints),
      tone: route.tone === "warn" ? "#fb7185" : route.tone === "success" ? "#34d399" : "#22d3ee",
    });
  }, [finitePoints]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (globe) {
      ensureThreeRendererCompatibility();
      setGlobeFailed(false);
      setGlobeReady(true);
      globe.pointOfView(globeFocus, 900);

      try {
        const scene = (globe as unknown as { scene?: () => { traverse?: (callback: (node: unknown) => void) => void } }).scene?.();
        scene?.traverse?.((node: unknown) => {
          const object3d = node as { matrix?: unknown; matrixWorld?: unknown };
          patchMatrixInstance(object3d.matrix);
          patchMatrixInstance(object3d.matrixWorld);
        });
      } catch {
        // The globe still renders if the scene API is unavailable.
      }

      const controls = globe.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = compactHud ? 0.22 : 0.38;
        controls.enableZoom = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 180;
        controls.maxDistance = 620;
      }
    }
  }, [compactHud, globeFocus]);

  useEffect(() => {
    globeReadyRef.current = globeReady;
  }, [globeReady]);

  useEffect(() => {
    if (!globeReady || !globeRef.current || routePreviewOnly) return;
    globeRef.current.pointOfView(globeFocus, 1100);
  }, [globeFocus, globeReady, routePreviewOnly]);

  // react-globe.gl can initialize the ref before onGlobeReady fires on fast cached loads.
  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    let attempts = 0;

    const syncGlobe = () => {
      if (cancelled) return;

      if (globeRef.current) {
        handleGlobeReady();
        return;
      }

      if (attempts < 32) {
        attempts += 1;
        window.setTimeout(syncGlobe, 120);
      }
    };

    const timer = window.setTimeout(syncGlobe, 80);
    const failTimer = window.setTimeout(() => {
      const hasVisibleCanvas = Boolean(containerRef.current?.querySelector("canvas"));
      if (cancelled || globeReadyRef.current || hasVisibleCanvas) return;
      setGlobeFailed(true);
      setGlobeReady(true);
    }, 9000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(failTimer);
    };
  }, [mounted, isLightTheme, offset[0], offset[1], handleGlobeReady]);

  // Prevent overlapping labels by deduplicating by city and adjusting coordinates slightly
  const labelPoints = useMemo(() => {
    const unique: Record<string, GlobePoint> = {};
    finitePoints.forEach((p) => {
      if (p.city) {
        unique[p.city] = { ...p };
      }
    });
    const list = Object.values(unique);

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const pi = list[i];
        const pj = list[j];
        const dLat = pi.lat - pj.lat;
        const dLng = pi.lng - pj.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < 6.0) {
          if (pi.lat >= pj.lat) {
            pi.lat += 2.2;
            pj.lat -= 2.2;
          } else {
            pi.lat -= 2.2;
            pj.lat += 2.2;
          }
          pi.lng -= 1.8;
          pj.lng += 1.8;
        }
      }
    }
    return list;
  }, [finitePoints]);

  const visibleLabelPoints = useMemo(() => {
    const labelLimit = compactHud ? 3 : 9;
    return [...labelPoints]
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      .sort((left, right) => (right.scans || 1) - (left.scans || 1))
      .slice(0, labelLimit);
  }, [compactHud, labelPoints]);

  const primaryRoute = finiteRoutes[0];
  const primaryFrom = primaryRoute ? closestPoint(finitePoints, primaryRoute.fromLat, primaryRoute.fromLng) : null;
  const primaryTo = primaryRoute ? closestPoint(finitePoints, primaryRoute.toLat, primaryRoute.toLng) : null;
  const primaryDistance = routeDistanceLabel(primaryRoute);
  const totalScans = finitePoints.reduce((sum, point) => sum + (point.scans || 0), 0);
  const routeCaption = primaryRoute
    ? `${primaryFrom?.city || "Origen"} → ${primaryTo?.city || "Destino"}`
    : `${finitePoints.length.toLocaleString("es-AR")} nodos activos`;
  const routePaths = useMemo(
    () =>
      finiteRoutes
        .slice(0, compactHud ? 7 : 14)
        .map((route) => buildRoutePath(route, finitePoints, compactHud)),
    [compactHud, finitePoints, finiteRoutes],
  );
  const routeParticles = useMemo(
    () =>
      routePaths.map((route, index) => ({
        id: `${route.label}-${index}`,
        label: route.label,
        color: route.color,
        particles: route.coords
          .filter((_, pointIndex) => pointIndex % (compactHud ? 4 : 5) === 0)
          .map((point, pointIndex) => ({
            ...point,
            color: route.color,
            size: pointIndex === 0 || pointIndex === route.coords.length - 1 ? 0.7 : 1,
          })),
      })),
    [compactHud, routePaths],
  );
  const heatmapLayers = useMemo<GlobeHeatmapLayer[]>(
    () => (hexPoints.length ? [{ id: "tap-density", points: hexPoints }] : []),
    [hexPoints],
  );
  const htmlMarkers = useMemo<GlobeHtmlMarker[]>(() => {
    const seen = new Set<string>();
    const candidates = [primaryFrom, primaryTo, ...visibleLabelPoints].filter(Boolean) as GlobePoint[];

    return candidates
      .filter((point) => {
        const key = `${point.city}-${point.lat.toFixed(3)}-${point.lng.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return Number.isFinite(point.lat) && Number.isFinite(point.lng);
      })
      .sort((left, right) => (right.scans || 1) - (left.scans || 1))
      .slice(0, compactHud ? 4 : 8)
      .map((point, index) => ({
        ...point,
        id: `${point.city}-${index}`,
        rank: index + 1,
        toneColor: pointTone(point),
        countryLabel: displayCountryName(inferCountryName(point)),
        markerKind: markerKind(point),
      }));
  }, [compactHud, primaryFrom, primaryTo, visibleLabelPoints]);

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className={`relative flex items-center justify-center overflow-hidden bg-black/10 rounded-2xl border border-white/5 shadow-2xl p-0 ${className}`}
        style={{ width: "100%", maxWidth: width, height: renderHeight }}
      >
        <GlobeLoadingBackdrop isLightTheme={isLightTheme} />
        <div className="relative z-10 rounded-full border border-cyan-200/20 bg-slate-950/70 px-3 py-1 text-xs text-slate-200 font-mono animate-pulse">
          Cargando globo 3D...
        </div>
      </div>
    );
  }

  if (routePreviewOnly) {
    return (
      <div
        ref={containerRef}
        className={`relative select-none flex items-center justify-center overflow-hidden rounded-2xl border border-cyan-200/10 bg-slate-950/40 shadow-2xl p-0 pointer-events-auto ${className}`}
        style={{ width: "100%", maxWidth: width, height: renderHeight }}
        data-globe-ready="route-preview"
        data-globe-mode="route-preview"
      >
        <GlobeLoadingBackdrop isLightTheme={isLightTheme} className="opacity-100" />
        <div className="relative z-20 mx-4 max-w-[22rem] rounded-2xl border border-cyan-200/18 bg-slate-950/74 px-4 py-3 text-left text-slate-100 shadow-[0_18px_54px_rgba(0,0,0,.34)] backdrop-blur-xl">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-cyan-200">Conexión reportada</p>
          <strong className="mt-1 block text-base font-black leading-tight text-white">{routeCaption}</strong>
          <span className="mt-1 block text-xs font-bold text-slate-300">
            {primaryDistance || `${finiteRoutes.length.toLocaleString("es-AR")} conexiones`} - vista compacta
          </span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/74 px-3 py-2 text-[0.68rem] font-bold text-slate-200 shadow-[0_14px_40px_rgba(0,0,0,.24)] backdrop-blur-xl">
          <span className="text-cyan-100">{finitePoints.length.toLocaleString("es-AR")} nodos · {finiteRoutes.length.toLocaleString("es-AR")} conexiones</span>
          <span className="text-emerald-200">Evidencia reportada</span>
        </div>
      </div>
    );
  }

  const showFallback = globeFailed && !hasRenderedCanvas;

  return (
    <div
      ref={containerRef}
      className={`relative select-none flex items-center justify-center overflow-hidden rounded-2xl border border-white/5 shadow-2xl p-0 pointer-events-auto ${className}`}
      style={{ width: "100%", maxWidth: width, height: renderHeight }}
      data-globe-ready={globeReady || hasRenderedCanvas ? "true" : "false"}
      data-globe-mode="interactive"
    >
      <GlobeLoadingBackdrop
        isLightTheme={isLightTheme}
        className={globeReady ? "opacity-0 pointer-events-none" : "opacity-100"}
      />
      {showFallback ? (
        <MapLibreGlobeFallback points={finitePoints} routes={finiteRoutes} />
      ) : null}

      {hoverCard ? (
        <div
          className="absolute left-4 top-4 z-20 max-w-[min(88%,21rem)] rounded-2xl border bg-slate-950/82 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,.42)] backdrop-blur-xl pointer-events-none"
          style={{ borderColor: `${hoverCard.tone}66` }}
        >
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-200">
            {hoverCard.eyebrow}
          </p>
          <strong className="mt-1 block text-lg font-black leading-tight text-white">
            {hoverCard.title}
          </strong>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-300">
            {hoverCard.subtitle}
          </span>
          <small className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.68rem] font-bold text-slate-100">
            {hoverCard.meta}
          </small>
        </div>
      ) : !compactHud ? (
        <div
          className="absolute left-4 top-4 z-20 max-w-[min(88%,17rem)] rounded-full border bg-slate-950/54 px-3 py-1.5 text-left text-[0.66rem] font-bold text-cyan-50 shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur-xl pointer-events-none"
          style={{ borderColor: `${defaultHoverCard.tone}44` }}
        >
          {defaultHoverCard.meta}
        </div>
      ) : null}

      {primaryRoute && !compactHud ? (
        <div
          className={`absolute z-20 pointer-events-none rounded-2xl border border-cyan-200/18 bg-slate-950/70 text-left shadow-[0_18px_54px_rgba(0,0,0,.34)] backdrop-blur-xl ${
            compactHud ? "bottom-3 left-3 right-3 px-3 py-2" : "bottom-4 left-4 max-w-[min(88%,24rem)] px-4 py-3"
          }`}
          style={compactHud ? undefined : { maxWidth: "min(88%, 24rem)" }}
        >
          <p className="text-[0.56rem] font-black uppercase tracking-[0.18em] text-cyan-200">
            Conexión de eventos
          </p>
          <strong className="mt-1 block truncate text-sm font-black leading-tight text-white">
            {routeCaption}
          </strong>
          <span className="mt-1 block truncate text-[0.66rem] font-bold text-slate-300">
            {primaryDistance || "Distancia estimada"} - {totalScans.toLocaleString("es-AR")} eventos NFC visibles
          </span>
        </div>
      ) : null}

      {!showFallback ? (
        <GlobeRuntimeBoundary onError={handleGlobeRuntimeError}>
          <Globe
          ref={globeRef}
          width={renderWidth}
          height={renderHeight}
        globeOffset={offset}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={!compactHud ? PROFESSIONAL_GLOBE_BACKGROUND_URL : undefined}
        rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        waitForGlobeReady={false}
        animateIn={true}
        showAtmosphere={true}
        showGraticules={!compactHud}
        atmosphereColor={isLightTheme ? "#3b82f6" : "#22d3ee"}
        atmosphereAltitude={0.16}
        globeImageUrl={globeImageUrl}
        bumpImageUrl={globeBumpUrl}
        globeCurvatureResolution={2.4}
        onGlobeReady={handleGlobeReady}

        // Real Natural Earth country layer. It gives the globe actual geography,
        // while the active countries lift slightly when taps exist there.
        polygonsData={countryPolygons}
        polygonGeoJsonGeometry="geometry"
        polygonAltitude={(feature: any) => (activeCountryNames.has(normalizeCountryName(canonicalCountryName(featureCountryName(feature)))) ? 0.012 : 0.002)}
        polygonCapColor={(feature: any) =>
          activeCountryNames.has(normalizeCountryName(canonicalCountryName(featureCountryName(feature))))
            ? (isLightTheme ? "rgba(20,184,166,.42)" : "rgba(34,211,238,.34)")
            : (isLightTheme ? "rgba(15,23,42,.06)" : "rgba(14,165,233,.045)")
        }
        polygonSideColor={() => (isLightTheme ? "rgba(14,116,144,.2)" : "rgba(34,211,238,.16)")}
        polygonStrokeColor={() => (isLightTheme ? "rgba(15,23,42,.34)" : "rgba(186,230,253,.38)")}
        polygonCapCurvatureResolution={5}
        polygonLabel={(feature: any) => displayCountryName(featureCountryName(feature))}
        onPolygonHover={(feature: any) => setCountryHover(feature || null)}
        polygonsTransitionDuration={900}

        // Soft heat surface over the reported scan volume supplied to this
        // component. Risk remains a separate semantic layer.
        heatmapsData={heatmapLayers}
        heatmapPoints="points"
        heatmapPointLat="lat"
        heatmapPointLng="lng"
        heatmapPointWeight={(point: any) => Math.max(1, pointWeight(point))}
        heatmapBandwidth={compactHud ? 0.55 : 0.9}
        heatmapColorSaturation={compactHud ? 1.8 : 2.45}
        heatmapBaseAltitude={0.004}
        heatmapTopAltitude={compactHud ? 0.035 : 0.065}
        heatmapColorFn={() => (t: number) => {
          if (t > 0.78) return `rgba(109, 40, 217, ${Math.min(0.95, t)})`;
          if (t > 0.52) return `rgba(37, 99, 235, ${Math.min(0.9, t)})`;
          if (t > 0.28) return `rgba(15, 118, 110, ${Math.min(0.82, t + 0.18)})`;
          return `rgba(34, 211, 238, ${Math.min(0.7, t + 0.18)})`;
        }}
        heatmapsTransitionDuration={900}
        
        // Points
        pointsData={finitePoints}
        pointLat="lat"
        pointLng="lng"
        pointColor={(p: any) => pointTone(p)}
        pointAltitude={(p: any) => (p.risk || p.status === "risk" ? (compactHud ? 0.038 : 0.048) : (compactHud ? 0.024 : 0.032))}
        pointRadius={(p: any) =>
          Math.min(
            compactHud ? 0.14 : 0.28,
            (compactHud ? 0.07 : 0.12) + Math.sqrt(Math.max(1, p.scans || 1)) * (compactHud ? 0.006 : 0.012) + (p.risk ? (compactHud ? 0.022 : 0.05) : 0),
          )
        }
        pointResolution={18}
        pointLabel={(p: any) => `<b>${p.city}</b>${inferCountryName(p) ? `<br/>${displayCountryName(inferCountryName(p))}` : ""}${p.scans ? `<br/>${p.scans} lecturas reportadas` : ""}`}
        onPointHover={(point: any) => setPointHover(point || null)}
        pointsMerge={false}
        pointsTransitionDuration={900}

        // Spatial aggregation layer for the points supplied by the caller.
        hexBinPointsData={hexPoints}
        hexBinPointLat="lat"
        hexBinPointLng="lng"
        hexBinPointWeight={(point: any) => pointWeight(point)}
        hexBinResolution={3}
        hexMargin={0.55}
        hexAltitude={(hex: any) => Math.min(0.13, 0.008 + Math.sqrt(hex.sumWeight || 1) * 0.012)}
        hexTopCurvatureResolution={5}
        hexTopColor={(hex: any) => hexHeatColor(hex.sumWeight || 1, 0.78)}
        hexSideColor={(hex: any) => hexHeatColor(hex.sumWeight || 1, 0.32)}
        hexTransitionDuration={900}
        hexLabel={(hex: any) => `${hex.points?.length || 0} ubicaciones<br/>intensidad acumulada ${Math.round(hex.sumWeight || 1)}`}
        
        // Labels
        labelsData={visibleLabelPoints}
        labelLat="lat"
        labelLng="lng"
        labelText="city"
        labelLabel={(p: any) => `${p.city}${inferCountryName(p) ? `, ${displayCountryName(inferCountryName(p))}` : ""}`}
        labelColor={() => (isLightTheme ? "#020617" : "#ffffff")}
        labelSize={compactHud ? 0.72 : 1.28}
        labelDotRadius={compactHud ? 0.06 : 0}
        labelAltitude={compactHud ? 0.055 : 0.048}
        labelResolution={2}
        
        // Route paths: geodesic polylines with animated dashes, closer to an
        // enterprise logistics/NFC control-room view than a decorative arc.
        pathsData={routePaths}
        pathPoints="coords"
        pathPointLat="lat"
        pathPointLng="lng"
        pathPointAlt="altitude"
        pathColor={(route: any) => [
          rgbaFromHex(route.color, 0.04),
          rgbaFromHex(route.color, 0.92),
          rgbaFromHex(route.color, 0.12),
        ]}
        pathStroke={(route: any) => route.tone === "warn" ? (compactHud ? 0.42 : 0.62) : (compactHud ? 0.32 : 0.5)}
        pathDashLength={(route: any) => route.tone === "warn" ? 0.18 : 0.13}
        pathDashGap={0.035}
        pathDashAnimateTime={(route: any) => route.tone === "warn" ? 1350 : 2100}
        pathLabel={(route: any) => `<b>${route.label}</b><br/>${route.distance || "Conexión reportada"}`}
        onPathHover={(route: any) => {
          if (!route) {
            setHoverCard(null);
            return;
          }
          setHoverCard({
            eyebrow: route.tone === "warn" ? "Conexión con alerta" : "Conexión comercial",
            title: route.label,
            subtitle: "Relación visual entre eventos reportados; no prueba recorrido físico",
            meta: route.distance || "Distancia estimada",
            tone: route.color,
          });
        }}
        pathTransitionDuration={900}

        // Moving evidence points along every route.
        particlesData={routeParticles}
        particlesList="particles"
        particleLat="lat"
        particleLng="lng"
        particleAltitude="altitude"
        particlesColor={(particle: any) => particle.color || "#67e8f9"}
        particlesSize={(particle: any) => (compactHud ? 0.55 : 0.85) * (particle.size || 1)}
        particlesSizeAttenuation={true}
        particleLabel={(particle: any) => `Señal de ruta ${particle.color || ""}`}
        
        // Arcs
        arcsData={finiteRoutes}
        arcStartLat="fromLat"
        arcStartLng="fromLng"
        arcEndLat="toLat"
        arcEndLng="toLng"
        arcLabel={(route: any) => `${routeTitle(route, finitePoints)}<br/>${routeMeta(route, finitePoints)}`}
        arcColor={(r: any) => (r.tone === "warn" ? "#fb7185" : r.tone === "success" ? "#34d399" : "#22d3ee")}
        arcDashLength={compactHud ? 0.34 : 0.45}
        arcDashGap={compactHud ? 0.22 : 0.15}
        arcDashAnimateTime={compactHud ? 1350 : 1800}
        arcStroke={(r: any) => (r.tone === "warn" ? (compactHud ? 1.1 : 1.6) : (compactHud ? 0.85 : 1.2))}
        arcAltitudeAutoScale={compactHud ? 0.28 : 0.4}
        arcCurveResolution={96}
        arcCircularResolution={10}
        onArcHover={(route: any) => setRouteHover(route || null)}
        arcsTransitionDuration={900}

        // Native globe.gl pulse layer for reported locations.
        ringsData={ringPoints}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0.012}
        ringColor={(p: any) => (t: number) => rgbaFromHex(p.tone, 1 - t)}
        ringMaxRadius={(p: any) => (p.risk || p.status === "risk" ? (compactHud ? 2.4 : 4.4) : (compactHud ? 1.8 : 3.1))}
        ringPropagationSpeed={(p: any) => (p.risk || p.status === "risk" ? (compactHud ? 1.25 : 1.7) : (compactHud ? 0.95 : 1.25))}
        ringRepeatPeriod={(p: any) => (p.risk || p.status === "risk" ? 950 : 1400)}
          ringResolution={compactHud ? 48 : 96}
          />
        </GlobeRuntimeBoundary>
      ) : null}
      {!compactHud && finitePoints.length ? (
        <div
          className={`absolute bottom-4 right-4 z-20 grid min-w-36 gap-1.5 rounded-xl border px-3 py-2 text-[0.62rem] font-bold shadow-[0_14px_40px_rgba(0,0,0,.2)] backdrop-blur-xl ${isLightTheme ? "border-cyan-800/15 bg-white/88 text-slate-700" : "border-white/10 bg-slate-950/72 text-slate-200"}`}
          aria-label="Escala estable de intensidad de lecturas reportadas: 1, 10, 100 y 1000 o más. El punto rosa marca riesgo y no aumenta la intensidad."
          data-heatmap-legend
        >
          <span className="uppercase tracking-[0.12em]">Intensidad de lecturas</span>
          <i aria-hidden="true" className="h-1.5 w-full rounded-full" style={{ background: "linear-gradient(90deg,#22d3ee,#0f766e,#2563eb,#6d28d9)" }} />
          <span className="flex justify-between"><em className="not-italic">1</em><em className="not-italic">10</em><em className="not-italic">100</em><em className="not-italic">1000+</em></span>
          <span className="inline-flex items-center gap-1.5 border-t pt-1.5" style={{ borderColor: isLightTheme ? "rgba(15,23,42,.1)" : "rgba(255,255,255,.1)" }}>
            <i aria-hidden="true" className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-300/30" /> Riesgo separado
          </span>
        </div>
      ) : null}
    </div>
  );
}
