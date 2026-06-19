import Link from "next/link";

export type TraceabilityGlobePoint = {
  city: string;
  country?: string;
  scans?: number;
  risk?: number;
  lat: number;
  lng: number;
  vertical?: string;
  status?: string;
  lastSeen?: string;
};

export type TraceabilityGlobeRoute = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  tone?: "info" | "warn";
  label?: string;
};

type TraceabilityGlobeProps = {
  title?: string;
  subtitle?: string;
  caption?: string;
  points?: readonly TraceabilityGlobePoint[];
  routes?: readonly TraceabilityGlobeRoute[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  compact?: boolean;
  onPointSelect?: (point: TraceabilityGlobePoint) => void;
};

const fallbackPoints: TraceabilityGlobePoint[] = [
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 4820, risk: 0, status: "origin", vertical: "wine" },
  { city: "San Martin", country: "Argentina", lat: -33.0806, lng: -68.4681, scans: 1240, risk: 0, status: "tap", vertical: "agro" },
  { city: "Sao Paulo", country: "Brasil", lat: -23.5505, lng: -46.6333, scans: 2190, risk: 3, status: "risk", vertical: "events" },
  { city: "Miami", country: "USA", lat: 25.7617, lng: -80.1918, scans: 3180, risk: 0, status: "export", vertical: "luxury" },
  { city: "Zurich", country: "Suiza", lat: 47.3769, lng: 8.5417, scans: 980, risk: 0, status: "passport", vertical: "wine" },
  { city: "Madrid", country: "Espana", lat: 40.4168, lng: -3.7038, scans: 1680, risk: 0, status: "dpp", vertical: "textile" },
];

const fallbackRoutes: TraceabilityGlobeRoute[] = [
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 47.3769, toLng: 8.5417, tone: "info", label: "Wine export" },
  { fromLat: -33.0806, fromLng: -68.4681, toLat: -23.5505, toLng: -46.6333, tone: "warn", label: "Replay watch" },
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 25.7617, toLng: -80.1918, tone: "info", label: "Retail route" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function project(lat: number, lng: number) {
  const x = clamp(50 + (lng / 180) * 43, 7, 93);
  const y = clamp(50 - (lat / 90) * 34, 11, 89);
  return { x, y };
}

function pathForRoute(route: TraceabilityGlobeRoute, index: number) {
  const from = project(route.fromLat, route.fromLng);
  const to = project(route.toLat, route.toLng);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - 10 - (index % 3) * 3;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${midX.toFixed(2)} ${midY.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

function statusTone(point: TraceabilityGlobePoint) {
  if ((point.risk || 0) > 0 || /risk|replay|tamper/i.test(point.status || "")) return "risk";
  if (/origin|batch/i.test(point.status || "")) return "origin";
  if (/passport|claim|owner|dpp/i.test(point.status || "")) return "passport";
  return "tap";
}

export function PremiumTraceabilityGlobe({
  title = "Mapa 3D de trazabilidad",
  subtitle = "Origen, destino, taps, riesgo y rutas en una vista ejecutiva.",
  caption = "Infraestructura visual para QR, NFC, GS1, UHF, POS y webhooks.",
  points = fallbackPoints,
  routes = fallbackRoutes,
  ctaHref,
  ctaLabel,
  className = "",
  compact = false,
  onPointSelect,
}: TraceabilityGlobeProps) {
  const safePoints = points.length ? points : fallbackPoints;
  const safeRoutes = routes.length ? routes : fallbackRoutes;
  const totalScans = safePoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const totalRisk = safePoints.reduce((acc, point) => acc + (point.risk || 0), 0);
  const regions = new Set(safePoints.map((point) => point.country || point.city)).size;

  return (
    <section className={`traceability-globe ${compact ? "traceability-globe--compact" : ""} ${className}`} aria-label={title}>
      <div className="traceability-globe__header">
        <div>
          <p>nexID Global Trust Mesh</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        <div className="traceability-globe__kpis" aria-label="Indicadores del mapa">
          <strong>{totalScans.toLocaleString("es-AR")}<small>taps</small></strong>
          <strong>{regions}<small>regiones</small></strong>
          <strong>{totalRisk}<small>riesgo</small></strong>
        </div>
      </div>

      <div className="traceability-globe__stage">
        <div className="traceability-globe__orb" aria-hidden="true">
          <span className="traceability-globe__halo traceability-globe__halo--one" />
          <span className="traceability-globe__halo traceability-globe__halo--two" />
          <span className="traceability-globe__halo traceability-globe__halo--three" />
          <span className="traceability-globe__core"><i>nexID</i><b>CORE</b></span>
          <svg viewBox="0 0 100 100" role="img" aria-label="Rutas de trazabilidad en globo">
            <defs>
              <radialGradient id="traceability-globe-water" cx="50%" cy="45%" r="54%">
                <stop offset="0%" stopColor="#0f766e" stopOpacity="0.35" />
                <stop offset="46%" stopColor="#0e7490" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.86" />
              </radialGradient>
              <linearGradient id="traceability-globe-route" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="52%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
              <linearGradient id="traceability-globe-route-warn" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#traceability-globe-water)" />
            <path className="traceability-globe__land traceability-globe__land--americas" d="M19 30 C24 22 34 20 39 28 C43 35 35 39 36 47 C37 56 45 60 40 69 C34 78 21 69 22 58 C23 48 15 43 19 30 Z" />
            <path className="traceability-globe__land traceability-globe__land--emea" d="M51 24 C62 19 76 25 78 35 C80 44 67 44 64 53 C61 63 70 67 61 73 C51 80 45 68 49 59 C53 51 45 45 48 36 C49 31 48 27 51 24 Z" />
            <path className="traceability-globe__land traceability-globe__land--south" d="M39 59 C45 63 46 75 41 86 C34 80 33 68 39 59 Z" />
            <path className="traceability-globe__grid" d="M6 50 H94 M50 6 V94 M14 31 C35 39 65 39 86 31 M14 69 C35 61 65 61 86 69 M28 11 C39 36 39 64 28 89 M72 11 C61 36 61 64 72 89" />
            {safeRoutes.map((route, index) => (
              <path
                key={`${route.fromLat}-${route.fromLng}-${route.toLat}-${route.toLng}-${index}`}
                className={`traceability-globe__route ${route.tone === "warn" ? "is-warn" : ""}`}
                d={pathForRoute(route, index)}
              />
            ))}
          </svg>
        </div>

        {safePoints.slice(0, 10).map((point, index) => {
          const projected = project(point.lat, point.lng);
          const tone = statusTone(point);
          const label = (
            <>
              <i />
              <span>{point.city}</span>
              <small>{point.vertical || point.country || "trust"}</small>
            </>
          );
          return onPointSelect ? (
            <button
              suppressHydrationWarning
              key={`${point.city}-${point.lat}-${point.lng}-${index}`}
              type="button"
              onClick={() => onPointSelect(point)}
              className={`traceability-globe__node traceability-globe__node--${tone}`}
              style={{ left: `${projected.x}%`, top: `${projected.y}%` }}
            >
              {label}
            </button>
          ) : (
            <span
              key={`${point.city}-${point.lat}-${point.lng}-${index}`}
              className={`traceability-globe__node traceability-globe__node--${tone}`}
              style={{ left: `${projected.x}%`, top: `${projected.y}%` }}
            >
              {label}
            </span>
          );
        })}

        <div className="traceability-globe__floating traceability-globe__floating--left">
          <span>Canales</span>
          <strong>QR + NFC + UHF</strong>
          <small>Una arquitectura, muchos soportes.</small>
        </div>
        <div className="traceability-globe__floating traceability-globe__floating--right">
          <span>Confianza</span>
          <strong>98.7%</strong>
          <small>Lecturas limpias en ventana demo.</small>
        </div>
      </div>

      <div className="traceability-globe__footer">
        <p>{caption}</p>
        {ctaHref && ctaLabel ? <Link href={ctaHref}>{ctaLabel}</Link> : null}
      </div>
    </section>
  );
}
