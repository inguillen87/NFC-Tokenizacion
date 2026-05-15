"use client";

import { useId, useMemo, type KeyboardEvent } from "react";

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

const LAND_PATHS = [
  "M155 205 C130 158 165 112 235 94 C312 75 390 91 438 138 C483 181 469 240 418 259 C376 274 367 321 323 334 C275 349 241 315 202 326 C164 337 138 285 155 205 Z",
  "M322 348 C363 368 390 418 386 466 C382 512 346 552 310 566 C292 520 276 488 280 444 C284 399 292 370 322 348 Z",
  "M565 132 C612 96 696 103 733 148 C771 194 735 235 674 230 C617 225 552 202 565 132 Z",
  "M600 253 C666 220 735 250 759 317 C777 368 748 436 699 470 C650 446 621 389 595 338 C578 303 569 270 600 253 Z",
  "M741 166 C824 111 979 121 1056 196 C1117 256 1071 339 965 335 C899 333 868 371 805 351 C734 329 683 238 741 166 Z",
  "M905 405 C952 384 1014 401 1044 446 C1011 488 947 501 904 472 C883 458 880 424 905 405 Z",
  "M103 548 C244 532 373 536 520 548 C660 560 834 552 1092 538 L1115 592 L80 592 Z",
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

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * WIDTH;
  const y = ((90 - lat) / 180) * HEIGHT;
  return { x, y };
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
  title = "Atlas vectorial",
  subtitle = "Heatmap, rutas y puntos sin API externa.",
  caption,
  className = "",
  heightClassName = "h-[24rem]",
  density = "balanced",
  chrome = "full",
  maxPoints = 48,
  maxRoutes = 24,
  evidenceSteps = [],
  ledgerItems = [],
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
}) {
  const rawId = useId();
  const idPrefix = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, ""), [rawId]);
  const visiblePoints = points.slice(0, maxPoints);
  const visibleRoutes = routes.slice(0, maxRoutes);
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
                detail: "Heatmap y puntos de lectura listos para auditoria",
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden={chrome === "minimal"}>
        <defs>
          <linearGradient id={`${idPrefix}-ocean`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06243c" />
            <stop offset="48%" stopColor="#071827" />
            <stop offset="100%" stopColor="#111136" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-land`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.44" />
            <stop offset="46%" stopColor="#0e7490" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#312e81" stopOpacity="0.34" />
          </linearGradient>
          <radialGradient id={`${idPrefix}-vignette`} cx="50%" cy="48%" r="66%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.16)" />
            <stop offset="58%" stopColor="rgba(15,23,42,0.16)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.76)" />
          </radialGradient>
          <filter id={`${idPrefix}-soft-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.13 0 0 0 0 0.83 0 0 0 0 0.93 0 0 0 .45 0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${idPrefix}-land-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="13" floodColor="#020617" floodOpacity="0.24" />
          </filter>
          <pattern id={`${idPrefix}-micro-grid`} width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 H 0 V 60" fill="none" stroke="rgba(125,211,252,0.09)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-ocean)`} />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-micro-grid)`} opacity="0.8" />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${idPrefix}-vignette)`} />

        <g opacity="0.72">
          {PARALLELS.map((lat) => {
            const y = project(lat, 0).y;
            return <line key={`lat-${lat}`} x1="58" x2={WIDTH - 58} y1={y} y2={y} stroke="rgba(125,211,252,0.12)" strokeWidth="1.1" strokeDasharray="8 14" />;
          })}
          {MERIDIANS.map((lng) => {
            const x = project(0, lng).x;
            return <line key={`lng-${lng}`} x1={x} x2={x} y1="42" y2={HEIGHT - 42} stroke="rgba(125,211,252,0.10)" strokeWidth="1.1" strokeDasharray="8 14" />;
          })}
        </g>

        <g filter={`url(#${idPrefix}-land-shadow)`}>
          {LAND_PATHS.map((path, index) => (
            <path key={`land-${index}`} d={path} fill={`url(#${idPrefix}-land)`} stroke="rgba(186,230,253,0.18)" strokeWidth="1.6" />
          ))}
          {LAND_PATHS.slice(0, 6).map((path, index) => (
            <path key={`coast-${index}`} d={path} fill="none" stroke="rgba(226,232,240,0.12)" strokeWidth="4" opacity="0.36" />
          ))}
        </g>

        <g opacity={density === "route" ? "0.38" : "0.56"}>
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

        <g opacity={density === "route" ? "0.62" : "0.95"}>
          {visiblePoints.map((point) => {
            const dot = project(point.lat, point.lng);
            const tone = toneFor(point);
            const normalized = Math.max(0.18, Math.min(1, (point.scans || 1) / maxScan));
            const radius = density === "heat" ? 44 + normalized * 60 : 32 + normalized * 34;
            return (
              <circle
                key={`heat-${point.id}`}
                cx={dot.x}
                cy={dot.y}
                r={radius}
                fill={heatColor(tone)}
                opacity={tone === "risk" ? "0.78" : "0.62"}
              />
            );
          })}
        </g>

        <g>
          {visibleRoutes.map((route, index) => {
            const d = routePath(route);
            const color = routeColor(route.tone);
            const speed = route.tone === "warn" ? "2.1s" : "3.2s";
            return (
              <g key={route.id}>
                <path d={d} fill="none" stroke="#020617" strokeWidth={route.tone === "warn" ? "12" : "10"} strokeLinecap="round" opacity="0.5" />
                <path d={d} fill="none" stroke={color} strokeWidth={route.tone === "warn" ? "4.4" : "3.6"} strokeLinecap="round" strokeDasharray="11 13" opacity="0.92" filter={`url(#${idPrefix}-soft-glow)`}>
                  <animate attributeName="stroke-dashoffset" values="0;-72" dur={speed} repeatCount="indefinite" />
                </path>
                <circle r={route.tone === "warn" ? "5" : "4"} fill={color} opacity={index > 9 ? "0.45" : "0.9"}>
                  <animateMotion dur={route.tone === "warn" ? "4.2s" : "5.5s"} repeatCount="indefinite" path={d} />
                </circle>
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
            const radius = selected ? 11 : tone === "origin" || tone === "tap" ? 8.5 : 6.5;
            const shouldLabel = selected || tone === "origin" || tone === "tap" || tone === "risk";
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
                <circle cx={dot.x} cy={dot.y} r={radius} fill={color} stroke="#f8fafc" strokeWidth={selected ? "3" : "2"} filter={`url(#${idPrefix}-soft-glow)`} />
                {shouldLabel ? (
                  <text
                    x={dot.x + 15}
                    y={dot.y - 12}
                    fill="#e0f2fe"
                    fontSize={selected ? "20" : "16"}
                    fontWeight="850"
                    paintOrder="stroke"
                    stroke="rgba(2,6,23,0.86)"
                    strokeWidth="5"
                  >
                    {point.label}
                  </text>
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
            <span className="rounded-full border border-violet-300/25 bg-violet-500/12 px-2 py-1 text-violet-100">sin API paga</span>
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
              {caption || "Mapa vectorial propio para trazabilidad, calor de actividad y rutas de confianza."}
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
