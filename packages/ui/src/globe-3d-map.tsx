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

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function localGlobeTexture(isLightTheme: boolean) {
  const oceanTop = isLightTheme ? "#b9e6ff" : "#021125";
  const oceanMid = isLightTheme ? "#317bd3" : "#07375d";
  const oceanDeep = isLightTheme ? "#102d75" : "#020817";
  const land = isLightTheme ? "#6ad09a" : "#12a98f";
  const landDark = isLightTheme ? "#2f8a69" : "#0a705f";
  const landAlt = isLightTheme ? "#ecd07c" : "#60e6b5";
  const coast = isLightTheme ? "rgba(15,23,42,.34)" : "rgba(185,255,246,.38)";
  const grid = isLightTheme ? "rgba(15, 23, 42, .2)" : "rgba(103, 232, 249, .24)";
  const glow = isLightTheme ? "rgba(37, 99, 235, .3)" : "rgba(34, 211, 238, .36)";
  const city = isLightTheme ? "#fef3c7" : "#a7f3d0";
  const horizontalLines = Array.from({ length: 13 }, (_, i) => `<path d="M0 ${80 + i * 72} H2048"/>`).join("");
  const verticalLines = Array.from({ length: 25 }, (_, i) => `<path d="M${64 + i * 80} 0 V1024"/>`).join("");
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
        <linearGradient id="ridge" x1="0" x2="1">
          <stop offset="0" stop-color="${landAlt}" stop-opacity=".18"/>
          <stop offset=".5" stop-color="${landAlt}" stop-opacity=".58"/>
          <stop offset="1" stop-color="${landDark}" stop-opacity=".26"/>
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="4"/></filter>
        <filter id="city-glow"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <rect width="2048" height="1024" fill="url(#ocean)"/>
      <g opacity=".42" stroke="${grid}" stroke-width="2" fill="none">${horizontalLines}${verticalLines}</g>
      <g fill="${land}" stroke="${coast}" stroke-width="3" stroke-linejoin="round" opacity=".86">
        <path d="M196 231c33-46 95-74 153-70 38 3 58-20 91-30 49-14 106 2 136 44 20 28 15 72-16 92-25 16-66 4-89 25-31 29 0 75-30 104-24 23-72 18-98 42-34 31 20 90-25 131-42 39-125 21-166-34-45-61-40-166 11-218 15-16 18-50 33-86Z"/>
        <path d="M377 575c34-21 86-10 112 22 31 39 25 93 47 139 19 39 60 70 55 117-5 49-55 85-103 70-57-18-72-92-91-143-18-47-63-73-71-126-5-34 15-60 51-79Z"/>
        <path d="M682 206c58-54 150-60 220-26 44 22 70 59 128 57 61-2 107-38 171-19 42 12 76 43 84 85 11 58-50 71-86 101-49 41-32 112-81 153-56 47-151 21-200-31-35-37-63-75-117-80-59-5-120 13-165-31-54-52-24-148 46-209Z"/>
        <path d="M946 477c44-17 103-4 132 31 31 38 17 92-18 120-39 31-97 23-139 51-43 29-47 94-96 111-55 20-118-29-118-86 0-47 45-68 77-93 60-46 84-103 162-134Z"/>
        <path d="M1222 212c76-44 180-46 253-2 63 38 81 103 41 151-41 50-122 29-163 78-42 50 20 117-29 162-58 53-183 27-242-42-74-87-38-242 140-347Z"/>
        <path d="M1516 317c52-35 134-29 177 17 42 44 31 114-24 136-35 14-81 5-108 34-32 34 5 86-26 116-47 45-153 18-197-39-63-82 19-196 178-264Z"/>
        <path d="M1708 656c54-14 116 6 145 46 33 46 13 114-38 138-66 31-158-7-174-72-11-45 18-94 67-112Z"/>
        <path d="M780 150c28-24 72-31 108-17 32 13 51 45 39 76-16 41-76 42-115 31-42-12-67-54-32-90Z"/>
      </g>
      <g fill="url(#ridge)" opacity=".86" filter="url(#soft)">
        <path d="M246 321c88-34 177-14 254 29"/>
        <path d="M456 675c34 60 52 133 27 205"/>
        <path d="M780 303c82-50 223-53 338-8"/>
        <path d="M999 533c-70 26-139 87-175 157"/>
        <path d="M1268 338c111-45 237-31 335 44"/>
        <path d="M1445 532c60-15 119 8 164 56"/>
        <ellipse cx="1700" cy="738" rx="86" ry="46"/>
      </g>
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
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
      <div className="absolute h-[88%] w-[88%] rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(125,245,255,.36),rgba(14,165,233,.18)_32%,rgba(2,6,23,.78)_68%,rgba(2,6,23,0)_72%)] blur-sm" />
      <div className="absolute h-[74%] w-[74%] rounded-full border border-cyan-200/20 shadow-[0_0_80px_rgba(34,211,238,.24),inset_0_0_70px_rgba(34,211,238,.12)]" />
      <svg className="relative h-[82%] w-[82%] overflow-visible opacity-95" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="nexid-fallback-globe" cx="38%" cy="28%" r="74%">
            <stop offset="0%" stopColor={isLightTheme ? "#dff4ff" : "#1dd9ff"} stopOpacity=".72" />
            <stop offset="36%" stopColor={isLightTheme ? "#78bdf9" : "#0874a8"} stopOpacity=".48" />
            <stop offset="76%" stopColor={isLightTheme ? "#0f5bb8" : "#03172d"} stopOpacity=".92" />
            <stop offset="100%" stopColor="#020617" stopOpacity=".98" />
          </radialGradient>
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
        </defs>
        <circle cx="50" cy="50" r="40" fill="url(#nexid-fallback-globe)" />
        {[18, 31, 44, 56, 69, 82].map((x) => (
          <path key={`lon-${x}`} d={`M${x} 12 C${50 + (x - 50) * 0.34} 32 ${50 + (x - 50) * 0.34} 68 ${x} 88`} fill="none" stroke={stroke} strokeWidth=".28" />
        ))}
        {[22, 34, 46, 58, 70, 82].map((y) => (
          <ellipse key={`lat-${y}`} cx="50" cy="50" rx="40" ry={Math.abs(50 - y) + 2} fill="none" stroke={stroke} strokeWidth=".26" opacity=".58" />
        ))}
        <path d="M26 31c8-8 20-7 26 0 3 4 2 10-3 12-5 2-10-1-14 3-4 4 1 10-5 14-6 4-17 0-21-8-4-8 2-16 17-21Z" fill="#34d399" opacity=".42" />
        <path d="M51 25c11-5 26-4 35 3 8 7 6 15-3 17-7 2-15-1-20 4-5 6 1 13-6 17-8 5-22 0-28-9-8-12 1-25 22-32Z" fill="#22d3ee" opacity=".34" />
        <path d="M56 62c7-4 19-4 26 0 6 4 7 11 1 15-5 3-14 1-19 4-6 4-1 10-6 13-7 4-19-1-23-8-5-8 3-17 21-24Z" fill="#a78bfa" opacity=".24" />
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
      <div className="absolute bottom-5 left-1/2 h-8 w-[62%] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-xl" />
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
  const renderHeight = Math.max(260, Math.round(renderWidth * (height / Math.max(width, 1))));
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
        className={globeReady ? "opacity-0 transition-opacity duration-700" : "opacity-100 transition-opacity duration-700"}
      />

      <div className="absolute bottom-4 right-4 z-20 text-[9px] text-slate-500 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        Arrastrá para rotar
      </div>

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
