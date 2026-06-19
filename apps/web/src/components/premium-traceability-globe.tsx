import Link from "next/link";
import { Globe3dMap } from "@product/ui";

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

      <div className="traceability-globe__stage flex justify-center items-center relative min-h-[350px]">
        <div className="absolute inset-0 flex justify-center items-center z-10 pointer-events-auto">
          <Globe3dMap
            points={safePoints.map((p) => ({
              city: p.city,
              country: p.country,
              lat: p.lat,
              lng: p.lng,
              scans: p.scans,
              risk: p.risk,
              status: p.status,
              vertical: p.vertical,
            }))}
            routes={safeRoutes.map((r) => ({
              fromLat: r.fromLat,
              fromLng: r.fromLng,
              toLat: r.toLat,
              toLng: r.toLng,
              tone: r.tone === "warn" ? ("warn" as const) : ("info" as const),
              label: r.label,
            }))}
            width={450}
            height={350}
            className="border-0 bg-transparent shadow-none"
          />
        </div>

        <div className="traceability-globe__floating traceability-globe__floating--left z-20 pointer-events-none">
          <span>Canales</span>
          <strong>QR + NFC + UHF</strong>
          <small>Una arquitectura, muchos soportes.</small>
        </div>
        <div className="traceability-globe__floating traceability-globe__floating--right z-20 pointer-events-none">
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
