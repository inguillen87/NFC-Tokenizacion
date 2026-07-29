"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Badge } from "@product/ui";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DemoOpsMap } from "./demo-ops-map";
import {
  classifyRealtimeVerdict,
  isRealtimeRisk,
  mergeRealtimeEvents,
  sortRealtimeEvents,
  type TenantTapRealtimeEvent,
} from "../lib/realtime-feed";
import { strictCoordinatePair } from "../lib/geo-coordinates";
import { exportToCsv } from "../lib/export-utils";
import { Maximize2, Minimize2, Clock, Terminal, Volume2, VolumeX, Activity, Globe, MapPin, Radio, Target } from "lucide-react";

type MapMode = "tenant" | "global";

type Labels = {
  liveFeed: string;
  mission: string;
  mapTitle: string;
  mapSubtitle: string;
};

function isClientReportedGps(value?: string | null) {
  const source = String(value || "").trim().toLowerCase();
  const approximate = source.includes("approximate") || source.includes("city") || source.includes("centroid") || source.includes("ip_") || source.includes("synthetic") || source.includes("fallback");
  return !approximate && source.includes("gps");
}

function locationSourceLabel(row: TenantTapRealtimeEvent) {
  const source = String(row.locationSource || "").toLowerCase();
  if (isClientReportedGps(source)) {
    return row.locationAccuracyM
      ? `GPS reportado por cliente (+/-${Math.round(row.locationAccuracyM)}m); no verificacion independiente`
      : "GPS reportado por cliente; no verificacion independiente";
  }
  if (source === "ip_geo") return "IP aproximada";
  if (source.includes("error") || source.includes("denied")) return "GPS no autorizado";
  return strictCoordinatePair(row.lat, row.lng) ? "Coordenada reportada" : "Sin coordenadas reportadas";
}

function deviceSummary(row: TenantTapRealtimeEvent) {
  const parts = [
    row.deviceLabel,
    row.deviceOs,
    row.deviceType,
  ].map((item) => String(item || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" - ") : "Dispositivo sin clasificar";
}

function toMapPoint(row: TenantTapRealtimeEvent) {
  const city = String(row.city || "Unknown");
  const country = String(row.country || "--");
  const coordinate = strictCoordinatePair(row.lat, row.lng);
  const lat = coordinate?.lat ?? Number.NaN;
  const lng = coordinate?.lng ?? Number.NaN;
  const result = String(row.verdict || "UNKNOWN").toUpperCase();
  return {
    city,
    country,
    lat,
    lng,
    scans: 1,
    risk: isRealtimeRisk(result, row.reason) ? 1 : 0,
    status: result,
    source: String(row.source || "production"),
    lastSeen: String(row.occurredAt || ""),
    tenantSlug: row.tenantSlug || undefined,
    uid: row.uidMasked,
    device: `${deviceSummary(row)} - ${locationSourceLabel(row)}${row.timezoneLabel ? ` - ${row.timezoneLabel}` : ""}`,
  };
}

type OpsMapPoint = ReturnType<typeof toMapPoint>;

type CityHotspot = {
  key: string;
  city: string;
  country: string;
  taps: number;
  risk: number;
  unknown: number;
  gps: number;
  lastSeen: string;
  lastSeenMs: number;
  lastUid: string;
  device: string;
};

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 10) / 10}%`;
}

const crmTooltipStyle = {
  backgroundColor: "rgba(2, 6, 23, 0.96)",
  border: "1px solid rgba(34, 211, 238, 0.24)",
  borderRadius: "10px",
  color: "#f8fafc",
  boxShadow: "0 18px 50px rgba(0,0,0,.45)",
  fontSize: "12px",
};

function aggregateHeatmapPoints(rows: TenantTapRealtimeEvent[]) {
  const buckets = new Map<string, OpsMapPoint & { latestMs: number }>();
  rows.forEach((row) => {
    const point = toMapPoint(row);
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
    const key = [
      point.tenantSlug || "global",
      point.city.toLowerCase(),
      point.country.toUpperCase(),
      point.lat.toFixed(3),
      point.lng.toFixed(3),
    ].join("|");
    const at = Date.parse(point.lastSeen);
    const latestMs = Number.isFinite(at) ? at : 0;
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, { ...point, scans: 1, risk: point.risk > 0 ? 1 : 0, latestMs });
      return;
    }
    current.scans += 1;
    current.risk += point.risk > 0 ? 1 : 0;
    if (latestMs >= current.latestMs) {
      current.latestMs = latestMs;
      current.lastSeen = point.lastSeen;
      current.uid = point.uid;
      current.status = point.status;
      current.device = point.device;
      current.source = point.source;
    }
  });
  return [...buckets.values()]
    .sort((a, b) => b.latestMs - a.latestMs || b.scans - a.scans)
    .map(({ latestMs: _latestMs, ...point }) => ({
      ...point,
      status: point.risk > 0 ? "RISK" : point.status,
    }))
    .slice(0, 40);
}

function buildCityHotspots(rows: TenantTapRealtimeEvent[]) {
  const buckets = new Map<string, CityHotspot>();
  rows.forEach((row) => {
    const city = String(row.city || "Unknown");
    const country = String(row.country || "--");
    const key = `${city.toLowerCase()}|${country.toUpperCase()}`;
    const at = Date.parse(String(row.occurredAt || ""));
    const lastSeenMs = Number.isFinite(at) ? at : 0;
    const current = buckets.get(key) || {
      key,
      city,
      country,
      taps: 0,
      risk: 0,
      unknown: 0,
      gps: 0,
      lastSeen: String(row.occurredAt || ""),
      lastSeenMs,
      lastUid: String(row.uidMasked || "N/A"),
      device: deviceSummary(row),
    };
    current.taps += 1;
    if (isRealtimeRisk(row.verdict, row.reason)) current.risk += 1;
    if (classifyRealtimeVerdict(row.verdict, row.reason) === "unknown") current.unknown += 1;
    if (isClientReportedGps(row.locationSource)) current.gps += 1;
    if (lastSeenMs >= current.lastSeenMs) {
      current.lastSeen = String(row.occurredAt || current.lastSeen);
      current.lastSeenMs = lastSeenMs;
      current.lastUid = String(row.uidMasked || current.lastUid);
      current.device = deviceSummary(row);
    }
    buckets.set(key, current);
  });
  return [...buckets.values()]
    .sort((a, b) => b.taps - a.taps || b.lastSeenMs - a.lastSeenMs)
    .slice(0, 6);
}

function playPing(type: "success" | "warning") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch {
    // blocked or not supported
  }
}

export function RealtimeOpsMonitor({
  initialEvents,
  tenantScope,
  mode,
  labels,
}: {
  initialEvents: TenantTapRealtimeEvent[];
  tenantScope: string;
  mode: MapMode;
  labels: Labels;
}) {
  const [events, setEvents] = useState<TenantTapRealtimeEvent[]>(initialEvents);
  const [hydrated, setHydrated] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<string>(initialEvents[0]?.occurredAt || "");
  const [latestEventId, setLatestEventId] = useState<string>("");
  const [selectedTenant, setSelectedTenant] = useState<string>("all");

  const [isFullscreenOps, setIsFullscreenOps] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [timeStr, setTimeStr] = useState("");

  const audioEnabledRef = useRef(audioEnabled);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const [aiReport, setAiReport] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const generateAiInsights = () => {
    const visible = selectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === selectedTenant);
    if (!visible.length) {
      setAiReport("Sin eventos reales en el stream activo. Primer paso: hacer 1 tap NFC fresco del tenant y confirmar que aparezca en mapa, feed y analytics.");
      return;
    }
    setAiAnalyzing(true);
    setTimeout(() => {
      const total = visible.length;
      const valid = visible.filter((item) => classifyRealtimeVerdict(item.verdict, item.reason) === "valid").length;
      const risk = visible.filter((item) => isRealtimeRisk(item.verdict, item.reason)).length;
      const unknown = visible.filter((item) => classifyRealtimeVerdict(item.verdict, item.reason) === "unknown").length;
      const ratio = total > 0 ? (risk / total) * 100 : 0;
      const uids = new Set(visible.map((item) => item.uidMasked)).size;
      const cities = new Set(visible.map((item) => item.city || "Unknown")).size;
      const gps = visible.filter((item) => isClientReportedGps(item.locationSource)).length;
      const repeatedInterest = uids > 0 ? total / uids : 0;
      const latest = visible[0];

      let diagnosis = "Evidencia digital sin alertas de replay/tamper en el feed visible.";
      let recommendation = "Convertir el interés: mostrar oferta de club, marketplace y puntos después de cada mensaje NFC válido.";

      if (ratio > 15) {
        diagnosis = "Riesgo alto: demasiados resultados replay, tamper o INVALID en la ventana actual.";
        recommendation = "Abrir eventos filtrados por riesgo, revisar UID/lote y bloquear acciones comerciales si el ratio supera 15%.";
      } else if (unknown > 0) {
        diagnosis = `${unknown} eventos estan sin clasificar, NOT_REGISTERED o NOT_ACTIVE; requieren revision operativa pero no se cuentan como fraude.`;
        recommendation = "Revisar registro y activacion de lote/tag sin elevar esos estados a alerta de riesgo.";
      } else if (repeatedInterest > 3) {
        diagnosis = "Interés repetido: los mismos productos se están escaneando varias veces.";
        recommendation = "Ofrecer puntos extra, cata guiada o descuento si el usuario deja contacto voluntario.";
      } else if (gps / Math.max(total, 1) < 0.25) {
        diagnosis = "Buena calidad de mensajes NFC según la evidencia digital disponible, pero baja cobertura de GPS reportado por cliente.";
        recommendation = "Pedir permiso de ubicación en mobile tap y marcar IP/ciudad como aproximada.";
      }

      setAiReport(`Operación: ${total} lecturas, ${uids} UIDs, ${cities} ciudades, ${gps} con GPS reportado por cliente y ${unknown} sin clasificar/lifecycle.
Calidad del feed: ${total ? ((valid / total) * 100).toFixed(1) : "0.0"}% de mensajes NFC con veredicto válido; no implica autenticidad física. Riesgo explícito: ${ratio.toFixed(1)}%.
Diagnóstico: ${diagnosis}
Acción recomendada: ${recommendation}
Último evento: ${latest?.uidMasked || "N/A"} - ${latest?.occurredAtLocal || latest?.occurredAt || "sin hora"} - ${latest ? locationSourceLabel(latest) : "sin ubicación"}.`);
      setAiAnalyzing(false);
    }, 600);
  };
  const handleExportCsv = () => {
    const visible = selectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === selectedTenant);
    const dataToExport = visible.map((e) => ({
      ID_Evento: e.eventId,
      Tenant: e.tenantSlug || "N/A",
      Lote: e.batchId || "N/A",
      Tag_UID_Enmascarado: e.uidMasked,
      Fecha_Local: e.occurredAtLocal || (e.occurredAt ? new Date(e.occurredAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "N/A"),
      Zona_Horaria: e.timezoneLabel || e.timezone || "N/A",
      Fecha_UTC_Auditoria: e.occurredAtUtc || e.occurredAt || "N/A",
      Veredicto: String(e.verdict || "").toUpperCase(),
      Clasificacion_nexID: classifyRealtimeVerdict(e.verdict, e.reason),
      Riesgo_Explicito: isRealtimeRisk(e.verdict, e.reason) ? "SI" : "NO",
      Riesgo_Reportado_Upstream: String(e.riskLevel || "N/A").toUpperCase(),
      Ciudad: e.city || "Geolocalización pendiente",
      Pais: e.country || "--",
      Latitud: e.lat ?? "",
      Longitud: e.lng ?? "",
      Fuente_Ubicacion: locationSourceLabel(e),
      Precision_Metros: e.locationAccuracyM || "",
      Dispositivo: e.deviceLabel || "N/A",
      Sistema_Operativo: e.deviceOs || "N/A",
      Tipo_Dispositivo: e.deviceType || "N/A",
      Producto: e.productName || "N/A",
      Entorno: e.source
    }));
    exportToCsv(
      `nexid-taps-${selectedTenant}-${new Date().toISOString().slice(0, 10)}`,
      dataToExport,
      [
        { key: "ID_Evento", label: "ID Evento" },
        { key: "Tenant", label: "Tenant" },
        { key: "Lote", label: "Lote" },
        { key: "Tag_UID_Enmascarado", label: "Tag UID Enmascarado" },
        { key: "Fecha_Local", label: "Fecha y Hora Local" },
        { key: "Zona_Horaria", label: "Zona Horaria" },
        { key: "Fecha_UTC_Auditoria", label: "Fecha UTC Auditoría" },
        { key: "Veredicto", label: "Veredicto" },
        { key: "Clasificacion_nexID", label: "Clasificacion nexID" },
        { key: "Riesgo_Explicito", label: "Riesgo explicito" },
        { key: "Riesgo_Reportado_Upstream", label: "Riesgo reportado upstream" },
        { key: "Ciudad", label: "Ciudad" },
        { key: "Pais", label: "País" },
        { key: "Latitud", label: "Latitud" },
        { key: "Longitud", label: "Longitud" },
        { key: "Fuente_Ubicacion", label: "Fuente ubicación" },
        { key: "Precision_Metros", label: "Precisión GPS m" },
        { key: "Dispositivo", label: "Dispositivo" },
        { key: "Sistema_Operativo", label: "Sistema Operativo" },
        { key: "Tipo_Dispositivo", label: "Tipo Dispositivo" },
        { key: "Producto", label: "Producto" },
        { key: "Entorno", label: "Entorno" }
      ]
    );
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const openControlCenter = () => setIsFullscreenOps(true);
    window.addEventListener("nexid:open-control-center", openControlCenter);
    return () => window.removeEventListener("nexid:open-control-center", openControlCenter);
  }, []);

  useEffect(() => {
    if (hydrated) {
      generateAiInsights();
    }
  }, [hydrated, events, selectedTenant]);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString("es-AR"));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const streamUrl = new URL("/api/admin/events/stream", window.location.origin);
    streamUrl.searchParams.set("limit", "40");
    streamUrl.searchParams.set("range", "24h");
    streamUrl.searchParams.set("source", "all");
    if (tenantScope) streamUrl.searchParams.set("tenant", tenantScope);
    const source = new EventSource(streamUrl.toString());

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { rows?: TenantTapRealtimeEvent[] };
        if (Array.isArray(payload.rows)) {
          const incomingRows = payload.rows as TenantTapRealtimeEvent[];
          const incomingFirst = sortRealtimeEvents(incomingRows, 1)[0];
          const incomingId = incomingFirst ? String((incomingFirst as TenantTapRealtimeEvent).eventId || "") : "";
          if (incomingId && incomingId !== latestEventId) setLatestEventId(incomingId);
          setEvents((prevEvents) => sortRealtimeEvents([...incomingRows, ...prevEvents], 40));
          setLastUpdateAt(new Date().toISOString());
        }
      } catch {
        // ignore malformed chunk and keep previous state
      }
    };
    source.addEventListener("snapshot", onSnapshot as EventListener);

    const onEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as TenantTapRealtimeEvent;
        if (payload) {
          const incomingId = String(payload.eventId || "");
          setLatestEventId((prev) => {
            if (incomingId && incomingId !== prev) {
              setEvents((prevEvents) => mergeRealtimeEvents(prevEvents, payload, 40));
              setLastUpdateAt(new Date().toISOString());

              // Audio chime
              const verdictBucket = classifyRealtimeVerdict(payload.verdict, payload.reason);
              if (audioEnabledRef.current) {
                if (verdictBucket === "valid") playPing("success");
                else if (isRealtimeRisk(payload.verdict, payload.reason)) playPing("warning");
              }

              return incomingId;
            }
            return prev;
          });
        }
      } catch {
        // ignore malformed chunk
      }
    };
    source.addEventListener("event", onEvent as EventListener);

    return () => {
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.removeEventListener("event", onEvent as EventListener);
      source.close();
    };
  }, [tenantScope]);

  const tenantOptions = useMemo(
    () =>
      [...new Set(events.map((event) => String(event.tenantSlug || "unknown")))]
        .map((tenant) => tenant.toLowerCase())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [events]
  );
  const visibleEvents = useMemo(
    () => (selectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === selectedTenant)),
    [events, selectedTenant]
  );
  const mapPoints = useMemo(
    () => aggregateHeatmapPoints(visibleEvents),
    [visibleEvents]
  );
  const liveMetrics = useMemo(() => {
    const valid = visibleEvents.filter((item) => classifyRealtimeVerdict(item.verdict, item.reason) === "valid").length;
    const risk = visibleEvents.filter((item) => isRealtimeRisk(item.verdict, item.reason)).length;
    const unknown = visibleEvents.filter((item) => classifyRealtimeVerdict(item.verdict, item.reason) === "unknown").length;
    const uniqueTags = new Set(visibleEvents.map((item) => String(item.uidMasked || ""))).size;
    const uniqueCities = new Set(visibleEvents.map((item) => String(item.city || "Unknown"))).size;
    const gps = visibleEvents.filter((item) => isClientReportedGps(item.locationSource)).length;
    const mobile = visibleEvents.filter((item) => String(item.deviceType || "").toLowerCase().includes("mobile")).length;
    return { valid, risk, unknown, uniqueTags, uniqueCities, gps, mobile };
  }, [visibleEvents]);
  const cityHotspots = useMemo(() => buildCityHotspots(visibleEvents), [visibleEvents]);
  const realtimePulse = useMemo(() => {
    if (!hydrated) return { recentCount: 0, tapsPerMinute: 0, topTenants: [] as Array<{ tenant: string; taps: number; risk: number; unknown: number }> };
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const recent = visibleEvents.filter((event) => {
      const at = new Date(String(event.occurredAt || "")).getTime();
      return Number.isFinite(at) && at >= fiveMinutesAgo;
    });
    const tapsPerMinute = Math.round((recent.length / 5) * 10) / 10;
    const byTenant = new Map<string, { taps: number; risk: number; unknown: number }>();
    recent.forEach((event) => {
      const tenant = String(event.tenantSlug || "unknown");
      const current = byTenant.get(tenant) || { taps: 0, risk: 0, unknown: 0 };
      current.taps += 1;
      if (isRealtimeRisk(event.verdict, event.reason)) current.risk += 1;
      if (classifyRealtimeVerdict(event.verdict, event.reason) === "unknown") current.unknown += 1;
      byTenant.set(tenant, current);
    });
    const topTenants = [...byTenant.entries()]
      .map(([tenant, stats]) => ({ tenant, ...stats }))
      .sort((a, b) => b.taps - a.taps)
      .slice(0, 4);
    return { recentCount: recent.length, tapsPerMinute, topTenants };
  }, [hydrated, visibleEvents]);
  const minuteBars = useMemo(() => {
    if (!hydrated) {
      return Array.from({ length: 10 }, (_, index) => ({
        key: `pending-${index}`,
        label: "--",
        count: 0,
        height: 8,
      }));
    }
    const now = Date.now();
    const buckets = Array.from({ length: 10 }, (_, index) => {
      const minuteStart = now - (9 - index) * 60_000;
      return { minuteStart, count: 0 };
    });
    visibleEvents.forEach((event) => {
      const at = new Date(String(event.occurredAt || "")).getTime();
      if (!Number.isFinite(at)) return;
      const diffMinutes = Math.floor((now - at) / 60_000);
      const bucketIndex = 9 - diffMinutes;
      if (bucketIndex < 0 || bucketIndex > 9) return;
      buckets[bucketIndex].count += 1;
    });
    const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
    return buckets.map((bucket, index) => ({
      key: `${bucket.minuteStart}-${index}`,
      label: new Date(bucket.minuteStart).toLocaleTimeString("es-AR", { minute: "2-digit", second: "2-digit" }),
      count: bucket.count,
      height: Math.max(8, Math.round((bucket.count / max) * 52)),
    }));
  }, [hydrated, visibleEvents]);
  const velocitySeries = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const start = now - (11 - index) * 5 * 60_000;
      return {
        key: String(index),
        label: new Date(start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        taps: 0,
        risk: 0,
      };
    });
    visibleEvents.forEach((event) => {
      const at = Date.parse(String(event.occurredAt || ""));
      if (!Number.isFinite(at)) return;
      const diff = Math.floor((now - at) / (5 * 60_000));
      const bucketIndex = 11 - diff;
      if (bucketIndex < 0 || bucketIndex > 11) return;
      buckets[bucketIndex].taps += 1;
      if (isRealtimeRisk(event.verdict, event.reason)) buckets[bucketIndex].risk += 1;
    });
    return buckets;
  }, [visibleEvents, hydrated]);
  const funnelStages = useMemo(() => {
    const taps = visibleEvents.length;
    const valid = liveMetrics.valid;
    const gps = liveMetrics.gps;
    const mobile = liveMetrics.mobile;
    const actionable = visibleEvents.filter((event) => {
      const hasLocation = strictCoordinatePair(event.lat, event.lng) != null;
      return classifyRealtimeVerdict(event.verdict, event.reason) === "valid" && hasLocation && Boolean(event.uidMasked);
    }).length;
    const max = Math.max(taps, 1);
    return [
      { label: "Lecturas", value: taps, tone: "cyan", detail: "eventos del stream" },
      { label: "Válidas", value: valid, tone: "emerald", detail: "aptas para acción" },
      { label: "Ubicación", value: gps, tone: "amber", detail: "GPS reportado por cliente" },
      { label: "Mobile", value: mobile, tone: "violet", detail: "lecturas desde teléfono" },
      { label: "Señal CRM", value: actionable, tone: "sky", detail: "UID + zona usable" },
    ].map((stage) => ({ ...stage, pct: Math.round((stage.value / max) * 100) }));
  }, [liveMetrics.gps, liveMetrics.mobile, liveMetrics.valid, visibleEvents]);
  const riskEvents = useMemo(
    () => visibleEvents.filter((event) => isRealtimeRisk(event.verdict, event.reason)).slice(0, 4),
    [visibleEvents],
  );
  const latestTap = visibleEvents[0] || null;
  const explicitRiskRate = visibleEvents.length ? Math.round((liveMetrics.risk / visibleEvents.length) * 1000) / 10 : 0;
  const cleanRate = visibleEvents.length ? (liveMetrics.valid / visibleEvents.length) * 100 : 0;
  const gpsCoverage = visibleEvents.length ? (liveMetrics.gps / visibleEvents.length) * 100 : 0;
  const mobileShare = visibleEvents.length ? (liveMetrics.mobile / visibleEvents.length) * 100 : 0;
  const commandState = useMemo(() => {
    const hottest = cityHotspots[0];
    if (!visibleEvents.length) {
      return {
        tone: "border-slate-500/20 bg-slate-900/70 text-slate-200",
        label: "ESPERANDO EVENTOS",
        action: "Hacé una lectura NFC y confirmá que el evento llegue para abrir mapa y funnel.",
      };
    }
    if (explicitRiskRate >= 15 || liveMetrics.risk >= 3) {
      return {
        tone: "border-rose-300/35 bg-rose-500/10 text-rose-100",
        label: "ALERTA DE RIESGO NFC",
        action: `Revisar ${hottest?.city || "hotspot principal"} y abrir eventos de riesgo antes de activar promociones.`,
      };
    }
    if (gpsCoverage < 40) {
      return {
        tone: "border-amber-300/35 bg-amber-500/10 text-amber-100",
        label: "GPS BAJO",
        action: "Mejorar permiso de ubicación en mobile tap para segmentar con mayor precisión por ciudad.",
      };
    }
    if (realtimePulse.tapsPerMinute >= 1) {
      return {
        tone: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
        label: "ACTIVIDAD RECIENTE",
        action: `Activar oferta o puntos extra en ${hottest?.city || "la zona con más lecturas"}.`,
      };
    }
    return {
      tone: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
      label: "FEED SIN ALERTAS",
      action: `Convertir mensajes NFC válidos en club, garantía o marketplace desde ${hottest?.city || "el feed activo"}.`,
    };
  }, [cityHotspots, explicitRiskRate, gpsCoverage, liveMetrics.risk, realtimePulse.tapsPerMinute, visibleEvents.length]);
  const latestImpactEvent = useMemo(() => {
    if (!hydrated) return null;
    const latest = visibleEvents[0];
    if (!latest) return null;
    const at = new Date(String(latest.occurredAt || "")).getTime();
    if (!Number.isFinite(at)) return null;
    return Date.now() - at <= 3000 ? latest : null;
  }, [hydrated, timeStr, visibleEvents]);

  function timeAgo(value: unknown) {
    if (!hydrated) return "reciente";
    const d = new Date(String(value || ""));
    if (Number.isNaN(d.getTime())) return "justo ahora";
    const sec = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `hace ${sec}s`;
    if (sec < 3600) return `hace ${Math.round(sec / 60)}m`;
    return `hace ${Math.round(sec / 3600)}h`;
  }

  if (isFullscreenOps) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-[#030712] font-mono text-cyan-400 select-none overflow-hidden p-4">
        {/* NASA Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-cyan-500/30 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <div>
              <h1 className="text-sm md:text-base font-black tracking-widest text-cyan-200">
                NEXID CRM SEMANTICA OPERATIVA
              </h1>
              <p className="text-[10px] text-cyan-500/80">
                STREAM DE EVENTOS NFC/QR // MAPA OPERATIVO MULTI-TENANT
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="hidden md:block text-[11px] bg-slate-900 border border-cyan-500/20 px-3 py-1.5 rounded-lg text-cyan-300">
              UTC DEPLOYMENT MODE: <span className="text-emerald-400 font-bold">ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-cyan-500/20 px-3 py-1.5 rounded-lg text-cyan-300">
              <Clock className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>{timeStr}</span>
            </div>
            
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-1.5 rounded border transition-colors ${audioEnabled ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-slate-900 text-slate-500'}`}
              title={audioEnabled ? "Silenciar pings de audio" : "Activar pings de audio"}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            
            <button
              onClick={() => setIsFullscreenOps(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
              <Minimize2 className="h-4 w-4" />
              <span>SALIR TV MODE</span>
            </button>
          </div>
        </div>
        
        {latestImpactEvent ? (
          <div className="pointer-events-none absolute left-1/2 top-24 z-20 w-[min(58rem,calc(100vw-2rem))] -translate-x-1/2 animate-pulse rounded-xl border border-cyan-300/40 bg-cyan-950/70 px-5 py-4 text-center shadow-[0_0_38px_rgba(34,211,238,0.28)] backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Evento recibido hace menos de 3 s</p>
            <p className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
              EVENTO NFC EN {String(latestImpactEvent.city || "ZONA SIN RESOLVER")} - UID: {latestImpactEvent.uidMasked || "N/A"} - VEREDICTO: {String(latestImpactEvent.verdict || "UNKNOWN").toUpperCase()}
            </p>
          </div>
        ) : null}

        {/* HUD grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4">
          <div className="bg-slate-950/60 border border-cyan-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Lecturas totales</span>
            <div className="text-2xl font-black text-cyan-200 mt-1">{visibleEvents.length}</div>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-emerald-500/80 uppercase tracking-widest">Lecturas válidas</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{liveMetrics.valid}</div>
          </div>
          <div className="bg-slate-950/60 border border-rose-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-rose-500/80 uppercase tracking-widest">Riesgo</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{visibleEvents.length ? `${explicitRiskRate}%` : "Sin base"}</div>
          </div>
          <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-amber-400/80 uppercase tracking-widest">Sin clasificar</span>
            <div className="text-2xl font-black text-amber-200 mt-1">{liveMetrics.unknown}</div>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-emerald-400 uppercase tracking-widest">Calidad NFC</span>
            <div className="text-2xl font-black text-emerald-300 mt-1">{visibleEvents.length ? formatPercent(cleanRate) : "Sin base"}</div>
          </div>
          <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-indigo-400 uppercase tracking-widest">Zonas reportadas</span>
            <div className="text-2xl font-black text-indigo-300 mt-1">{liveMetrics.uniqueCities}</div>
          </div>
          <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-amber-400 uppercase tracking-widest">GPS reportado</span>
            <div className="text-2xl font-black text-amber-200 mt-1">{visibleEvents.length ? formatPercent(gpsCoverage) : "Sin base"}</div>
          </div>
          <div className="bg-slate-950/60 border border-fuchsia-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-fuchsia-400 uppercase tracking-widest">Lecturas recientes (5m)</span>
            <div className="text-2xl font-black text-fuchsia-300 mt-1">{realtimePulse.recentCount}</div>
          </div>
          <div className="bg-slate-950/60 border border-sky-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-sky-400 uppercase tracking-widest">Velocidad TPM</span>
            <div className="text-2xl font-black text-sky-300 mt-1">{realtimePulse.tapsPerMinute}</div>
          </div>
        </div>

        <div className={`mb-4 grid gap-3 rounded-xl border px-4 py-3 text-xs ${commandState.tone} lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(16rem,0.55fr)]`}>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            <div>
              <p className="font-black uppercase tracking-[0.18em]">{commandState.label}</p>
              <p className="mt-0.5 text-[11px] opacity-80">Estado calculado sobre el stream visible.</p>
            </div>
          </div>
          <p className="self-center text-sm font-semibold text-white">{commandState.action}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] opacity-70">Mobile</p>
              <p className="font-black text-white">{formatPercent(mobileShare)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] opacity-70">Hotspots</p>
              <p className="font-black text-white">{cityHotspots.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] opacity-70">Heat</p>
              <p className="font-black text-white">{mapPoints.length}</p>
            </div>
          </div>
        </div>

        {/* Main interactive area: Map and Logs */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
          {/* Map Column */}
          <div className="lg:col-span-8 flex flex-col bg-slate-950/40 border border-cyan-500/20 rounded-xl p-3 min-h-0 overflow-hidden relative">
            <div className="absolute top-4 left-4 z-10 bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-[10px] text-cyan-400 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                MAPA OPERATIVO: EVENTOS + HOTSPOTS
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <DemoOpsMap points={mapPoints} mode={mode} />
            </div>
          </div>

          {/* Logs Column */}
          <div className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden gap-4">
            {/* Live Feed Log Terminal */}
            <div className="flex-1 flex flex-col bg-slate-950/80 border border-cyan-500/20 rounded-xl p-4 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2 mb-3">
                <span className="text-xs font-black tracking-widest text-cyan-300 flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  STREAM DE EVENTOS DEL CRM
                </span>
                <span className="text-[10px] text-cyan-500">LIVE FEED</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2.5 text-xs">
                {visibleEvents.map((event) => {
                  const result = String(event.verdict || "UNKNOWN").toUpperCase();
                  const verdictBucket = classifyRealtimeVerdict(result, event.reason);
                  const isRisk = isRealtimeRisk(result, event.reason);
                  const isUnknown = verdictBucket === "unknown";
                  const eventId = String(event.eventId || "");
                  const isLatest = latestEventId && eventId === latestEventId;
                  const time = event.occurredAtLocal || new Date(String(event.occurredAt)).toLocaleTimeString("es-AR");

                  return (
                    <div key={eventId} className={`p-2 rounded border transition-all ${isLatest ? 'bg-cyan-950/20 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]' : 'bg-slate-900/30 border-white/5'} ${isRisk ? 'border-rose-500/20 bg-rose-950/5' : isUnknown ? 'border-amber-500/20 bg-amber-950/5' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-black ${isRisk ? 'text-rose-400' : isUnknown ? 'text-amber-300' : 'text-emerald-400'}`}>
                          [{result}] {isLatest ? "NEW_EVENT" : ""}
                        </span>
                        <span className="text-[10px] text-slate-500">{time}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 space-y-0.5">
                        <div><span className="text-cyan-500 font-bold">TAG_UID:</span> {event.uidMasked}</div>
                        <div><span className="text-cyan-500 font-bold">ZONA:</span> {event.city || "Geolocalizando..."}, {event.country || "AR"}</div>
                        <div><span className="text-cyan-500 font-bold">DETALLES:</span> {event.productName || "Sin Producto"} - {event.batchId}</div>
                        <div><span className="text-cyan-500 font-bold">CLIENT:</span> {locationSourceLabel(event)}</div>
                      </div>
                    </div>
                  );
                })}
                {!visibleEvents.length ? (
                  <p className="text-slate-500 text-center py-10">ESPERANDO SENALES DE DISPOSITIVOS...</p>
                ) : null}
              </div>
            </div>

            {/* AI Diagnosis block */}
            <div className="bg-slate-950/80 border border-violet-500/20 rounded-xl p-4 text-xs">
              <div className="flex items-center justify-between border-b border-violet-500/10 pb-2 mb-2">
                <span className="text-xs font-black tracking-widest text-violet-300 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-violet-400" />
                  IA OPERATIVA SOBRE STREAM
                </span>
              </div>
              <div className="text-slate-300 leading-5 text-[11px] whitespace-pre-line bg-violet-950/5 p-2 rounded border border-violet-500/10 h-24 overflow-y-auto">
                {aiReport || "ANALIZANDO CONDICIONES DE SEGURIDAD EN TIEMPO REAL..."}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-cyan-500/20 rounded-xl p-4 text-xs">
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2 mb-2">
                <span className="text-xs font-black tracking-widest text-cyan-300 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  ZONAS PRIORIZADAS PARA ACCION
                </span>
                <span className="text-[10px] text-cyan-500">CAPA DENSIDAD</span>
              </div>
              <div className="space-y-2">
                {cityHotspots.slice(0, 4).map((hotspot, index) => {
                  const riskPct = hotspot.taps ? (hotspot.risk / hotspot.taps) * 100 : 0;
                  const gpsPct = hotspot.taps ? (hotspot.gps / hotspot.taps) * 100 : 0;
                  return (
                    <div key={hotspot.key} className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-black text-white">#{index + 1} {hotspot.city}, {hotspot.country}</p>
                        <p className="text-cyan-200">{hotspot.taps} lecturas</p>
                      </div>
                      <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-slate-300">
                        <span>GPS {formatPercent(gpsPct)}</span>
                        <span className={riskPct ? "text-rose-300" : "text-emerald-300"}>Riesgo {formatPercent(riskPct)}</span>
                        <span className="text-amber-200">Sin clasificar {hotspot.unknown}</span>
                        <span className="truncate">UID {hotspot.lastUid}</span>
                      </div>
                    </div>
                  );
                })}
                {!cityHotspots.length ? <p className="text-slate-500">ESPERANDO HOTSPOTS GEOGRAFICOS...</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="control-center" className="space-y-4">
      <style>{`
        @media print {
          body { background-color: #020817 !important; color: #f8fafc !important; }
          header, nav, select, button, .site-header, aside, .no-print, label, .site-footer { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      <section className="rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-[0_22px_80px_rgba(2,6,23,.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-black tracking-[0.02em] text-white">
              <Activity className="h-5 w-5 text-cyan-300" />
              CRM de eventos NFC
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
              Eventos de la fuente seleccionada, mapa de ubicaciones reportadas, riesgo y acción comercial post-evento en una sola consola.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <select
              suppressHydrationWarning
              value={selectedTenant}
              onChange={(event) => setSelectedTenant(event.target.value)}
              className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              aria-label="Filtrar tenant del CRM de eventos NFC"
            >
              <option value="all">Todos los tenants</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant} value={tenant}>{tenant}</option>
              ))}
            </select>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setIsFullscreenOps(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/35 bg-cyan-500/12 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-400/20"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Modo comando
            </button>
            <button
              suppressHydrationWarning
              type="button"
              onClick={handleExportCsv}
              className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Exportar CSV
            </button>
            <Badge tone={connected ? "green" : "amber"}>{connected ? "Live stream" : "Reconectando"}</Badge>
          </div>
        </div>

        <div className={`mt-4 grid gap-3 rounded-xl border px-4 py-3 text-xs ${commandState.tone} lg:grid-cols-[minmax(0,.5fr)_minmax(0,1fr)_auto]`}>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <div>
              <p className="font-black uppercase tracking-[0.14em]">{commandState.label}</p>
              <p className="mt-0.5 opacity-80">Siguiente decision del operador</p>
            </div>
          </div>
          <p className="self-center text-sm font-semibold text-white">{commandState.action}</p>
          <p className="self-center rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-[11px] text-slate-200">
            Última actualización: {hydrated && lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString("es-AR") : "sincronizando"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,.92fr)_minmax(34rem,1.08fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Lecturas", value: visibleEvents.length, detail: `${realtimePulse.recentCount} últimos 5m`, tone: "cyan" },
              { label: "Mensajes NFC válidos", value: visibleEvents.length ? formatPercent(cleanRate) : "Sin base", detail: `${liveMetrics.valid} VALID`, tone: "emerald" },
              { label: "Riesgo explícito", value: visibleEvents.length ? `${explicitRiskRate}%` : "Sin base", detail: `${liveMetrics.risk} replay/tamper/INVALID`, tone: liveMetrics.risk ? "rose" : "slate" },
              { label: "Sin clasificar", value: liveMetrics.unknown, detail: "UNKNOWN / registro / activacion", tone: "slate" },
              { label: "Ubicación reportada", value: visibleEvents.length ? formatPercent(gpsCoverage) : "Sin base", detail: `${liveMetrics.gps} con GPS del cliente`, tone: "amber" },
              { label: "UIDs únicas", value: liveMetrics.uniqueTags, detail: `${liveMetrics.uniqueCities} ciudades`, tone: "violet" },
              { label: "Velocidad", value: realtimePulse.tapsPerMinute, detail: "lecturas por minuto", tone: "sky" },
            ].map((metric) => (
              <div key={metric.label} className={`rounded-xl border p-3 text-xs ${
                metric.tone === "emerald" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                : metric.tone === "rose" ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
                : metric.tone === "amber" ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
                : metric.tone === "violet" ? "border-violet-300/25 bg-violet-500/10 text-violet-100"
                : metric.tone === "sky" ? "border-sky-300/25 bg-sky-500/10 text-sky-100"
                : "border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
              }`}>
                <p className="uppercase tracking-[0.13em] opacity-80">{metric.label}</p>
                <p className="mt-1 text-2xl font-black text-white">{metric.value}</p>
                <p className="mt-1 text-[11px] opacity-75">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,.72fr)]">
            <div className="rounded-xl border border-white/10 bg-slate-950/65 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Velocidad de lecturas</p>
                <p className="text-[11px] text-slate-500">ventana 60m</p>
              </div>
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocitySeries} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="crmTapsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="crmRiskGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={crmTooltipStyle} cursor={{ stroke: "rgba(34,211,238,.22)" }} />
                    <Area type="monotone" dataKey="taps" stroke="#22d3ee" strokeWidth={2} fill="url(#crmTapsGradient)" dot={false} />
                    <Area type="monotone" dataKey="risk" stroke="#fb7185" strokeWidth={2} fill="url(#crmRiskGradient)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/65 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Funnel post-tap</p>
              <p className="mt-1 text-[11px] text-slate-500">De lectura física a señal utilizable por CRM.</p>
              <div className="mt-3 space-y-2">
                {funnelStages.map((stage) => (
                  <div key={stage.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                      <span>{stage.label}</span>
                      <span>{stage.value} - {stage.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          stage.tone === "emerald" ? "bg-emerald-400"
                          : stage.tone === "amber" ? "bg-amber-300"
                          : stage.tone === "violet" ? "bg-violet-300"
                          : stage.tone === "sky" ? "bg-sky-300"
                          : "bg-cyan-300"
                        }`}
                        style={{ width: `${Math.max(stage.pct, stage.value ? 6 : 0)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">{stage.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-violet-300/20 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">IA de cercanía comercial</p>
              <button
                suppressHydrationWarning
                type="button"
                className="text-[11px] font-bold text-cyan-300 hover:underline"
                onClick={generateAiInsights}
                disabled={aiAnalyzing}
              >
                {aiAnalyzing ? "Analizando..." : "Recalcular"}
              </button>
            </div>
            <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">
              {aiReport || "Recalculá con el stream visible para priorizar zona, riesgo y próxima acción comercial."}
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-cyan-300/18 bg-slate-950/70 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-100">Mapa de eventos reportados</p>
              <p className="mt-1 text-xs text-slate-400">
                Solo grafica pares lat/lng reportados y válidos; la ciudad queda como etiqueta descriptiva.
              </p>
            </div>
            {latestTap ? (
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                <p className="font-semibold">{latestTap.city || "Sin ciudad"}, {latestTap.country || "--"}</p>
                <p className="text-[11px] text-cyan-100/75">{latestTap.uidMasked} - {locationSourceLabel(latestTap)}</p>
              </div>
            ) : null}
          </div>
          <DemoOpsMap points={mapPoints} mode={mode} chrome="compact" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,.62fr)]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Zonas accionables</p>
              <p className="mt-1 text-xs text-slate-400">Priorizadas por lecturas, GPS reportado por cliente y riesgo explicito.</p>
            </div>
            <p className="text-[11px] text-slate-500">Top {cityHotspots.length}</p>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            <div className="grid grid-cols-[1.2fr_.55fr_.6fr_.7fr_.7fr_1fr] bg-slate-900/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              <span>Zona</span>
              <span>Lecturas</span>
              <span>GPS</span>
              <span>Riesgo</span>
              <span>Sin clasificar</span>
              <span>Siguiente acción</span>
            </div>
            {cityHotspots.map((hotspot) => {
              const gpsPct = hotspot.taps ? (hotspot.gps / hotspot.taps) * 100 : 0;
              const riskPct = hotspot.taps ? (hotspot.risk / hotspot.taps) * 100 : 0;
              const action = riskPct > 0 ? "Auditar UID/lote" : gpsPct >= 50 ? "Activar beneficio local" : "Pedir opt-in GPS";
              return (
                <div key={hotspot.key} className="grid grid-cols-[1.2fr_.55fr_.6fr_.7fr_.7fr_1fr] border-t border-white/10 px-3 py-2 text-xs text-slate-200">
                  <span className="min-w-0 truncate font-semibold">{hotspot.city}, {hotspot.country}</span>
                  <span>{hotspot.taps}</span>
                  <span>{formatPercent(gpsPct)}</span>
                  <span className={riskPct ? "text-rose-300" : "text-emerald-300"}>{formatPercent(riskPct)}</span>
                  <span className="text-amber-200">{hotspot.unknown}</span>
                  <span className="truncate text-cyan-200">{action}</span>
                </div>
              );
            })}
            {!cityHotspots.length ? <p className="p-4 text-sm text-slate-400">Sin zonas con coordenadas en el stream actual.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-100">Riesgos y últimos eventos</p>
          <div className="mt-3 space-y-2">
            {(riskEvents.length ? riskEvents : visibleEvents.slice(0, 5)).map((event) => {
              const result = String(event.verdict || "UNKNOWN").toUpperCase();
              const verdictBucket = classifyRealtimeVerdict(result, event.reason);
              const risk = isRealtimeRisk(result, event.reason);
              const unknown = verdictBucket === "unknown";
              return (
                <div key={String(event.eventId || `${event.uidMasked}-${event.occurredAt}`)} className={`rounded-xl border px-3 py-2 text-xs ${risk ? "border-rose-300/30 bg-rose-500/10" : unknown ? "border-amber-300/25 bg-amber-500/10" : "border-white/10 bg-slate-900/55"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={risk ? "font-black text-rose-200" : unknown ? "font-black text-amber-200" : "font-black text-emerald-200"}>{result}</p>
                    <p className="text-[10px] text-slate-500">{timeAgo(event.occurredAt)}</p>
                  </div>
                  <p className="mt-1 truncate text-slate-200">{event.uidMasked} - {event.city || "sin ciudad"}, {event.country || "--"}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{deviceSummary(event)} - {locationSourceLabel(event)}</p>
                </div>
              );
            })}
            {!visibleEvents.length ? <p className="text-sm text-slate-400">Esperando eventos del stream.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
