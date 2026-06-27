"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe3dMap } from "@product/ui";
import { traceabilityGlobePoints } from "../lib/platform-verticals";

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
  variant?: "default" | "hero" | "panel";
  onPointSelect?: (point: TraceabilityGlobePoint) => void;
};

const fallbackPoints: TraceabilityGlobePoint[] = [
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 4820, risk: 0, status: "origin", vertical: "wine" },
  { city: "Córdoba", country: "Argentina", lat: -31.4201, lng: -64.1888, scans: 1240, risk: 0, status: "tap", vertical: "agro" },
  { city: "São Paulo", country: "Brasil", lat: -23.5505, lng: -46.6333, scans: 2190, risk: 3, status: "risk", vertical: "events" },
  { city: "Miami", country: "Estados Unidos", lat: 25.7617, lng: -80.1918, scans: 3180, risk: 0, status: "export", vertical: "luxury" },
  { city: "Zúrich", country: "Suiza", lat: 47.3769, lng: 8.5417, scans: 980, risk: 0, status: "passport", vertical: "wine" },
  { city: "Madrid", country: "España", lat: 40.4168, lng: -3.7038, scans: 1680, risk: 0, status: "dpp", vertical: "textile" },
];

const fallbackRoutes: TraceabilityGlobeRoute[] = [
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 47.3769, toLng: 8.5417, tone: "info", label: "Exportación premium" },
  { fromLat: -31.4201, fromLng: -64.1888, toLat: -23.5505, toLng: -46.6333, tone: "warn", label: "Alerta de canal" },
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 25.7617, toLng: -80.1918, tone: "info", label: "Ruta retail" },
];

const countryFromCode: Record<string, string> = {
  AR: "Argentina",
  BR: "Brasil",
  CL: "Chile",
  ES: "España",
  FR: "Francia",
  GB: "Reino Unido",
  US: "Estados Unidos",
  UY: "Uruguay",
};

function routeDistanceKm(route: TraceabilityGlobeRoute) {
  const earthRadiusKm = 6371;
  const dLat = ((route.toLat - route.fromLat) * Math.PI) / 180;
  const dLng = ((route.toLng - route.fromLng) * Math.PI) / 180;
  const lat1 = (route.fromLat * Math.PI) / 180;
  const lat2 = (route.toLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestTracePoint(points: readonly TraceabilityGlobePoint[], lat: number, lng: number) {
  return points.reduce<{ point: TraceabilityGlobePoint | null; distance: number }>(
    (best, point) => {
      const distance = Math.hypot(point.lat - lat, point.lng - lng);
      return distance < best.distance ? { point, distance } : best;
    },
    { point: null, distance: Number.POSITIVE_INFINITY },
  ).point;
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
  variant = "default",
}: TraceabilityGlobeProps) {
  const [liveData, setLiveData] = useState<{
    points: TraceabilityGlobePoint[];
    routes: TraceabilityGlobeRoute[];
  } | null>(null);

  useEffect(() => {
    const isFallbackOrSdk = points === fallbackPoints || points === traceabilityGlobePoints;
    if (!isFallbackOrSdk) return;

    fetch("/api/demo/summary")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok && Array.isArray(data.events) && data.events.length > 0) {
          const pointsList: TraceabilityGlobePoint[] = [];
          const routesList: TraceabilityGlobeRoute[] = [];

          const getOrigin = (vertical: string) => {
            if (vertical === "agro" || vertical === "seeds") {
              return { city: "Rosario", country: "Argentina", lat: -32.9442, lng: -60.6505 };
            }
            if (vertical === "fashion" || vertical === "textile") {
              return { city: "Buenos Aires", country: "Argentina", lat: -34.5875, lng: -58.3974 };
            }
            if (vertical === "cosmetics" || vertical === "pharma") {
              return { city: "Santiago", country: "Chile", lat: -33.4489, lng: -70.6693 };
            }
            return { city: "Valle de Uco", country: "Argentina", lat: -33.6131, lng: -69.2075 };
          };

          const uniqueTaps: Record<string, any> = {};
          data.events.forEach((event: any) => {
            const lat = Number(event.lat);
            const lng = Number(event.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng) && event.city) {
              const key = `${event.city}-${event.vertical}`;
              if (!uniqueTaps[key]) {
                uniqueTaps[key] = event;
              }
            }
          });

          const activeEvents = Object.values(uniqueTaps);

          activeEvents.forEach((event: any) => {
            const origin = getOrigin(event.vertical);
            const tapLat = Number(event.lat);
            const tapLng = Number(event.lng);
            const isRisk = /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(event.result || "");

            if (!pointsList.some((p) => p.city === origin.city)) {
              pointsList.push({
                city: origin.city,
                country: origin.country,
                lat: origin.lat,
                lng: origin.lng,
                scans: 1,
                risk: 0,
                status: "origin",
                vertical: event.vertical
              });
            }

            pointsList.push({
              city: event.city,
              country: countryFromCode[String(event.country_code || "").toUpperCase()] || event.country || "",
              lat: tapLat,
              lng: tapLng,
              scans: 1,
              risk: isRisk ? 1 : 0,
              status: isRisk ? "risk" : "tap",
              vertical: event.vertical
            });

            routesList.push({
              fromLat: origin.lat,
              fromLng: origin.lng,
              toLat: tapLat,
              toLng: tapLng,
              tone: isRisk ? "warn" : "info",
              label: `${event.product_name || "Producto"} · ${origin.city} → ${event.city}`
            });
          });

          if (pointsList.length > 0) {
            setLiveData({ points: pointsList, routes: routesList });
          }
        }
      })
      .catch((err) => console.error("Error loading live globe summary:", err));
  }, [points]);

  const safePoints = liveData ? liveData.points : (points.length ? points : fallbackPoints);
  const safeRoutes = liveData ? liveData.routes : (routes.length ? routes : fallbackRoutes);
  const totalScans = safePoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const totalRisk = safePoints.reduce((acc, point) => acc + (point.risk || 0), 0);
  const regions = new Set(safePoints.map((point) => point.country || point.city)).size;
  const primaryRoute = safeRoutes[0];
  const primaryFrom = primaryRoute ? nearestTracePoint(safePoints, primaryRoute.fromLat, primaryRoute.fromLng) : null;
  const primaryTo = primaryRoute ? nearestTracePoint(safePoints, primaryRoute.toLat, primaryRoute.toLng) : null;
  const primaryDistance = primaryRoute ? Math.round(routeDistanceKm(primaryRoute)).toLocaleString("es-AR") : "";
  const globeSize =
    variant === "hero"
      ? { width: 660, height: 420 }
      : variant === "panel"
        ? { width: 620, height: 390 }
        : compact
          ? { width: 420, height: 300 }
          : { width: 720, height: 440 };

  return (
    <section
      className={`traceability-globe ${compact ? "traceability-globe--compact" : ""} traceability-globe--${variant} ${className}`}
      aria-label={title}
    >
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
            theme="dark"
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
            width={globeSize.width}
            height={globeSize.height}
            className="border-0 bg-transparent shadow-none"
          />
        </div>

        {primaryRoute ? (
          <div className="traceability-globe__routebar">
            <span>Ruta activa</span>
            <strong>
              {primaryFrom?.city || "Origen"} {"→"} {primaryTo?.city || "Tap verificado"}
            </strong>
            <small>Ruta comercial auditada - {primaryDistance} km</small>
          </div>
        ) : null}

        <div className="traceability-globe__floating traceability-globe__floating--left z-20 pointer-events-none">
          <span>Canales</span>
          <strong>QR + NFC + UHF</strong>
          <small>Una arquitectura, muchos soportes.</small>
        </div>
        <div className="traceability-globe__floating traceability-globe__floating--right z-20 pointer-events-none">
          <span>Confianza</span>
          <strong>98.7%</strong>
          <small>Lecturas limpias en ventana activa.</small>
        </div>
      </div>

      <div className="traceability-globe__footer">
        <p>{caption}</p>
        {ctaHref && ctaLabel ? <Link href={ctaHref}>{ctaLabel}</Link> : null}
      </div>
    </section>
  );
}
