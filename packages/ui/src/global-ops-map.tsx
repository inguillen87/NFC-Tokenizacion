"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "./card";
import { PremiumVectorMap, type VectorMapEvidenceStep, type VectorMapLedgerItem, type VectorMapPoint, type VectorMapRoute } from "./premium-vector-map";

export type GlobalOpsPoint = {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  scans: number;
  risk: number;
  verdict: string;
  tenantSlug: string;
  lastSeen?: string;
  uid?: string;
  device?: string;
  role?: "origin" | "tap" | "hub";
  productName?: string;
  /** Only an explicit consented-browser source is eligible for consumer map rendering. */
  locationSource?: string;
  /** Approximate horizontal uncertainty in metres. */
  locationAccuracyM?: number | null;
  /** Backwards-compatible input alias; normalized to locationAccuracyM before rendering. */
  accuracyM?: number | null;
};

export type GlobalOpsRoute = {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  uid: string;
  risk: number;
  taps: number;
  firstSeenAt: string;
  lastSeenAt: string;
  fromLabel?: string;
  toLabel?: string;
  productName?: string;
};

type Mode = "tenant" | "global" | "demo";
type TimeWindow = "1h" | "24h" | "7d" | "all";
type MapView = "events" | "intensity";
const CONSENTED_CONSUMER_LOCATION_SOURCES = new Set([
  "browser_geolocation_approximate_consent",
  "browser_gps_approximate_consent",
]);

export function isConsentedConsumerLocation(point: GlobalOpsPoint) {
  return CONSENTED_CONSUMER_LOCATION_SOURCES.has(String(point.locationSource || "").toLowerCase())
    && point.role !== "origin"
    && Number.isFinite(point.lat)
    && Number.isFinite(point.lng)
    && point.lat >= -90
    && point.lat <= 90
    && point.lng >= -180
    && point.lng <= 180;
}

function toMs(value?: string) {
  if (!value) return 0;
  const n = Date.parse(value);
  return Number.isNaN(n) ? 0 : n;
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const radiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  if (!Number.isFinite(km)) return "n/a";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: km >= 100 ? 0 : 1 }).format(km)} km`;
}

function mapLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function roleLabel(role?: GlobalOpsPoint["role"]) {
  if (role === "origin") return "Origen producto";
  if (role === "tap") return "Tap cliente";
  return "Hub operativo";
}

export function GlobalOpsMap({
  title = "Global Ops Map",
  subtitle = "Origen del producto, tap del cliente, distancia estimada y riesgo.",
  points,
  routes,
  mode,
  selectedPointId,
  onPointSelect,
  playbackEnabled,
  riskOnly,
  chrome = "full",
  initialView,
  allowViewToggle,
  sourceLabel,
  locationNote,
  externalTiles = true,
}: {
  title?: string;
  subtitle?: string;
  points: GlobalOpsPoint[];
  routes: GlobalOpsRoute[];
  mode: Mode;
  selectedPointId?: string;
  onPointSelect?: (point: GlobalOpsPoint) => void;
  playbackEnabled?: boolean;
  riskOnly?: boolean;
  chrome?: "full" | "compact" | "consumer";
  initialView?: MapView;
  allowViewToggle?: boolean;
  sourceLabel?: string;
  locationNote?: string;
  externalTiles?: boolean;
}) {
  const isConsumerChrome = chrome === "consumer";
  const [tenant, setTenant] = useState("ALL");
  const [country, setCountry] = useState("ALL");
  const [windowMode, setWindowMode] = useState<TimeWindow>(mode === "demo" || chrome === "compact" ? "all" : "24h");
  const [verdict, setVerdict] = useState("ALL");
  const [localRiskOnly, setLocalRiskOnly] = useState(Boolean(riskOnly));
  const [playback, setPlayback] = useState(Boolean(playbackEnabled));
  const [progress, setProgress] = useState(100);
  const [internalSelectedId, setInternalSelectedId] = useState(selectedPointId || "");
  const [nowMs, setNowMs] = useState(0);
  const [fitRevision, setFitRevision] = useState(0);
  const [mapView, setMapView] = useState<MapView>(initialView || (mode === "global" ? "intensity" : "events"));

  useEffect(() => setNowMs(Date.now()), []);
  useEffect(() => setInternalSelectedId(selectedPointId || ""), [selectedPointId]);
  useEffect(() => setLocalRiskOnly(Boolean(riskOnly)), [riskOnly]);
  useEffect(() => {
    setMapView(initialView || (mode === "global" ? "intensity" : "events"));
  }, [initialView, mode]);

  useEffect(() => {
    if (!playback) return;
    const id = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 20 : prev + 10));
    }, 900);
    return () => clearInterval(id);
  }, [playback]);

  const cutoff = isConsumerChrome || !nowMs ? 0 : windowMode === "1h" ? nowMs - 3600_000 : windowMode === "24h" ? nowMs - 24 * 3600_000 : windowMode === "7d" ? nowMs - 7 * 24 * 3600_000 : 0;

  const tenants = useMemo(() => ["ALL", ...Array.from(new Set(points.map((p) => p.tenantSlug))).filter(Boolean).sort()], [points]);
  const countries = useMemo(() => ["ALL", ...Array.from(new Set(points.map((p) => p.country))).filter(Boolean).sort()], [points]);
  const verdicts = useMemo(() => ["ALL", ...Array.from(new Set(points.map((p) => p.verdict))).filter(Boolean).sort()], [points]);

  const consumerPoints = useMemo(() => points
    .filter(isConsentedConsumerLocation)
    .sort((left, right) => toMs(right.lastSeen) - toMs(left.lastSeen))
    .slice(0, 1), [points]);

  const basePoints = useMemo(() => (isConsumerChrome ? consumerPoints : points).filter((point) => {
    const ts = toMs(point.lastSeen);
    const tenantMatch = tenant === "ALL" ? true : point.tenantSlug === tenant;
    const countryMatch = country === "ALL" ? true : point.country === country;
    const verdictMatch = verdict === "ALL" ? true : point.verdict === verdict;
    const timeMatch = point.role === "origin" ? true : cutoff === 0 ? true : ts >= cutoff;
    const riskMatch = localRiskOnly ? point.risk > 0 : true;
    return tenantMatch && countryMatch && verdictMatch && timeMatch && riskMatch;
  }), [consumerPoints, country, cutoff, isConsumerChrome, localRiskOnly, points, tenant, verdict]);

  const clusteredPoints = useMemo(() => {
    if (basePoints.length <= 80) return basePoints;
    const bins = new Map<string, GlobalOpsPoint>();
    for (const point of basePoints) {
      const key = `${Math.round(point.lat * 2) / 2}:${Math.round(point.lng * 2) / 2}`;
      const current = bins.get(key);
      if (!current) {
        bins.set(key, { ...point, id: `cluster-${key}`, city: `${point.city} cluster`, scans: point.scans, risk: point.risk });
      } else {
        current.scans += point.scans;
        current.risk += point.risk;
      }
    }
    return Array.from(bins.values());
  }, [basePoints]);

  const visiblePoints = useMemo(() => clusteredPoints, [clusteredPoints]);

  const filteredRoutes = useMemo(() => {
    if (isConsumerChrome) return [];
    const filtered = routes
      .filter((route) => {
        if (localRiskOnly && route.risk <= 0) return false;
        const routeTime = toMs(route.lastSeenAt);
        if (cutoff && routeTime && routeTime < cutoff) return false;
        return true;
      })
      .sort((a, b) => toMs(a.lastSeenAt) - toMs(b.lastSeenAt));
    const max = mode === "global" ? 140 : 80;
    return filtered.slice(-max);
  }, [cutoff, isConsumerChrome, localRiskOnly, mode, routes]);

  const visibleRoutes = useMemo(() => {
    if (!playback) return filteredRoutes;
    const limit = Math.max(1, Math.floor((progress / 100) * filteredRoutes.length));
    return filteredRoutes.slice(0, limit);
  }, [filteredRoutes, playback, progress]);

  const selectedPoint = visiblePoints.find((point) => point.id === internalSelectedId) || visiblePoints[0] || null;
  const selectedJourney = useMemo(() => {
    if (!selectedPoint) return null;
    const byUid = selectedPoint.uid ? visibleRoutes.find((route) => route.uid === selectedPoint.uid) : null;
    const byCoordinates = visibleRoutes.find((route) => {
      const startsHere = Math.abs(route.fromLat - selectedPoint.lat) < 0.001 && Math.abs(route.fromLng - selectedPoint.lng) < 0.001;
      const endsHere = Math.abs(route.toLat - selectedPoint.lat) < 0.001 && Math.abs(route.toLng - selectedPoint.lng) < 0.001;
      return startsHere || endsHere;
    });
    const route = byUid || byCoordinates;
    if (!route) return null;
    const fromPoint = visiblePoints.find((point) => point.uid === route.uid && point.role === "origin")
      || visiblePoints.find((point) => Math.abs(point.lat - route.fromLat) < 0.001 && Math.abs(point.lng - route.fromLng) < 0.001);
    const toPoint = visiblePoints.find((point) => point.uid === route.uid && point.role === "tap")
      || visiblePoints.find((point) => Math.abs(point.lat - route.toLat) < 0.001 && Math.abs(point.lng - route.toLng) < 0.001);
    return {
      ...route,
      fromPoint,
      toPoint,
      distanceKm: haversineKm(route.fromLat, route.fromLng, route.toLat, route.toLng),
    };
  }, [selectedPoint, visiblePoints, visibleRoutes]);
  const vectorPoints = useMemo<VectorMapPoint[]>(() => visiblePoints.map((point) => ({
    id: point.id,
    label: point.city,
    sublabel: `${point.country}${point.productName ? ` / ${point.productName}` : ""}`,
    lat: point.lat,
    lng: point.lng,
    scans: point.scans,
    risk: point.risk,
    tone: point.role === "origin" ? "origin" : point.role === "tap" ? "tap" : point.risk > 0 ? "risk" : /TOKEN|MINT|CLAIM/i.test(point.verdict) ? "token" : "hub",
    evidence: isConsumerChrome ? "Ubicación aproximada compartida con permiso desde este dispositivo" : undefined,
    locationSource: point.locationSource,
    locationAccuracyM: point.locationAccuracyM ?? point.accuracyM ?? undefined,
  })), [isConsumerChrome, visiblePoints]);
  const vectorRoutes = useMemo<VectorMapRoute[]>(() => visibleRoutes.map((route) => ({
    id: route.id,
    fromLat: route.fromLat,
    fromLng: route.fromLng,
    toLat: route.toLat,
    toLng: route.toLng,
    label: route.productName || route.uid,
    tone: route.risk > 0 ? "warn" : "info",
    distanceLabel: formatDistance(haversineKm(route.fromLat, route.fromLng, route.toLat, route.toLng)),
    evidence: `${route.fromLabel || "Origen"} -> ${route.toLabel || "tap"} · ${route.taps} taps`,
  })), [visibleRoutes]);
  const tokenizedPointCount = visiblePoints.filter((point) => /TOKEN|MINT|CLAIM|NFT/i.test(`${point.verdict} ${point.productName || ""}`)).length;
  const mapEvidenceSteps = useMemo<VectorMapEvidenceStep[]>(() => [
    {
      id: "origin",
      label: "Origen",
      value: selectedJourney?.fromLabel || selectedJourney?.fromPoint?.city || selectedPoint?.city || "Sin origen",
      detail: selectedJourney?.productName || selectedPoint?.productName || "Lote y producto seleccionados",
      tone: "origin",
    },
    {
      id: "tap",
      label: "Tap cliente",
      value: selectedJourney?.toLabel || (selectedPoint ? `${selectedPoint.city || "Tap"}, ${selectedPoint.country || "--"}` : "Sin tap"),
      detail: selectedPoint ? `${selectedPoint.scans} lecturas · ${selectedPoint.verdict}` : "Seleccione un punto",
      tone: selectedPoint && selectedPoint.risk > 0 ? "risk" : "tap",
    },
    {
      id: "token",
      label: "NFT / ownership",
      value: tokenizedPointCount ? `${tokenizedPointCount} senales` : "sin evidencia",
      detail: tokenizedPointCount
        ? (selectedPoint?.uid ? `UID ${selectedPoint.uid}` : "Señal tokenizada registrada")
        : "No hay señal TOKEN/MINT/CLAIM/NFT en este scope",
      tone: "token",
    },
    {
      id: "commercial",
      label: "Capa comercial",
      value: "portal + marketplace",
      detail: "Garantia, fidelizacion, recompra y CRM post-tap",
      tone: "marketplace",
    },
  ], [selectedJourney, selectedPoint, tokenizedPointCount]);
  const mapLedgerItems = useMemo<VectorMapLedgerItem[]>(() => [
    { id: "distance", label: "Dist", value: selectedJourney ? formatDistance(selectedJourney.distanceKm) : "n/a", tone: "origin" },
    { id: "taps", label: "Taps", value: selectedJourney ? String(selectedJourney.taps) : String(visiblePoints.reduce((sum, point) => sum + point.scans, 0)), tone: "tap" },
    { id: "risk", label: "Risk", value: String(visiblePoints.filter((point) => point.risk > 0).length), tone: visiblePoints.some((point) => point.risk > 0) ? "risk" : "loyalty" },
    { id: "nft", label: "NFT", value: tokenizedPointCount ? "activo" : "sandbox", tone: "token" },
  ], [selectedJourney, tokenizedPointCount, visiblePoints]);
  const kpiCountries = new Set(visiblePoints.map((point) => point.country)).size;
  const replayTamper = visiblePoints.filter((point) => ["REPLAY_SUSPECT", "DUPLICATE", "TAMPER", "TAMPERED"].includes(point.verdict)).length;

  const fallbackRows = visiblePoints.slice(0, 12);

  const centerOperationalMap = () => {
    setFitRevision((value) => value + 1);
  };

  const isDemoMode = mode === "demo";
  const isCompactChrome = chrome === "compact";
  const usesCompactFrame = isCompactChrome || isConsumerChrome;
  const totalScans = visiblePoints.reduce((sum, point) => sum + point.scans, 0);
  const riskyPoints = visiblePoints.filter((point) => point.risk > 0);
  const observedLocationCount = visiblePoints.filter((point) => point.role !== "origin").length;
  const intensityPoints = visiblePoints.filter((point) => point.role !== "origin" && Number(point.scans || 0) > 0);
  const hasVisibleOrigin = visiblePoints.some((point) => point.role === "origin");
  const canShowIntensity = intensityPoints.length >= 2;
  const canToggleMapView = (allowViewToggle ?? mode === "global") && canShowIntensity;
  const effectiveMapView: MapView = mapView === "intensity" && canShowIntensity ? "intensity" : "events";
  const firstVisibleRoute = visibleRoutes[0] || null;
  const originPoint = selectedJourney?.fromPoint || visiblePoints.find((point) => point.role === "origin") || null;
  const tapPoint = selectedJourney?.toPoint || visiblePoints.find((point) => point.role === "tap") || selectedPoint;
  const originLabel = selectedJourney?.fromLabel || (originPoint ? `${originPoint.city}, ${originPoint.country}` : "Origen");
  const tapLabel = selectedJourney?.toLabel || (tapPoint ? `${tapPoint.city}, ${tapPoint.country}` : "Tap cliente");
  const shortOriginLabel = originLabel.split(",")[0] || "Origen";
  const shortTapLabel = tapLabel.split(",")[0] || "Tap";
  const demoDistanceLabel = selectedJourney
    ? formatDistance(selectedJourney.distanceKm)
    : firstVisibleRoute
      ? formatDistance(haversineKm(firstVisibleRoute.fromLat, firstVisibleRoute.fromLng, firstVisibleRoute.toLat, firstVisibleRoute.toLng))
      : "n/a";
  const demoProductName = selectedJourney?.productName || selectedPoint?.productName || visiblePoints.find((point) => point.productName)?.productName || "Escenario sin producto confirmado";
  const demoRiskLabel = replayTamper > 0 ? "replay/tamper" : riskyPoints.length ? "riesgo activo" : "ruta limpia";
  const consumerPoint = visiblePoints[0] || null;
  const consumerAccuracy = consumerPoint?.locationAccuracyM ?? consumerPoint?.accuracyM;
  const consumerAccuracyText = Number.isFinite(Number(consumerAccuracy)) && Number(consumerAccuracy) > 0
    ? `Margen aproximado: ${Math.round(Math.max(150, Number(consumerAccuracy)))} m.`
    : "Precisión no informada.";

  return (
    <Card
      className={`worldmap-card global-ops-map-card overflow-hidden ${usesCompactFrame ? "p-2 md:p-3" : "p-4 md:p-6"}`}
      data-global-map-chrome={chrome}
      data-consumer-location-source={isConsumerChrome ? consumerPoint?.locationSource : undefined}
      data-consumer-location-accuracy-m={isConsumerChrome && Number.isFinite(Number(consumerAccuracy)) ? Number(consumerAccuracy) : undefined}
    >
      {isCompactChrome ? (
        <div className="global-ops-map-compact-header mb-2 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/55 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{subtitle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
              {sourceLabel ? <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">{sourceLabel}</span> : null}
              {locationNote ? <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-emerald-100">{locationNote}</span> : null}
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-200">{observedLocationCount} ubicaciones observadas</span>
            </div>
          </div>
          {canToggleMapView ? (
            <div className="inline-grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Vista del mapa">
              <button suppressHydrationWarning type="button" aria-pressed={effectiveMapView === "events"} onClick={() => setMapView("events")} className={`min-h-11 rounded-lg px-3 py-2 text-[11px] font-bold ${effectiveMapView === "events" ? "bg-white text-slate-900 shadow-sm" : "text-slate-200"}`}>Eventos</button>
              <button suppressHydrationWarning type="button" aria-pressed={effectiveMapView === "intensity"} onClick={() => setMapView("intensity")} className={`min-h-11 rounded-lg px-3 py-2 text-[11px] font-bold ${effectiveMapView === "intensity" ? "bg-cyan-400 text-slate-950 shadow-sm" : "text-slate-200"}`}>Intensidad</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!usesCompactFrame ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{isDemoMode ? title : `${title} - mapa del scope nexID`}</p>
          <p className="text-xs text-slate-400">
            {isDemoMode ? subtitle : `${subtitle} (${mode}) - mapa interactivo.`}
          </p>
        </div>
        <div className="global-ops-map-stats grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
          {isDemoMode ? (
            <>
              <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-emerald-100">Ruta: <b>{shortOriginLabel} - {shortTapLabel}</b></div>
              <div className="rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">Distancia: <b>{demoDistanceLabel}</b></div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">Eventos: <b>{totalScans}</b></div>
              <div className="rounded-lg border border-violet-300/25 bg-violet-500/10 px-2 py-1 text-violet-100">Estado: <b>{demoRiskLabel}</b></div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">Nodos: <b>{visiblePoints.length}</b></div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">Regiones: <b>{kpiCountries}</b></div>
              <div className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-2 py-1 text-rose-100">Riesgo: <b>{riskyPoints.length}</b></div>
              <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-amber-100">Replay/tamper: <b>{replayTamper}</b></div>
            </>
          )}
        </div>
      </div>
      ) : null}

      {!isDemoMode && !usesCompactFrame && canToggleMapView ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <p className="text-[11px] text-slate-300">Eventos muestra cada ubicación reportada. Intensidad compara volumen sin mezclarlo con riesgo.</p>
          <div className="inline-grid grid-cols-2 rounded-lg border border-white/10 bg-slate-950/60 p-1" role="group" aria-label="Vista del mapa">
            <button suppressHydrationWarning type="button" aria-pressed={effectiveMapView === "events"} onClick={() => setMapView("events")} className={`min-h-11 rounded-md px-3 py-2 text-xs ${effectiveMapView === "events" ? "bg-white text-slate-900" : "text-slate-200"}`}>Eventos</button>
            <button suppressHydrationWarning type="button" aria-pressed={effectiveMapView === "intensity"} onClick={() => setMapView("intensity")} className={`min-h-11 rounded-md px-3 py-2 text-xs ${effectiveMapView === "intensity" ? "bg-cyan-400 text-slate-950" : "text-slate-200"}`}>Intensidad</button>
          </div>
        </div>
      ) : null}

      {isDemoMode && !usesCompactFrame ? (
        <div className="global-ops-map-story mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">01 origen</p>
            <p className="mt-1 text-sm font-semibold text-white">{originLabel}</p>
            <p className="mt-1 text-[11px] text-emerald-100/80">Origen declarado o ilustrativo según la fuente visible del mapa.</p>
          </div>
          <div className="hidden w-10 items-center justify-center text-cyan-200 md:flex">--</div>
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">02 tap simulado</p>
            <p className="mt-1 text-sm font-semibold text-white">{tapLabel}</p>
            <p className="mt-1 text-[11px] text-cyan-100/80">Paso ilustrativo: lectura, SUN, TT y ubicación cuentan solo cuando la fuente los aporta.</p>
          </div>
          <div className="hidden w-10 items-center justify-center text-violet-200 md:flex">--</div>
          <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">03 ownership</p>
            <p className="mt-1 text-sm font-semibold text-white">{demoProductName}</p>
            <p className="mt-1 text-[11px] text-violet-100/80">Solicitud sujeta a identidad, compra y política; el tap no transfiere propiedad automáticamente.</p>
          </div>
        </div>
      ) : null}

      <div className={isDemoMode || usesCompactFrame ? "hidden" : "global-ops-map-controls mt-3 grid gap-2 md:grid-cols-7"}>
        <select suppressHydrationWarning aria-label="Filtrar por organización" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" value={tenant} onChange={(event) => setTenant(event.target.value)}>
          {tenants.map((item) => <option key={item} value={item}>{item === "ALL" ? "Tenant: todos" : item}</option>)}
        </select>
        <select suppressHydrationWarning aria-label="Filtrar por país" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" value={country} onChange={(event) => setCountry(event.target.value)}>
          {countries.map((item) => <option key={item} value={item}>{item === "ALL" ? "País: todos" : item}</option>)}
        </select>
        <select suppressHydrationWarning aria-label="Filtrar por período" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" value={windowMode} onChange={(event) => setWindowMode(event.target.value as TimeWindow)}>
          <option value="1h">Última hora</option>
          <option value="24h">Últimas 24 horas</option>
          <option value="7d">Últimos 7 días</option>
          <option value="all">Todo el período</option>
        </select>
        <select suppressHydrationWarning aria-label="Filtrar por resultado" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" value={verdict} onChange={(event) => setVerdict(event.target.value)}>
          {verdicts.map((item) => <option key={item} value={item}>{item === "ALL" ? "Estado: todos" : item}</option>)}
        </select>
        <button suppressHydrationWarning type="button" aria-pressed={localRiskOnly} onClick={() => setLocalRiskOnly((v) => !v)} className={`min-h-11 rounded-xl border px-3 py-2 text-xs ${localRiskOnly ? "border-rose-300/30 bg-rose-500/10 text-rose-100" : "border-white/10 bg-white/5 text-slate-200"}`}>{localRiskOnly ? "Solo riesgo: activo" : "Mostrar solo riesgo"}</button>
        <button suppressHydrationWarning type="button" aria-pressed={playback} onClick={() => setPlayback((value) => !value)} className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">{playback ? "Pausar recorrido" : "Animar recorrido"}</button>
        <button suppressHydrationWarning type="button" onClick={centerOperationalMap} className="min-h-11 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">Centrar mapa</button>
      </div>

      <div className={`global-ops-map-layout grid gap-3 ${usesCompactFrame ? "mt-0" : "mt-3"} ${isDemoMode || usesCompactFrame ? "" : "lg:grid-cols-[1fr_22rem]"}`}>
        <div className={`global-ops-map-stage overflow-hidden rounded-xl border ${isConsumerChrome ? "border-cyan-900/10 bg-slate-50" : "border-white/10 bg-[linear-gradient(90deg,rgba(125,211,252,.055)_1px,transparent_1px),linear-gradient(rgba(125,211,252,.055)_1px,transparent_1px),linear-gradient(160deg,#020617,#0f172a,#111827)] bg-[length:4.5rem_4.5rem,4.5rem_4.5rem,auto]"}`}>
          <div className={`global-ops-map-canvas relative ${isConsumerChrome ? "h-[18rem] sm:h-[20rem]" : isCompactChrome ? "h-[26rem]" : isDemoMode ? "h-[24rem] md:h-[31rem]" : "h-[29rem]"}`}>
            <PremiumVectorMap
              key={`global-ops-map-${fitRevision}`}
              title={isConsumerChrome ? "Ubicación aproximada del teléfono" : isDemoMode ? "Escenario geográfico simulado" : effectiveMapView === "intensity" ? "Intensidad de eventos reportados" : "Mapa de eventos reportados"}
              subtitle={isConsumerChrome ? `Compartida con tu permiso para este tap. ${consumerAccuracyText}` : isDemoMode ? `${shortOriginLabel} -> ${shortTapLabel}: origen declarado y tap simulado; la línea no prueba una ruta física.` : effectiveMapView === "intensity" ? "El color representa volumen por ubicación observada; el origen declarado y el riesgo se muestran por separado." : "Ubicaciones aportadas por eventos; no representan por sí solas recorrido ni custodia física."}
              caption={isConsumerChrome ? undefined : isDemoMode
                ? "SUN, TT, claim y capa comercial se muestran como una historia demo gobernada por policy."
                : `${sourceLabel ? `${sourceLabel}. ` : ""}${hasVisibleOrigin ? "El origen declarado se muestra como referencia y no suma intensidad. " : ""}Eventos reportados y riesgo en una vista operativa honesta.`}
              points={vectorPoints}
              routes={isConsumerChrome ? [] : vectorRoutes}
              selectedPointId={selectedPoint?.id}
              density={isConsumerChrome ? "route" : isDemoMode ? "route" : effectiveMapView === "intensity" ? "heat" : "route"}
              chrome={isConsumerChrome ? "consumer" : isCompactChrome ? "minimal" : isDemoMode ? "minimal" : "compact"}
              className="h-full rounded-none border-0 shadow-none"
              heightClassName="h-full"
              maxPoints={isConsumerChrome ? 1 : isDemoMode ? 28 : mode === "global" ? 120 : 64}
              maxRoutes={isConsumerChrome ? 0 : isDemoMode ? 18 : mode === "global" ? 120 : 72}
              evidenceSteps={isConsumerChrome ? [] : mapEvidenceSteps}
              ledgerItems={isConsumerChrome ? [] : mapLedgerItems}
              ariaLabel={isConsumerChrome ? `Ubicación aproximada compartida por este teléfono. ${consumerAccuracyText}` : `${title}. ${subtitle}${locationNote ? ` ${locationNote}.` : ""}`}
              externalTiles={externalTiles}
              onPointSelect={(point) => {
                const selected = visiblePoints.find((item) => item.id === point.id);
                if (!selected) return;
                setInternalSelectedId(selected.id);
                onPointSelect?.(selected);
              }}
            />
            {!isConsumerChrome ? <div className="global-ops-map-caption absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300">
              {isDemoMode ? `Conexión ilustrativa ${originLabel} -> ${tapLabel}. ${demoDistanceLabel} con datos geográficos y comerciales simulados; no prueba desplazamiento físico.` : `Relaciones entre eventos reportados, señales de riesgo y clusters (${visibleRoutes.length} conexiones renderizadas); no prueban recorridos ni custodia física.`}
            </div> : null}
          </div>
        </div>

        {isDemoMode ? (
          <aside className="global-ops-map-demo-drawer grid gap-3 rounded-xl border border-cyan-300/15 bg-slate-950/62 p-3 text-xs text-slate-200 md:grid-cols-3">
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Tap seleccionado</p>
              <p className="mt-1 text-sm font-semibold text-white">{tapLabel}</p>
              <p className="mt-2 text-slate-300">UID: <b>{selectedPoint?.uid || selectedJourney?.uid || "n/a"}</b></p>
              <p className="text-slate-300">Estado: <b>{selectedPoint?.verdict || "VALID"}</b></p>
              {tapPoint ? (
                <a href={mapLink(tapPoint.lat, tapPoint.lng)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/20">
                  Abrir ubicación del tap
                </a>
              ) : null}
            </div>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">Ruta del escenario</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-emerald-100">{shortOriginLabel}</span>
                <span className="text-slate-500">--</span>
                <span className="rounded-lg bg-cyan-400/10 px-2 py-1 text-cyan-100">{shortTapLabel}</span>
              </div>
              <p className="mt-3 text-2xl font-black text-white">{demoDistanceLabel}</p>
              <p className="text-[11px] text-slate-300">Origen, distancia y acción quedan unidos al evento ilustrativo del producto.</p>
            </div>
            <div className="rounded-lg border border-violet-300/20 bg-violet-500/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">Después del tap</p>
              <p className="mt-1 text-sm font-semibold text-white">Propiedad opcional + certificado + marketplace</p>
              <p className="mt-2 text-slate-300">El usuario puede iniciar una solicitud de propiedad, vincular una wallet o activar garantía, club y reventa sólo cuando la política y la compra lo permitan.</p>
              <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-[11px] text-slate-200">Riesgo: <b>{demoRiskLabel}</b></p>
            </div>
          </aside>
        ) : null}

        {!isDemoMode && !usesCompactFrame ? (
        <aside className="global-ops-map-drawer h-[29rem] overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Detalle del punto</p>
          {selectedPoint ? (
            <div className="global-ops-map-selected mt-2 space-y-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 p-3">
              <p className="font-semibold text-cyan-100">{selectedPoint.city}, {selectedPoint.country}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{roleLabel(selectedPoint.role)}</p>
              {selectedPoint.productName ? <p>Producto: <b>{selectedPoint.productName}</b></p> : null}
              <p>UID: <b>{selectedPoint.uid || "n/a"}</b></p>
              <p>Tenant: <b>{selectedPoint.tenantSlug || "n/a"}</b></p>
              <p>Último evento: <b>{selectedPoint.lastSeen || "n/a"}</b></p>
              <p>Device: <b>{selectedPoint.device || "n/a"}</b></p>
              <a href={mapLink(selectedPoint.lat, selectedPoint.lng)} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/20">
                Abrir ubicacion
              </a>
              <p>Risk: <b>{selectedPoint.risk}</b> · Verdict: <b>{selectedPoint.verdict}</b></p>
            </div>
          ) : <p className="mt-2 text-slate-400">Seleccioná un punto para ver detalle.</p>}

          {selectedJourney ? (
            <div className="global-ops-map-journey mt-3 space-y-3 rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">Origen a tap del cliente</p>
                <p className="mt-1 font-semibold text-white">{selectedJourney.productName || selectedPoint?.productName || selectedJourney.uid}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px]">
                <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-emerald-100">{selectedJourney.fromLabel || `${selectedJourney.fromPoint?.city || "Origin"}, ${selectedJourney.fromPoint?.country || "--"}`}</span>
                <span className="text-slate-500">--</span>
                <span className="rounded-lg bg-cyan-400/10 px-2 py-1 text-cyan-100">{selectedJourney.toLabel || `${selectedJourney.toPoint?.city || "Tap"}, ${selectedJourney.toPoint?.country || "--"}`}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Distancia</p>
                  <p className="text-lg font-semibold text-emerald-100">{formatDistance(selectedJourney.distanceKm)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Taps</p>
                  <p className="text-lg font-semibold text-cyan-100">{selectedJourney.taps}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <a href={mapLink(selectedJourney.fromLat, selectedJourney.fromLng)} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/30 px-2 py-1 text-center font-semibold text-emerald-100 hover:bg-emerald-400/10">
                  Ver origen
                </a>
                <a href={mapLink(selectedJourney.toLat, selectedJourney.toLng)} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/30 px-2 py-1 text-center font-semibold text-cyan-100 hover:bg-cyan-400/10">
                  Ver tap
                </a>
              </div>
              <p className="text-[11px] text-slate-400">Primer tap: {selectedJourney.firstSeenAt || "n/a"} - ultimo tap: {selectedJourney.lastSeenAt || "n/a"}</p>
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {fallbackRows.map((point) => (
              <button suppressHydrationWarning key={point.id} type="button" onClick={() => {
                setInternalSelectedId(point.id);
                onPointSelect?.(point);
              }} className={`global-ops-map-row w-full rounded-lg border px-2 py-2 text-left ${selectedPoint?.id === point.id ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/10 bg-slate-900/70"}`}>
                <p className="font-semibold">{point.city}, {point.country}</p>
                <p className="text-[11px] text-slate-300">{roleLabel(point.role)}{point.productName ? ` - ${point.productName}` : ""}</p>
                <p className="text-[11px] text-slate-400">scans {point.scans} · risk {point.risk} · {point.tenantSlug || "--"}</p>
              </button>
            ))}
            {!fallbackRows.length ? <p className="text-slate-400">Sin datos para los filtros seleccionados.</p> : null}
          </div>
        </aside>
        ) : null}
      </div>

      {isDemoMode ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <button suppressHydrationWarning type="button" onClick={() => setPlayback((value) => !value)} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 font-semibold text-cyan-100">{playback ? "Pausar ruta" : "Reproducir ruta"}</button>
          <button suppressHydrationWarning type="button" onClick={centerOperationalMap} className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-100">Reencuadrar</button>
          <span>La vista demo evita filtros tecnicos para vender la historia del producto.</span>
        </div>
      ) : !usesCompactFrame ? (
        <div className="mt-3">
          <input suppressHydrationWarning type="range" min={10} max={100} step={10} value={progress} onChange={(event) => setProgress(Number(event.target.value))} className="w-full" />
        </div>
      ) : null}
    </Card>
  );
}
