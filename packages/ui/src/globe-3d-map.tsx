"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });
const COUNTRY_GEOJSON_URL = "/assets/geo/ne_110m_admin_0_countries.geojson";
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

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  argentina: "argentina",
  brasil: "brazil",
  brazil: "brazil",
  usa: "united states of america",
  "united states": "united states of america",
  "united states of america": "united states of america",
  suiza: "switzerland",
  switzerland: "switzerland",
  espana: "spain",
  spain: "spain",
  chile: "chile",
  france: "france",
  francia: "france",
  "united kingdom": "united kingdom",
  uk: "united kingdom",
  china: "china",
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

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function localGlobeTexture(isLightTheme: boolean) {
  const oceanTop = isLightTheme ? "#d8f4ff" : "#031326";
  const oceanMid = isLightTheme ? "#5ab7e9" : "#062e52";
  const oceanDeep = isLightTheme ? "#164293" : "#020714";
  const grid = isLightTheme ? "rgba(15, 23, 42, .16)" : "rgba(103, 232, 249, .14)";
  const glow = isLightTheme ? "rgba(37, 99, 235, .26)" : "rgba(34, 211, 238, .28)";
  const city = isLightTheme ? "#fef3c7" : "#a7f3d0";
  const horizontalLines = Array.from({ length: 13 }, (_, i) => `<path d="M0 ${80 + i * 72} H2048"/>`).join("");
  const verticalLines = Array.from({ length: 25 }, (_, i) => `<path d="M${64 + i * 80} 0 V1024"/>`).join("");
  const lanes = [
    "M120 590 C420 410 760 395 1060 500 C1340 598 1660 526 1920 356",
    "M80 410 C374 352 642 394 920 456 C1220 522 1530 474 1988 274",
    "M418 768 C698 624 982 610 1254 690 C1478 754 1692 730 1960 642",
    "M704 196 C884 310 980 448 1094 594 C1220 754 1390 844 1666 858",
  ].map((d) => `<path d="${d}"/>`).join("");
  const cityLights = [
    [300, 330, 2.2], [390, 284, 1.5], [505, 375, 1.8], [474, 608, 1.6], [496, 714, 2.4],
    [575, 820, 1.6], [932, 317, 2.2], [1018, 286, 1.6], [1036, 360, 2.4], [1104, 405, 1.5],
    [1070, 548, 1.8], [1192, 573, 1.4], [1342, 343, 2.4], [1456, 384, 1.8], [1534, 468, 2.1],
    [1620, 548, 1.6], [1722, 760, 1.9], [1845, 782, 1.5],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${city}" opacity=".82"/>`)
    .join("");

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024">
      <defs>
        <linearGradient id="ocean" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${oceanTop}"/>
          <stop offset=".48" stop-color="${oceanMid}"/>
          <stop offset="1" stop-color="${oceanDeep}"/>
        </linearGradient>
        <radialGradient id="light" cx=".36" cy=".24" r=".78">
          <stop offset="0" stop-color="white" stop-opacity=".38"/>
          <stop offset=".36" stop-color="${glow}" stop-opacity=".46"/>
          <stop offset="1" stop-color="black" stop-opacity=".18"/>
        </radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="4"/></filter>
        <filter id="city-glow"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <rect width="2048" height="1024" fill="url(#ocean)"/>
      <g opacity=".42" stroke="${grid}" stroke-width="2" fill="none">${horizontalLines}${verticalLines}</g>
      <g fill="none" stroke="${isLightTheme ? "rgba(255,255,255,.28)" : "rgba(125,245,255,.22)"}" stroke-width="3" stroke-linecap="round" opacity=".42" filter="url(#soft)">${lanes}</g>
      <g fill="none" stroke="${isLightTheme ? "rgba(20,184,166,.28)" : "rgba(45,212,191,.2)"}" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="12 18" opacity=".72">${lanes}</g>
      <g opacity=".5" filter="url(#city-glow)">
        ${cityLights}
      </g>
      <g opacity=".88">
        ${cityLights}
      </g>
      <rect width="2048" height="1024" fill="url(#light)"/>
    </svg>
  `);
}

function localGlobeBumpTexture(isLightTheme: boolean) {
  const base = isLightTheme ? "#5b6f8d" : "#141c2e";
  const relief = isLightTheme ? "#f1f5f9" : "#cbd5e1";
  const shadow = isLightTheme ? "#23324c" : "#020617";
  const horizontalLines = Array.from({ length: 18 }, (_, i) => `<path d="M0 ${40 + i * 56} H2048"/>`).join("");
  const ridges = [
    "M210 304c86-52 225-52 340 4",
    "M430 620c86 60 111 179 50 284",
    "M705 282c150-86 343-73 505 16",
    "M945 540c-92 41-162 112-219 202",
    "M1220 337c148-75 333-54 492 58",
    "M1508 530c84-32 182 18 228 88",
  ]
    .map((d) => `<path d="${d}"/>`)
    .join("");

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024">
      <rect width="2048" height="1024" fill="${base}"/>
      <g stroke="${shadow}" stroke-width="4" opacity=".45" fill="none">${horizontalLines}</g>
      <g stroke="${relief}" stroke-width="18" stroke-linecap="round" opacity=".34" fill="none">${ridges}</g>
      <g stroke="${shadow}" stroke-width="8" stroke-linecap="round" opacity=".38" fill="none" transform="translate(8 10)">${ridges}</g>
      <g fill="${relief}" opacity=".3">
        <ellipse cx="310" cy="320" rx="120" ry="58"/>
        <ellipse cx="920" cy="330" rx="170" ry="70"/>
        <ellipse cx="1320" cy="392" rx="190" ry="82"/>
        <ellipse cx="1688" cy="730" rx="118" ry="62"/>
      </g>
    </svg>
  `);
}

function rgbaFromHex(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

function pointWeight(point: GlobePoint) {
  return Math.max(1, Math.min(16, Math.round((point.scans || 1) / 160) + (point.risk ? 3 : 0)));
}

function hexHeatColor(weight: number, alpha = 0.88) {
  if (weight >= 12) return `rgba(248, 113, 113, ${alpha})`;
  if (weight >= 7) return `rgba(251, 191, 36, ${alpha})`;
  if (weight >= 4) return `rgba(163, 230, 53, ${alpha})`;
  return `rgba(34, 211, 238, ${alpha})`;
}

function normalizeCountryName(value?: string) {
  const normalized = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return COUNTRY_NAME_ALIASES[normalized] || normalized;
}

function inferCountryName(point: GlobePoint) {
  if (point.country) return point.country;

  const city = normalizeCountryName(point.city);
  const matchedCity = Object.keys(CITY_COUNTRY_HINTS).find((key) => city.includes(key));
  return matchedCity ? CITY_COUNTRY_HINTS[matchedCity] : "";
}

function featureCountryName(feature: CountryFeature) {
  return feature.properties?.ADMIN || feature.properties?.NAME || "";
}

function projectPoint(lat: number, lng: number) {
  return {
    x: 50 + Math.max(-180, Math.min(180, lng)) / 180 * 38,
    y: 50 - Math.max(-82, Math.min(82, lat)) / 82 * 34,
  };
}

function pointTone(point: GlobePoint) {
  if (point.risk || point.status === "risk") return "#fb7185";
  if (point.status === "origin") return "#34d399";
  if (point.status === "passport") return "#a78bfa";
  return "#22d3ee";
}

function GlobeFallbackVisual({
  points,
  routes,
  isLightTheme,
  className = "",
}: {
  points: GlobePoint[];
  routes: GlobeRoute[];
  isLightTheme: boolean;
  className?: string;
}) {
  const visiblePoints = points.slice(0, 10);
  const visibleRoutes = routes.slice(0, 8);
  const stroke = isLightTheme ? "rgba(37, 99, 235, .34)" : "rgba(34, 211, 238, .42)";

  return (
    <div className={`absolute inset-0 z-0 grid place-items-center overflow-hidden rounded-2xl ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(34,211,238,.22),transparent_34%),radial-gradient(circle_at_72%_72%,rgba(52,211,153,.16),transparent_36%)]" />
      <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/24 to-transparent" />
      <div className="absolute left-1/2 top-8 h-[78%] w-px bg-gradient-to-b from-transparent via-cyan-200/14 to-transparent" />
      <svg className="relative h-[84%] w-[84%] overflow-visible opacity-95" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="nexid-fallback-route" x1="0" x2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity=".05" />
            <stop offset="52%" stopColor="#67e8f9" stopOpacity=".94" />
            <stop offset="100%" stopColor="#34d399" stopOpacity=".05" />
          </linearGradient>
          <linearGradient id="nexid-fallback-route-warn" x1="0" x2="1">
            <stop offset="0%" stopColor="#fb7185" stopOpacity=".08" />
            <stop offset="54%" stopColor="#facc15" stopOpacity=".94" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity=".08" />
          </linearGradient>
          <filter id="nexid-fallback-soft-glow">
            <feGaussianBlur stdDeviation="1.7" />
          </filter>
        </defs>
        <g opacity=".34" stroke={stroke} strokeWidth=".34">
          {[18, 31, 44, 57, 70, 83].map((x) => (
            <path key={`mesh-x-${x}`} d={`M${x} 8 V92`} />
          ))}
          {[18, 31, 44, 57, 70, 83].map((y) => (
            <path key={`mesh-y-${y}`} d={`M8 ${y} H92`} />
          ))}
        </g>
        <g opacity=".24" fill="none" stroke="#67e8f9" strokeWidth=".45">
          <path d="M14 78 C27 56 36 45 53 39 C69 34 78 26 88 14" />
          <path d="M12 44 C25 31 44 28 58 33 C73 38 82 51 91 70" />
          <path d="M25 88 C34 72 48 64 63 61 C75 58 84 50 92 39" />
        </g>
        {visibleRoutes.map((route, index) => {
          const from = projectPoint(route.fromLat, route.fromLng);
          const to = projectPoint(route.toLat, route.toLng);
          const cx = (from.x + to.x) / 2;
          const cy = Math.min(from.y, to.y) - 10 - (index % 3) * 2;
          return (
            <path
              key={`${route.label || "route"}-${index}`}
              d={`M${from.x.toFixed(2)} ${from.y.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`}
              fill="none"
              stroke={route.tone === "warn" ? "url(#nexid-fallback-route-warn)" : "url(#nexid-fallback-route)"}
              strokeWidth={route.tone === "warn" ? 1.05 : 0.82}
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
          );
        })}
        <g opacity=".28" filter="url(#nexid-fallback-soft-glow)">
          {visiblePoints.map((point, index) => {
            const pos = projectPoint(point.lat, point.lng);
            const color = pointTone(point);
            return <circle key={`${point.city}-glow-${index}`} cx={pos.x} cy={pos.y} r="7.2" fill={color} />;
          })}
        </g>
        {visiblePoints.map((point, index) => {
          const pos = projectPoint(point.lat, point.lng);
          const color = pointTone(point);
          const radius = point.risk || point.status === "risk" ? 1.9 : 1.45;
          return (
            <g key={`${point.city}-${index}`}>
              <circle cx={pos.x} cy={pos.y} r={radius + 2.6} fill={color} opacity=".12" />
              <circle cx={pos.x} cy={pos.y} r={radius} fill={color} opacity=".95" />
              <circle cx={pos.x} cy={pos.y} r={radius + 4.2} fill="none" stroke={color} strokeWidth=".42" opacity=".34" />
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-5 left-1/2 h-8 w-[62%] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-xl" />
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
  theme = "auto"
}: {
  points?: GlobePoint[];
  routes?: GlobeRoute[];
  width?: number;
  height?: number;
  className?: string;
  offset?: [number, number];
  theme?: "light" | "dark" | "auto";
}) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [containerWidth, setContainerWidth] = useState(width);
  const [globeReady, setGlobeReady] = useState(false);
  const [countryPolygons, setCountryPolygons] = useState<CountryFeature[]>([]);
  const [hoverCard, setHoverCard] = useState<GlobeHoverCard | null>(null);

  useEffect(() => {
    setMounted(true);
    
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

  const renderWidth = Math.max(280, Math.min(width, containerWidth || width));
  const compactRequested = height <= 240;
  const mediumRequested = height <= 360;
  const minRenderHeight = compactRequested ? 220 : mediumRequested ? 300 : 360;
  const renderHeight = Math.max(minRenderHeight, Math.round(renderWidth * (height / Math.max(width, 1))));
  const compactHud = renderWidth < 500 || height <= 360;
  const globeImageUrl = useMemo(() => localGlobeTexture(isLightTheme), [isLightTheme]);
  const globeBumpUrl = useMemo(() => localGlobeBumpTexture(isLightTheme), [isLightTheme]);
  const activeCountryNames = useMemo(
    () => new Set(points.map((point) => normalizeCountryName(inferCountryName(point))).filter(Boolean)),
    [points],
  );
  const hexPoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [points],
  );
  const ringPoints = useMemo(
    () =>
      points
        .filter((point) => point.status !== "origin")
        .slice(0, 18)
        .map((point) => ({
          ...point,
          tone: point.risk || point.status === "risk" ? "#fb7185" : point.status === "passport" ? "#a78bfa" : "#22d3ee",
        })),
    [points],
  );
  const defaultHoverCard = useMemo<GlobeHoverCard>(() => {
    const scans = points.reduce((sum, point) => sum + (point.scans || 0), 0);
    const regions = new Set(points.map((point) => inferCountryName(point) || point.city).filter(Boolean)).size;
    return {
      eyebrow: "nexID Global Trust Mesh",
      title: "Red global de producto",
      subtitle: "Pasa el mouse por un pais, ciudad, ruta o hotspot.",
      meta: `${points.length} nodos - ${routes.length} rutas - ${scans.toLocaleString("es-AR")} taps - ${regions} regiones`,
      tone: "#22d3ee",
    };
  }, [points, routes]);

  const setPointHover = useCallback((point?: GlobePoint | null) => {
    if (!point) {
      setHoverCard(null);
      return;
    }

    const country = inferCountryName(point);
    const risk = point.risk || point.status === "risk";
    setHoverCard({
      eyebrow: risk ? "Riesgo operativo" : point.status === "origin" ? "Origen verificado" : "Tap en vivo",
      title: point.city,
      subtitle: country || "Ubicacion verificada",
      meta: `${point.scans || 1} taps${risk ? ` - riesgo ${point.risk || 1}` : ""}${point.vertical ? ` - ${point.vertical}` : ""}`,
      tone: pointTone(point),
    });
  }, []);

  const setCountryHover = useCallback((feature?: CountryFeature | null) => {
    if (!feature) {
      setHoverCard(null);
      return;
    }

    const country = featureCountryName(feature);
    const normalized = normalizeCountryName(country);
    const activePoints = points.filter((point) => normalizeCountryName(inferCountryName(point)) === normalized);
    const scans = activePoints.reduce((sum, point) => sum + (point.scans || 0), 0);
    const active = activeCountryNames.has(normalized);

    setHoverCard({
      eyebrow: active ? "Pais con actividad nexID" : "Capa geografica",
      title: country || "Pais",
      subtitle: feature.properties?.CONTINENT || "Cobertura global",
      meta: active
        ? `${activePoints.length} nodos - ${scans.toLocaleString("es-AR")} taps verificados`
        : "Sin taps visibles en la ventana actual",
      tone: active ? "#34d399" : "#67e8f9",
    });
  }, [activeCountryNames, points]);

  const setRouteHover = useCallback((route?: GlobeRoute | null) => {
    if (!route) {
      setHoverCard(null);
      return;
    }

    setHoverCard({
      eyebrow: route.tone === "warn" ? "Ruta con alerta" : "Ruta de trazabilidad",
      title: route.label || "Ruta verificada",
      subtitle: "Origen, toque fisico y evidencia comercial unidos",
      meta: `${route.fromLat.toFixed(2)}, ${route.fromLng.toFixed(2)} -> ${route.toLat.toFixed(2)}, ${route.toLng.toFixed(2)}`,
      tone: route.tone === "warn" ? "#fb7185" : route.tone === "success" ? "#34d399" : "#22d3ee",
    });
  }, []);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (globe) {
      setGlobeReady(true);
      // Center the camera over the Atlantic between origin, channels and destination markets.
      globe.pointOfView({ lat: 10, lng: -28, altitude: 2.15 }, 0);

      const controls = globe.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.55;
        controls.enableZoom = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
      }
    }
  }, []);

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
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mounted, isLightTheme, offset[0], offset[1], handleGlobeReady]);

  // Prevent overlapping labels by deduplicating by city and adjusting coordinates slightly
  const labelPoints = useMemo(() => {
    const unique: Record<string, GlobePoint> = {};
    points.forEach((p) => {
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
  }, [points]);

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className={`relative flex items-center justify-center overflow-hidden bg-black/10 rounded-2xl border border-white/5 shadow-2xl p-0 ${className}`}
        style={{ width: "100%", maxWidth: width, height: renderHeight }}
      >
        <GlobeFallbackVisual points={points} routes={routes} isLightTheme={isLightTheme} />
        <div className="relative z-10 rounded-full border border-cyan-200/20 bg-slate-950/70 px-3 py-1 text-xs text-slate-200 font-mono animate-pulse">
          Cargando globo 3D...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative select-none flex items-center justify-center overflow-hidden rounded-2xl border border-white/5 shadow-2xl p-0 pointer-events-auto ${className}`}
      style={{ width: "100%", maxWidth: width, height: renderHeight }}
      data-globe-ready={globeReady ? "true" : "false"}
    >
      <GlobeFallbackVisual
        points={points}
        routes={routes}
        isLightTheme={isLightTheme}
        className={globeReady ? "opacity-10 transition-opacity duration-700" : "opacity-100 transition-opacity duration-700"}
      />

      {!compactHud ? (
        <div className="absolute bottom-4 right-4 z-20 text-[9px] text-slate-500 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
          Arrastra para rotar
        </div>
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

      <Globe
        ref={globeRef}
        width={renderWidth}
        height={renderHeight}
        globeOffset={offset}
        backgroundColor="rgba(0,0,0,0)"
        rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        waitForGlobeReady={false}
        animateIn={true}
        showAtmosphere={true}
        showGraticules={true}
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
        polygonAltitude={(feature: any) => (activeCountryNames.has(normalizeCountryName(featureCountryName(feature))) ? 0.012 : 0.002)}
        polygonCapColor={(feature: any) =>
          activeCountryNames.has(normalizeCountryName(featureCountryName(feature)))
            ? (isLightTheme ? "rgba(20,184,166,.42)" : "rgba(34,211,238,.34)")
            : (isLightTheme ? "rgba(15,23,42,.06)" : "rgba(14,165,233,.045)")
        }
        polygonSideColor={() => (isLightTheme ? "rgba(14,116,144,.18)" : "rgba(34,211,238,.12)")}
        polygonStrokeColor={() => (isLightTheme ? "rgba(15,23,42,.24)" : "rgba(186,230,253,.22)")}
        polygonCapCurvatureResolution={5}
        polygonLabel={(feature: any) => featureCountryName(feature)}
        onPolygonHover={(feature: any) => setCountryHover(feature || null)}
        polygonsTransitionDuration={900}
        
        // Points
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(p: any) => pointTone(p)}
        pointAltitude={(p: any) => (p.risk || p.status === "risk" ? 0.048 : 0.032)}
        pointRadius={(p: any) => Math.min(0.28, 0.12 + Math.sqrt(Math.max(1, p.scans || 1)) * 0.012 + (p.risk ? 0.05 : 0))}
        pointResolution={18}
        pointLabel={(p: any) => `<b>${p.city}</b>${p.country ? `<br/>${p.country}` : ""}${p.scans ? `<br/>${p.scans} taps` : ""}`}
        onPointHover={(point: any) => setPointHover(point || null)}
        pointsMerge={false}
        pointsTransitionDuration={900}

        // Density layer: real-time taps are aggregated into H3-like prisms.
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
        hexLabel={(hex: any) => `${hex.points?.length || 0} nodos<br/>peso comercial ${hex.sumWeight || 1}`}
        
        // Labels
        labelsData={labelPoints}
        labelLat="lat"
        labelLng="lng"
        labelText="city"
        labelLabel={(p: any) => `${p.city}${p.country ? `, ${p.country}` : ""}`}
        labelColor={() => (isLightTheme ? "#020617" : "#ffffff")}
        labelSize={1.35}
        labelDotRadius={0}
        labelAltitude={0.045}
        
        // Arcs
        arcsData={routes}
        arcStartLat="fromLat"
        arcStartLng="fromLng"
        arcEndLat="toLat"
        arcEndLng="toLng"
        arcLabel={(route: any) => route.label || "Ruta verificada"}
        arcColor={(r: any) => (r.tone === "warn" ? "#fb7185" : "#22d3ee")}
        arcDashLength={0.45}
        arcDashGap={0.15}
        arcDashAnimateTime={1800}
        arcStroke={(r: any) => (r.tone === "warn" ? 1.6 : 1.2)}
        arcAltitudeAutoScale={0.4}
        arcCurveResolution={96}
        arcCircularResolution={10}
        arcsTransitionDuration={900}

        // Native globe.gl pulse layer for live taps.
        ringsData={ringPoints}
        ringLat="lat"
        ringLng="lng"
        ringAltitude={0.012}
        ringColor={(p: any) => (t: number) => rgbaFromHex(p.tone, 1 - t)}
        ringMaxRadius={(p: any) => (p.risk || p.status === "risk" ? 4.4 : 3.1)}
        ringPropagationSpeed={(p: any) => (p.risk || p.status === "risk" ? 1.7 : 1.25)}
        ringRepeatPeriod={(p: any) => (p.risk || p.status === "risk" ? 950 : 1400)}
        ringResolution={96}
      />
    </div>
  );
}
