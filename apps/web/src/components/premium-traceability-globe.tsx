"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PremiumVectorMap,
  type VectorMapPoint,
  type VectorMapRoute,
} from "@product/ui/premium-vector-map";
import {
  describeTraceabilityMapTruth,
  resolveTraceabilityMapTruth,
  type TraceabilityMapTruthState,
} from "../lib/traceability-map-truth";

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
  coordinateSource?: string;
  accuracyM?: number | null;
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
  /**
   * Kept for API compatibility with older callers. Caller-provided coordinates
   * have no source contract, so this public surface never renders them as facts.
   */
  points?: readonly TraceabilityGlobePoint[];
  routes?: readonly TraceabilityGlobeRoute[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  compact?: boolean;
  mapSize?: { width: number; height: number };
  variant?: "default" | "hero" | "panel";
  onPointSelect?: (point: TraceabilityGlobePoint) => void;
};

type SummaryRecord = Record<string, unknown>;

type ObservedMapFeed = {
  points: VectorMapPoint[];
  routes: VectorMapRoute[];
  truthState: Extract<TraceabilityMapTruthState, "recorded_events" | "public_evidence">;
};

const DURABLE_ORIGIN_SOURCES = new Set([
  "batch_config",
  "tenant_config",
  "manufacturer_record",
  "supplier_manifest",
  "declared_origin",
]);

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

function asRecord(value: unknown): SummaryRecord | null {
  return value !== null && typeof value === "object" ? value as SummaryRecord : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

function coordinateEvidence(source: string, accuracyM: number | null) {
  if (source === "city_centroid") return "Centroide de ciudad aproximado · derivado del evento registrado";
  if (source === "browser_gps") return `GPS reportado por el dispositivo${accuracyM !== null ? ` · precisión ±${Math.round(accuracyM)} m` : ""}`;
  return `Coordenada reportada por el evento · fuente ${source}`;
}

function routeDistanceKm(route: VectorMapRoute) {
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

function nearestMapPoint(points: readonly VectorMapPoint[], lat: number, lng: number) {
  return points.reduce<{ point: VectorMapPoint | null; distance: number }>(
    (best, point) => {
      const distance = Math.hypot(point.lat - lat, point.lng - lng);
      return distance < best.distance ? { point, distance } : best;
    },
    { point: null, distance: Number.POSITIVE_INFINITY },
  ).point;
}

function eventStableId(event: SummaryRecord, fallback: string) {
  return textValue(event.id)
    || textValue(event.event_id)
    || textValue(event.tap_id)
    || fallback;
}

function buildObservedMapFeed(payload: unknown): ObservedMapFeed | null {
  const summary = asRecord(payload);
  if (!summary || summary.ok !== true || !Array.isArray(summary.events)) return null;

  const events = summary.events.map(asRecord).filter((event): event is SummaryRecord => event !== null);
  const truthState = resolveTraceabilityMapTruth({
    degraded: summary.degraded === true,
    source: textValue(summary.source),
    events,
    evidenceVerified: summary.evidenceVerified === true,
    evidenceUrl: textValue(summary.evidenceUrl),
  });
  if (truthState !== "recorded_events" && truthState !== "public_evidence") return null;

  const pointIndex = new Map<string, VectorMapPoint>();
  const routeIndex = new Map<string, VectorMapRoute>();

  events.forEach((event, index) => {
    const lat = finiteCoordinate(event.lat, -90, 90);
    const lng = finiteCoordinate(event.lng, -180, 180);
    const city = textValue(event.city);
    const coordinateSource = textValue(event.coordinate_source).toLowerCase();

    // Coordinates without a declared source are not treated as observed geography.
    if (lat === null || lng === null || !city || !coordinateSource || coordinateSource === "not_reported") return;

    const accuracyRaw = Number(event.coordinate_accuracy_m);
    const accuracyM = Number.isFinite(accuracyRaw) && accuracyRaw >= 0 ? accuracyRaw : null;
    const result = textValue(event.result);
    const isRisk = /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(result);
    const countryCode = textValue(event.country_code).toUpperCase();
    const country = countryFromCode[countryCode] || textValue(event.country) || "País no reportado";
    const vertical = textValue(event.vertical) || "Producto";
    const pointKey = `tap:${lat.toFixed(6)}:${lng.toFixed(6)}:${vertical}`;
    const previousPoint = pointIndex.get(pointKey);
    const pointId = previousPoint?.id || eventStableId(event, `event-${index + 1}-${pointKey}`);

    pointIndex.set(pointKey, {
      id: pointId,
      label: city,
      sublabel: `${country} · ${vertical}`,
      lat,
      lng,
      scans: (previousPoint?.scans || 0) + 1,
      risk: (previousPoint?.risk || 0) + (isRisk ? 1 : 0),
      tone: isRisk || Number(previousPoint?.risk || 0) > 0 ? "risk" : "tap",
      stageLabel: isRisk ? "Señal de riesgo reportada" : "Tap registrado",
      evidence: coordinateEvidence(coordinateSource, accuracyM),
      lastSeen: textValue(event.occurred_at) || textValue(event.created_at) || textValue(event.timestamp) || previousPoint?.lastSeen,
    });

    const originLat = finiteCoordinate(event.origin_lat, -90, 90);
    const originLng = finiteCoordinate(event.origin_lng, -180, 180);
    const originSource = textValue(event.origin_source).toLowerCase();
    const hasDurableOrigin = originLat !== null
      && originLng !== null
      && DURABLE_ORIGIN_SOURCES.has(originSource);

    if (!hasDurableOrigin) return;

    const originCity = textValue(event.origin_city) || "Origen declarado";
    const originCountry = textValue(event.origin_country) || "País no reportado";
    const originKey = `origin:${originLat.toFixed(6)}:${originLng.toFixed(6)}:${originSource}`;
    if (!pointIndex.has(originKey)) {
      pointIndex.set(originKey, {
        id: originKey,
        label: originCity,
        sublabel: `${originCountry} · origen declarado`,
        lat: originLat,
        lng: originLng,
        scans: 0,
        risk: 0,
        tone: "origin",
        stageLabel: "Origen declarado",
        evidence: `Coordenada de origen declarada · fuente ${originSource}`,
      });
    }

    const routeKey = `${originKey}->${pointKey}`;
    if (!routeIndex.has(routeKey)) {
      routeIndex.set(routeKey, {
        id: routeKey,
        fromLat: originLat,
        fromLng: originLng,
        toLat: lat,
        toLng: lng,
        label: `${originCity} → ${city}`,
        tone: isRisk ? "warn" : "info",
        evidence: "Relación entre origen declarado y tap registrado; no prueba traslado, custodia ni recorrido físico.",
      });
    }
  });

  const points = Array.from(pointIndex.values());
  if (points.length === 0) return null;

  return {
    points,
    routes: Array.from(routeIndex.values()),
    truthState,
  };
}

function toPublicPoint(point: VectorMapPoint): TraceabilityGlobePoint {
  return {
    city: point.label,
    country: point.sublabel,
    lat: point.lat,
    lng: point.lng,
    scans: point.scans,
    risk: point.risk,
    status: point.tone,
    lastSeen: point.lastSeen,
  };
}

export function PremiumTraceabilityGlobe({
  title = "Mapa geográfico de trazabilidad",
  subtitle = "Ubicaciones reportadas y relaciones declaradas en una vista basada en evidencia.",
  caption = "Cada punto conserva su fuente. Las líneas conectan hechos declarados; no representan un recorrido físico ni prueban custodia.",
  points: callerPoints = [],
  routes: callerRoutes = [],
  ctaHref,
  ctaLabel,
  className = "",
  compact = false,
  mapSize,
  variant = "default",
  onPointSelect,
}: TraceabilityGlobeProps) {
  const [feedStatus, setFeedStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [observedFeed, setObservedFeed] = useState<ObservedMapFeed | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/demo/summary", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`summary_http_${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const nextFeed = buildObservedMapFeed(payload);
        setObservedFeed(nextFeed);
        setFeedStatus(nextFeed ? "ready" : "unavailable");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load observed map summary", error);
        setObservedFeed(null);
        setFeedStatus("unavailable");
      });

    return () => controller.abort();
  }, []);

  const truthState: TraceabilityMapTruthState = observedFeed?.truthState || "unavailable";
  const truthCopy = describeTraceabilityMapTruth(truthState);
  const hasObservedGeography = Boolean(observedFeed);
  const safePoints = observedFeed?.points || [];
  const safeRoutes = observedFeed?.routes || [];
  const totalScans = safePoints.reduce((total, point) => total + Math.max(0, Number(point.scans || 0)), 0);
  const totalRisk = safePoints.reduce((total, point) => total + Math.max(0, Number(point.risk || 0)), 0);
  const regions = new Set(safePoints.filter((point) => point.tone !== "origin").map((point) => point.sublabel || point.label)).size;
  const primaryRoute = safeRoutes[0];
  const primaryFrom = primaryRoute ? nearestMapPoint(safePoints, primaryRoute.fromLat, primaryRoute.fromLng) : null;
  const primaryTo = primaryRoute ? nearestMapPoint(safePoints, primaryRoute.toLat, primaryRoute.toLng) : null;
  const primaryDistance = primaryRoute ? Math.round(routeDistanceKm(primaryRoute)).toLocaleString("es-AR") : "";
  const defaultMapSize = variant === "hero"
    ? compact ? { width: 580, height: 300 } : { width: 720, height: 390 }
    : variant === "panel" ? { width: 760, height: 420 }
      : compact ? { width: 620, height: 310 } : { width: 880, height: 440 };
  const renderedMapSize = mapSize || defaultMapSize;
  const callerScenarioIgnored = callerPoints.length > 0 || callerRoutes.length > 0;
  const mapCaption = `${caption} Fuente: ${truthCopy.sourceLabel}.`;
  const handlePointSelect = useMemo(
    () => onPointSelect ? (point: VectorMapPoint) => onPointSelect(toPublicPoint(point)) : undefined,
    [onPointSelect],
  );

  return (
    <section
      className={`traceability-globe ${compact ? "traceability-globe--compact" : ""} traceability-globe--${variant} ${className}`}
      aria-label={`${title}. ${hasObservedGeography ? truthCopy.sourceLabel : "Sin feed geográfico observado"}`}
      data-geographic-truth={truthState}
      data-geographic-feed-status={feedStatus}
      data-geographic-renderer={hasObservedGeography ? "maplibre-gl" : "none"}
      data-caller-geography={callerScenarioIgnored ? "unverified-ignored" : "none"}
    >
      <div className="traceability-globe__header">
        <div>
          <p>{hasObservedGeography ? "Mapa geográfico real" : "Geografía no disponible"} · {truthCopy.badge}</p>
          <h2>{title}</h2>
          <span>{hasObservedGeography ? `${subtitle} · ${truthCopy.sourceLabel}` : "No se dibujan ubicaciones, rutas ni calor sin coordenadas observadas y una fuente declarada."}</span>
        </div>
        <div className="traceability-globe__kpis" aria-label="Indicadores geográficos observados">
          <strong>{hasObservedGeography ? totalScans.toLocaleString("es-AR") : "—"}<small>{hasObservedGeography ? truthCopy.metricLabel : "sin volumen observado"}</small></strong>
          <strong>{hasObservedGeography ? regions : "—"}<small>{hasObservedGeography ? "zonas reportadas" : "sin zonas observadas"}</small></strong>
          <strong>{hasObservedGeography ? totalRisk : "—"}<small>{hasObservedGeography ? "señales reportadas" : "sin riesgo geolocalizado"}</small></strong>
        </div>
      </div>

      <div className="traceability-globe__stage">
        {hasObservedGeography ? (
          <div
            className="traceability-globe__map-shell"
            style={{ maxWidth: renderedMapSize.width, height: renderedMapSize.height }}
          >
            <PremiumVectorMap
              points={safePoints}
              routes={safeRoutes}
              title="Geografía observada"
              subtitle="Ubicaciones registradas sobre cartografía real. Las conexiones no prueban un traslado físico."
              caption={mapCaption}
              heightClassName="h-full min-h-[15rem]"
              density={totalScans >= 8 ? "heat" : "balanced"}
              chrome="minimal"
              ariaLabel={`${title}. ${safePoints.length} ubicaciones con fuente declarada y ${safeRoutes.length} relaciones declaradas.`}
              onPointSelect={handlePointSelect}
            />
          </div>
        ) : (
          <div className="traceability-globe__no-geography" role="status" aria-live="polite">
            <span>{feedStatus === "loading" ? "Consultando eventos geolocalizados" : "Sin datos geográficos observados"}</span>
            <strong>{feedStatus === "loading" ? "Preparando MapLibre con datos basados en evidencia…" : "El mapa queda cerrado hasta recibir coordenadas válidas y con fuente."}</strong>
            <p>No usamos puntos, rutas, continentes ni zonas de calor de ejemplo como si fueran telemetría.</p>
          </div>
        )}

        {hasObservedGeography && primaryRoute ? (
          <div className="traceability-globe__routebar">
            <span>{truthCopy.badge}</span>
            <strong>{primaryFrom?.label || "Origen declarado"} {"→"} {primaryTo?.label || truthCopy.pointLabel}</strong>
            <small>Relación declarada · distancia geodésica {primaryDistance} km · no es un recorrido observado</small>
          </div>
        ) : null}

        <div className="traceability-globe__floating traceability-globe__floating--left">
          <span>Renderer</span>
          <strong>{hasObservedGeography ? "MapLibre GL" : "Sin mapa"}</strong>
          <small>{hasObservedGeography ? "Cartografía real y controles interactivos." : "La vista falla cerrado sin datos."}</small>
        </div>
        <div className="traceability-globe__floating traceability-globe__floating--right">
          <span>Fuente</span>
          <strong>{hasObservedGeography ? truthCopy.badge : "SIN GEOGRAFÍA"}</strong>
          <small>{hasObservedGeography ? truthCopy.sourceLabel : "Esperando coordenadas observadas"}.</small>
        </div>
      </div>

      <div className="traceability-globe__footer">
        <p>{caption}</p>
        {ctaHref && ctaLabel ? <Link href={ctaHref}>{ctaLabel}</Link> : null}
      </div>
    </section>
  );
}
