"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "./card";
import { PremiumVectorMap, type VectorMapEvidenceStep, type VectorMapLedgerItem, type VectorMapPoint, type VectorMapRoute } from "./premium-vector-map";

type GeoPoint = {
  city: string;
  country?: string;
  scans?: number;
  risk?: number;
  lat: number;
  lng: number;
  vertical?: string;
  status?: string;
  source?: string;
  lastSeen?: string;
  chainCapability?: boolean;
  chainProvider?: string;
  chainStatus?: string;
  chainTxHash?: string;
};

type TimeWindowMode = "5m" | "1h" | "24h" | "all";
type MapMode = "classic" | "network";
type MapRoute = { fromLat: number; fromLng: number; toLat: number; toLng: number; label?: string; tone?: "info" | "warn" };

function parseEventTime(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compactDateTime(value?: string) {
  if (!value) return "sin fecha";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function coordinateKey(lat: number, lng: number) {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

export function WorldMapRealtime({
  title = "Cobertura de eventos reportados",
  subtitle = "Mapa de lecturas reportadas, señales de riesgo y cobertura multi-tenant; no certifica recorridos físicos.",
  points = [],
  routes = [],
  onPointSelect,
  metadataRows,
  initialExpanded = false,
}: {
  title?: string;
  subtitle?: string;
  points?: GeoPoint[];
  onPointSelect?: (point: GeoPoint) => void;
  metadataRows?: (point: GeoPoint) => Array<{ label: string; value: string }>;
  routes?: MapRoute[];
  initialExpanded?: boolean;
}) {
  const [timeWindowMode, setTimeWindowMode] = useState<TimeWindowMode>("all");
  const [expanded, setExpanded] = useState(initialExpanded);
  const [mapMode, setMapMode] = useState<MapMode>("classic");
  const [riskOnly, setRiskOnly] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const cutoffMs =
    timeWindowMode === "5m"
      ? now - 5 * 60 * 1000
      : timeWindowMode === "1h"
      ? now - 60 * 60 * 1000
      : timeWindowMode === "24h"
      ? now - 24 * 60 * 60 * 1000
      : 0;

  const windowedPoints = useMemo(
    () => points.filter((point) => {
      if (timeWindowMode === "all") return true;
      const eventTime = parseEventTime(point.lastSeen);
      return eventTime !== null && eventTime >= cutoffMs;
    }),
    [points, timeWindowMode, cutoffMs]
  );

  const rankedPoints = useMemo(() => {
    const filtered = riskOnly ? windowedPoints.filter((point) => (point.risk || 0) > 0) : windowedPoints;
    return [...filtered].sort((a, b) => (b.scans || 0) - (a.scans || 0));
  }, [windowedPoints, riskOnly]);

  useEffect(() => {
    if (!rankedPoints.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > rankedPoints.length - 1) setActiveIndex(0);
  }, [rankedPoints, activeIndex]);

  const activePoint = rankedPoints[activeIndex] || null;
  const mappedPoints = useMemo(() => rankedPoints.slice(0, 120), [rankedPoints]);
  const totalScans = mappedPoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const riskSignals = mappedPoints.reduce((acc, point) => acc + (point.risk || 0), 0);
  const visibleRoutes = useMemo<MapRoute[]>(() => {
    const visibleCoordinates = new Set(mappedPoints.map((point) => coordinateKey(point.lat, point.lng)));
    return routes.filter((route) => visibleCoordinates.has(coordinateKey(route.fromLat, route.fromLng))
      && visibleCoordinates.has(coordinateKey(route.toLat, route.toLng))).slice(0, 120);
  }, [mappedPoints, routes]);
  const vectorPoints = useMemo<VectorMapPoint[]>(() => mappedPoints.map((point, index) => ({
    id: `${point.city}-${point.country || "xx"}-${point.lat.toFixed(4)}-${point.lng.toFixed(4)}-${index}`,
    label: point.city,
    sublabel: point.country,
    lat: point.lat,
    lng: point.lng,
    scans: point.scans ?? 0,
    risk: point.risk ?? 0,
    tone: (point.risk ?? 0) > 0 ? "risk" : index === activeIndex ? "tap" : "hub",
  })), [activeIndex, mappedPoints]);
  const vectorRoutes = useMemo<VectorMapRoute[]>(() => visibleRoutes.map((route, index) => ({
    id: `world-route-${index}-${route.fromLat}-${route.toLng}`,
    fromLat: route.fromLat,
    fromLng: route.fromLng,
    toLat: route.toLat,
    toLng: route.toLng,
    label: route.label,
    tone: route.tone === "warn" ? "warn" : "info",
  })), [visibleRoutes]);
  const confirmedChainSignals = rankedPoints.filter((point) =>
    /CONFIRMED|FINALIZED/i.test(point.chainStatus || "")
    && Boolean(point.chainProvider?.trim())
    && Boolean(point.chainTxHash?.trim())
  ).length;
  const chainCapabilitySignals = rankedPoints.filter((point) => point.chainCapability === true).length;
  const mapEvidenceSteps = useMemo<VectorMapEvidenceStep[]>(() => {
    const firstPoint = rankedPoints[rankedPoints.length - 1] || activePoint;
    return [
      {
        id: "origin",
        label: "Referencia inicial",
        value: firstPoint ? `${firstPoint.city}, ${firstPoint.country || "--"}` : "sin origen",
        detail: firstPoint?.vertical || "Primer punto reportado disponible; no implica origen físico",
        tone: "origin",
      },
      {
        id: "tap",
        label: "Evento seleccionado",
        value: activePoint ? `${activePoint.city}, ${activePoint.country || "--"}` : "sin tap",
        detail: activePoint ? `${activePoint.scans || 0} lecturas · ${compactDateTime(activePoint.lastSeen)}` : "Esperando actividad",
        tone: activePoint && (activePoint.risk || 0) > 0 ? "risk" : "tap",
      },
      {
        id: "token",
        label: "Prueba blockchain",
        value: confirmedChainSignals
          ? `${confirmedChainSignals} confirmadas`
          : chainCapabilitySignals
            ? "capacidad declarada"
            : "sin evidencia",
        detail: confirmedChainSignals
          ? "Confirmada solo cuando el evento incluye provider y hash de transacción"
          : chainCapabilitySignals
            ? "Capacidad reportada; no equivale a una transacción confirmada"
            : "No se reportó provider, hash ni estado finalizado",
        tone: "token",
      },
      {
        id: "loyalty",
        label: "Valor comercial",
        value: `${totalScans.toLocaleString("es-AR")} eventos`,
        detail: "Garantia, marketplace, recompra y CRM post-tap",
        tone: riskSignals > 0 ? "risk" : "loyalty",
      },
    ];
  }, [activePoint, chainCapabilitySignals, confirmedChainSignals, rankedPoints, riskSignals, totalScans]);
  const mapLedgerItems = useMemo<VectorMapLedgerItem[]>(() => [
    { id: "routes", label: "Relaciones", value: String(visibleRoutes.length), detail: "configuradas explícitamente; no son recorridos físicos", tone: "origin" },
    { id: "risk", label: "Riesgo", value: String(riskSignals), detail: "tamper/replay", tone: riskSignals > 0 ? "risk" : "loyalty" },
    {
      id: "chain",
      label: "Blockchain",
      value: confirmedChainSignals ? `${confirmedChainSignals} confirmadas` : "no confirmada",
      detail: confirmedChainSignals ? "provider + hash + estado finalizado" : "sin evidencia transaccional suficiente",
      tone: "token",
    },
  ], [confirmedChainSignals, riskSignals, visibleRoutes.length]);
  const selectedVectorPointId = vectorPoints[activeIndex]?.id || vectorPoints[0]?.id;
  const emptyStateText = riskOnly
    ? "No hay ubicaciones con señales de riesgo para la ventana seleccionada. Desactivá Solo riesgo o ampliá el período."
    : "No hay ubicaciones geolocalizadas para el período seleccionado. Generá lecturas reales o ampliá el período.";

  return (
    <Card className="worldmap-card relative overflow-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">eventos reportados</div>
          <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-slate-300">{hydrated ? new Date(now).toLocaleTimeString("es-AR") : "--:--:--"}</div>
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">{totalScans.toLocaleString()} lecturas</div>
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-rose-100">{riskSignals.toLocaleString()} señales de riesgo</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {(["5m", "1h", "24h", "all"] as TimeWindowMode[]).map((windowMode) => (
          <button suppressHydrationWarning key={windowMode} type="button" aria-pressed={timeWindowMode === windowMode} onClick={() => setTimeWindowMode(windowMode)} className={`min-h-11 rounded-lg border px-3 py-2 ${timeWindowMode === windowMode ? "border-indigo-300/40 bg-indigo-500/15 text-indigo-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
            {windowMode === "all" ? "Todo el período" : `Últimos ${windowMode}`}
          </button>
        ))}
        <button suppressHydrationWarning type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className="min-h-11 rounded-lg border border-indigo-300/30 bg-indigo-500/10 px-3 py-2 text-indigo-100">
          {expanded ? "Vista compacta" : "Ampliar mapa"}
        </button>
        <button suppressHydrationWarning type="button" aria-pressed={mapMode === "classic"} aria-label={mapMode === "classic" ? "Vista actual: mapa de calor. Cambiar a relaciones" : "Vista actual: relaciones. Cambiar a mapa de calor"} onClick={() => setMapMode((prev) => (prev === "classic" ? "network" : "classic"))} className="min-h-11 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">
          {mapMode === "classic" ? "Vista: calor" : "Vista: relaciones"}
        </button>
        <button suppressHydrationWarning type="button" aria-pressed={riskOnly} onClick={() => setRiskOnly((prev) => !prev)} className={`min-h-11 rounded-lg border px-3 py-2 ${riskOnly ? "border-rose-300/35 bg-rose-500/15 text-rose-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
          {riskOnly ? "Solo riesgo: activo" : "Solo riesgo"}
        </button>
      </div>

      {activePoint ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <PremiumVectorMap
            title={mapMode === "classic" ? "Mapa de calor de lecturas reportadas" : "Relaciones de trazabilidad reportadas"}
            subtitle={mapMode === "classic" ? "La intensidad usa una escala estable de volumen; las señales de riesgo se muestran por separado." : "Relaciones configuradas y riesgo sin inferir movimiento físico."}
            caption="Lecturas, señales de riesgo y ubicaciones reportadas por los eventos visibles; no prueba recorridos físicos."
            points={vectorPoints}
            routes={vectorRoutes}
            selectedPointId={selectedVectorPointId}
            density={mapMode === "classic" ? "heat" : "route"}
            maxPoints={120}
            maxRoutes={120}
            heightClassName={expanded ? "h-[34rem]" : "h-[24rem]"}
            evidenceSteps={mapEvidenceSteps}
            ledgerItems={mapLedgerItems}
            onPointSelect={(point) => {
              const nextIndex = vectorPoints.findIndex((item) => item.id === point.id);
              if (nextIndex >= 0) {
                setActiveIndex(nextIndex);
                onPointSelect?.(rankedPoints[nextIndex]);
              }
            }}
          />
          <div className={`${expanded ? "h-[34rem]" : "h-[24rem]"} space-y-2 overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-2`}>
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-slate-200">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200">Historia del mapa</p>
              <p className="mt-1 font-semibold text-white">{activePoint.city}, {activePoint.country || "--"}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {activePoint.scans || 0} lecturas, {riskSignals} señales de riesgo y {visibleRoutes.length} relaciones explícitas. Las líneas visuales no prueban un recorrido físico.
              </p>
            </div>
            {rankedPoints.slice(0, 30).map((point, index) => (
              <button suppressHydrationWarning
                key={`${point.city}-${point.country || "--"}-${point.lat}-${point.lng}-${index}`}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  onPointSelect?.(point);
                }}
                className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${index === activeIndex ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}
              >
                <p className="font-semibold">{point.city}, {point.country || "--"}</p>
                <p>Lecturas: {point.scans || 0} · Riesgo: {point.risk || 0}</p>
                <p className="text-[11px] opacity-80">({point.lat.toFixed(4)}, {point.lng.toFixed(4)})</p>
                {point.lastSeen ? <p className="text-[11px] opacity-80">Última señal: {point.lastSeen}</p> : null}
                {(metadataRows?.(point) || []).map((row) => (
                  <p key={row.label} className="text-[11px] opacity-75">{row.label}: {row.value}</p>
                ))}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          {emptyStateText}
        </div>
      )}
    </Card>
  );
}
