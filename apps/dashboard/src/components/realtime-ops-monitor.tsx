"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Badge, Card } from "@product/ui";
import Link from "next/link";
import { DemoOpsMap } from "./demo-ops-map";
import { mergeRealtimeEvents, type TenantTapRealtimeEvent } from "../lib/realtime-feed";
import { exportToCsv } from "../lib/export-utils";
import { Maximize2, Minimize2, Clock, Terminal, Volume2, VolumeX, Activity, Globe } from "lucide-react";

type MapMode = "tenant" | "global";

type Labels = {
  liveFeed: string;
  mission: string;
  mapTitle: string;
  mapSubtitle: string;
};

const KNOWN_CITY_COORDS: Array<{ match: RegExp; country: string; lat: number; lng: number }> = [
  { match: /san\s*martin/i, country: "AR", lat: -34.5744, lng: -58.5358 },
  { match: /buenos\s*aires|caba/i, country: "AR", lat: -34.6037, lng: -58.3816 },
  { match: /mendoza|valle\s+de\s+uco|tunuyan|tupungato|lujan/i, country: "AR", lat: -32.8895, lng: -68.8458 },
  { match: /cordoba/i, country: "AR", lat: -31.4201, lng: -64.1888 },
  { match: /rosario/i, country: "AR", lat: -32.9442, lng: -60.6505 },
  { match: /santa\s*fe/i, country: "AR", lat: -31.6107, lng: -60.6973 },
  { match: /sao\s*paulo/i, country: "BR", lat: -23.5558, lng: -46.6396 },
  { match: /santiago/i, country: "CL", lat: -33.4489, lng: -70.6693 },
  { match: /montevideo/i, country: "UY", lat: -34.9011, lng: -56.1645 },
  { match: /lima/i, country: "PE", lat: -12.0464, lng: -77.0428 },
  { match: /bogota/i, country: "CO", lat: 4.711, lng: -74.0721 },
  { match: /mexico|ciudad\s+de\s+mexico|cdmx/i, country: "MX", lat: 19.4326, lng: -99.1332 },
  { match: /ashburn/i, country: "US", lat: 39.0438, lng: -77.4874 },
];

function cityFallback(city: string, country: string) {
  const normalizedCountry = country.toUpperCase();
  return KNOWN_CITY_COORDS.find((item) => item.country === normalizedCountry && item.match.test(city)) || null;
}

function locationSourceLabel(row: TenantTapRealtimeEvent) {
  const source = String(row.locationSource || "").toLowerCase();
  if (source === "browser_gps") {
    return row.locationAccuracyM ? `GPS telefono ${Math.round(row.locationAccuracyM)}m` : "GPS telefono";
  }
  if (source === "ip_geo") return "IP aproximada";
  if (source.includes("error") || source.includes("denied")) return "GPS no autorizado";
  return Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) ? "Coordenada reportada" : "Ciudad estimada";
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
  const fallback = cityFallback(city, country);
  const lat = Number.isFinite(Number(row.lat)) ? Number(row.lat) : fallback?.lat ?? Number.NaN;
  const lng = Number.isFinite(Number(row.lng)) ? Number(row.lng) : fallback?.lng ?? Number.NaN;
  const result = String(row.verdict || "valid").toUpperCase();
  return {
    city,
    country,
    lat,
    lng,
    scans: 1,
    risk: result === "VALID" ? 0 : 1,
    status: result,
    source: String(row.source || "production"),
    lastSeen: String(row.occurredAt || new Date().toISOString()),
    tenantSlug: row.tenantSlug || undefined,
    uid: row.uidMasked,
    device: `${deviceSummary(row)} - ${locationSourceLabel(row)}${row.timezoneLabel ? ` - ${row.timezoneLabel}` : ""}`,
  };
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
      const valid = visible.filter((item) => String(item.verdict || "").toLowerCase() === "valid").length;
      const risk = total - valid;
      const ratio = total > 0 ? (risk / total) * 100 : 0;
      const uids = new Set(visible.map((item) => item.uidMasked)).size;
      const cities = new Set(visible.map((item) => item.city || "Unknown")).size;
      const gps = visible.filter((item) => String(item.locationSource || "").toLowerCase() === "browser_gps").length;
      const repeatedInterest = uids > 0 ? total / uids : 0;
      const latest = visible[0];

      let diagnosis = "Red limpia: no hay alertas de replay/tamper en el feed visible.";
      let recommendation = "Convertir el interes: mostrar oferta de club, marketplace y puntos despues de cada tap valido.";

      if (ratio > 15) {
        diagnosis = "Riesgo alto: demasiadas lecturas no limpias en la ventana actual.";
        recommendation = "Abrir eventos filtrados por riesgo, revisar UID/lote y bloquear acciones comerciales si el ratio supera 15%.";
      } else if (repeatedInterest > 3) {
        diagnosis = "Interes repetido: los mismos productos se estan escaneando varias veces.";
        recommendation = "Ofrecer puntos extra, cata guiada o descuento si el usuario deja contacto voluntario.";
      } else if (gps / Math.max(total, 1) < 0.25) {
        diagnosis = "Buena autenticidad, pero baja precision GPS del telefono.";
        recommendation = "Pedir permiso de ubicacion en mobile tap y marcar IP/ciudad como aproximada.";
      }

      setAiReport(`Operacion: ${total} taps, ${uids} UIDs, ${cities} ciudades, ${gps} con GPS del telefono.
Confianza: ${(100 - ratio).toFixed(1)}% de lecturas limpias.
Diagnostico: ${diagnosis}
Accion recomendada: ${recommendation}
Ultimo evento: ${latest?.uidMasked || "N/A"} - ${latest?.occurredAtLocal || latest?.occurredAt || "sin hora"} - ${latest ? locationSourceLabel(latest) : "sin ubicacion"}.`);
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
      Riesgo: String(e.riskLevel || "").toUpperCase(),
      Ciudad: e.city || "Geolocalizacion Pendiente",
      Pais: e.country || "--",
      Latitud: e.lat || "",
      Longitud: e.lng || "",
      Fuente_Ubicacion: locationSourceLabel(e),
      Precision_Metros: e.locationAccuracyM || "",
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
        { key: "Fecha_UTC_Auditoria", label: "Fecha UTC Auditoria" },
        { key: "Veredicto", label: "Veredicto" },
        { key: "Riesgo", label: "Nivel de Riesgo" },
        { key: "Ciudad", label: "Ciudad" },
        { key: "Pais", label: "Pais" },
        { key: "Latitud", label: "Latitud" },
        { key: "Longitud", label: "Longitud" },
        { key: "Fuente_Ubicacion", label: "Fuente Ubicacion" },
        { key: "Precision_Metros", label: "Precision GPS m" },
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
          const incomingFirst = payload.rows[0];
          const incomingId = incomingFirst ? String((incomingFirst as TenantTapRealtimeEvent).eventId || "") : "";
          if (incomingId && incomingId !== latestEventId) setLatestEventId(incomingId);
          setEvents(payload.rows as TenantTapRealtimeEvent[]);
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
              const verdict = String(payload.verdict || "").toLowerCase();
              if (audioEnabledRef.current) {
                playPing(verdict === "valid" ? "success" : "warning");
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
    () => visibleEvents.map(toMapPoint).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).slice(0, 40),
    [visibleEvents]
  );
  const liveMetrics = useMemo(() => {
    const valid = visibleEvents.filter((item) => String(item.verdict || "").toLowerCase() === "valid").length;
    const risk = Math.max(0, visibleEvents.length - valid);
    const uniqueTags = new Set(visibleEvents.map((item) => String(item.uidMasked || ""))).size;
    const uniqueCities = new Set(visibleEvents.map((item) => String(item.city || "Unknown"))).size;
    return { valid, risk, uniqueTags, uniqueCities };
  }, [visibleEvents]);
  const realtimePulse = useMemo(() => {
    if (!hydrated) return { recentCount: 0, tapsPerMinute: 0, topTenants: [] as Array<{ tenant: string; taps: number; risk: number }> };
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const recent = visibleEvents.filter((event) => {
      const at = new Date(String(event.occurredAt || "")).getTime();
      return Number.isFinite(at) && at >= fiveMinutesAgo;
    });
    const tapsPerMinute = Math.round((recent.length / 5) * 10) / 10;
    const byTenant = new Map<string, { taps: number; risk: number }>();
    recent.forEach((event) => {
      const tenant = String(event.tenantSlug || "unknown");
      const current = byTenant.get(tenant) || { taps: 0, risk: 0 };
      current.taps += 1;
      if (String(event.verdict || "").toLowerCase() !== "valid") current.risk += 1;
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
  const fraudRate = visibleEvents.length ? Math.round((liveMetrics.risk / visibleEvents.length) * 1000) / 10 : 0;
  const latestImpactEvent = useMemo(() => {
    if (!hydrated) return null;
    const latest = visibleEvents[0];
    if (!latest) return null;
    const at = new Date(String(latest.occurredAt || "")).getTime();
    if (!Number.isFinite(at)) return null;
    return Date.now() - at <= 3000 ? latest : null;
  }, [hydrated, timeStr, visibleEvents]);

  function timeAgo(value: unknown) {
    if (!hydrated) return "en vivo";
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
                NEXID TELEMETRY OPERATIONAL COMMAND CENTER
              </h1>
              <p className="text-[10px] text-cyan-500/80">
                SATELLITE TRACING SYSTEM // MULTI-TENANT CRYPTO-LEDGER ANCHORING
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
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Impacto en vivo</p>
            <p className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
              LOTE ACTIVO ESCANEADO EN {String(latestImpactEvent.city || "ZONA SIN RESOLVER")} - UID: {latestImpactEvent.uidMasked || "N/A"}
            </p>
          </div>
        ) : null}

        {/* HUD grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          <div className="bg-slate-950/60 border border-cyan-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Taps Totales</span>
            <div className="text-2xl font-black text-cyan-200 mt-1">{visibleEvents.length}</div>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-emerald-500/80 uppercase tracking-widest">Autenticados OK</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{liveMetrics.valid}</div>
          </div>
          <div className="bg-slate-950/60 border border-rose-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-rose-500/80 uppercase tracking-widest">Fraude</span>
            <div className="text-2xl font-black text-rose-400 mt-1">{fraudRate}%</div>
          </div>
          <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-indigo-400 uppercase tracking-widest">Zonas Activas</span>
            <div className="text-2xl font-black text-indigo-300 mt-1">{liveMetrics.uniqueCities}</div>
          </div>
          <div className="bg-slate-950/60 border border-fuchsia-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-fuchsia-400 uppercase tracking-widest">Taps Recientes (5m)</span>
            <div className="text-2xl font-black text-fuchsia-300 mt-1">{realtimePulse.recentCount}</div>
          </div>
          <div className="bg-slate-950/60 border border-sky-500/20 rounded-xl p-3 text-center">
            <span className="text-[10px] text-sky-400 uppercase tracking-widest">Velocidad TPM</span>
            <div className="text-2xl font-black text-sky-300 mt-1">{realtimePulse.tapsPerMinute}</div>
          </div>
        </div>

        {/* Main interactive area: Map and Logs */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
          {/* Map Column */}
          <div className="lg:col-span-8 flex flex-col bg-slate-950/40 border border-cyan-500/20 rounded-xl p-3 min-h-0 overflow-hidden relative">
            <div className="absolute top-4 left-4 z-10 bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-[10px] text-cyan-400 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                VISTA SATELITAL CONCENTRIS SYSTEM
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
                  RAW TELEMETRY EVENT STREAM
                </span>
                <span className="text-[10px] text-cyan-500">LIVE FEED</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2.5 text-xs">
                {visibleEvents.map((event) => {
                  const result = String(event.verdict || "valid").toUpperCase();
                  const isRisk = result !== "VALID";
                  const eventId = String(event.eventId || "");
                  const isLatest = latestEventId && eventId === latestEventId;
                  const time = event.occurredAtLocal || new Date(String(event.occurredAt)).toLocaleTimeString("es-AR");

                  return (
                    <div key={eventId} className={`p-2 rounded border transition-all ${isLatest ? 'bg-cyan-950/20 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]' : 'bg-slate-900/30 border-white/5'} ${isRisk ? 'border-rose-500/20 bg-rose-950/5' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-black ${isRisk ? 'text-rose-400' : 'text-emerald-400'}`}>
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
                  CO-PILOT AI DIAGNOSIS ENGINE
                </span>
              </div>
              <div className="text-slate-300 leading-5 text-[11px] whitespace-pre-line bg-violet-950/5 p-2 rounded border border-violet-500/10 h-24 overflow-y-auto">
                {aiReport || "ANALIZANDO CONDICIONES DE SEGURIDAD EN TIEMPO REAL..."}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="control-center" className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(640px,0.9fr)]">
      <style>{`
        @media print {
          body { background-color: #020817 !important; color: #f8fafc !important; }
          header, nav, select, button, .site-header, aside, .no-print, label, .site-footer { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      `}</style>
      <Card className="min-w-0 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Activity className="h-4 w-4 text-cyan-300" />
              {labels.liveFeed}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {labels.mission} - {hydrated && lastUpdateAt ? `ultimo evento ${new Date(lastUpdateAt).toLocaleTimeString("es-AR")}` : "sincronizando stream"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <select
              suppressHydrationWarning
              value={selectedTenant}
              onChange={(event) => setSelectedTenant(event.target.value)}
              className="rounded border border-white/20 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100"
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
              className="inline-flex items-center gap-1.5 rounded border border-cyan-300/35 bg-cyan-500/12 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-400/20"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Centro de Control NASA
            </button>
            <button
              suppressHydrationWarning
              type="button"
              onClick={handleExportCsv}
              className="rounded border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Export CSV
            </button>
            <Badge tone={connected ? "green" : "amber"}>{connected ? "Live stream" : "Reconnecting..."}</Badge>
          </div>
        </div>

        {latestImpactEvent ? (
          <div className="mt-4 animate-pulse rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
            LOTE ACTIVO ESCANEADO EN {String(latestImpactEvent.city || "ZONA SIN RESOLVER")} - UID: {latestImpactEvent.uidMasked || "N/A"}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            <p className="uppercase tracking-[0.12em] text-cyan-200/80">Taps totales</p>
            <p className="mt-1 text-xl font-semibold">{visibleEvents.length}</p>
          </div>
          <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 p-3 text-xs text-sky-100">
            <p className="uppercase tracking-[0.12em] text-sky-200/80">TPM</p>
            <p className="mt-1 text-xl font-semibold">{realtimePulse.tapsPerMinute}</p>
          </div>
          <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">
            <p className="uppercase tracking-[0.12em] text-rose-200/80">Fraude</p>
            <p className="mt-1 text-xl font-semibold">{fraudRate}%</p>
          </div>
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            <p className="uppercase tracking-[0.12em] text-emerald-200/80">Validos</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.valid}</p>
          </div>
          <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-xs text-violet-100">
            <p className="uppercase tracking-[0.12em] text-violet-200/80">UIDs</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.uniqueTags}</p>
          </div>
          <div className="rounded-xl border border-indigo-300/25 bg-indigo-500/10 p-3 text-xs text-indigo-100">
            <p className="uppercase tracking-[0.12em] text-indigo-200/80">Ciudades</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.uniqueCities}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.7fr)]">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-semibold uppercase tracking-[0.12em] text-slate-200">Momentum taps (10m)</p>
              <p className="text-[11px] text-slate-400">barras por minuto</p>
            </div>
            <div className="mt-2 flex items-end gap-1">
              {minuteBars.map((bar) => (
                <div key={bar.key} className="group flex-1">
                  <div
                    style={{ height: `${bar.height}px` }}
                    className={`w-full rounded-t transition-all duration-500 ${bar.count ? "bg-cyan-300/80" : "bg-slate-700/40"}`}
                    title={`${bar.label} - ${bar.count} taps`}
                  />
                  <p className="mt-1 truncate text-center text-[9px] text-slate-500">{bar.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
            <p className="font-semibold uppercase tracking-[0.12em] text-slate-200">Tenants activos (5m)</p>
            <div className="mt-2 space-y-1.5">
              {realtimePulse.topTenants.map((tenant) => (
                <div key={tenant.tenant} className="flex items-center justify-between rounded border border-white/10 bg-slate-950/50 px-2 py-1">
                  <p className="font-mono text-[11px] text-slate-200">{tenant.tenant}</p>
                  <p className="text-[11px] text-slate-300">
                    taps <span className="font-semibold text-cyan-200">{tenant.taps}</span> - riesgo{" "}
                    <span className={tenant.risk ? "font-semibold text-rose-300" : "font-semibold text-emerald-300"}>{tenant.risk}</span>
                  </p>
                </div>
              ))}
              {!realtimePulse.topTenants.length ? <p className="text-slate-400">Sin actividad reciente por tenant.</p> : null}
            </div>
          </div>
        </div>

        {aiReport ? (
          <div className="mt-4 rounded-xl border border-violet-500/30 bg-slate-950/70 p-4 text-xs no-print">
            <div className="flex items-center justify-between">
              <p className="font-black uppercase tracking-[0.14em] text-violet-300">nexID Ops Copilot</p>
              <button
                suppressHydrationWarning
                type="button"
                className="text-[10px] font-bold text-cyan-300 hover:underline"
                onClick={generateAiInsights}
                disabled={aiAnalyzing}
              >
                {aiAnalyzing ? "Analizando..." : "Actualizar reporte"}
              </button>
            </div>
            <div className="mt-2 whitespace-pre-line leading-5 text-slate-300">{aiReport}</div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {visibleEvents.slice(0, 10).map((event) => {
            const result = String(event.verdict || "valid").toUpperCase();
            const tone = result === "VALID" ? "text-emerald-300" : "text-rose-300";
            const eventId = String(event.eventId || "");
            const isLatest = latestEventId && eventId === latestEventId;
            return (
              <div key={eventId} className={`rounded-xl border bg-slate-900/70 p-3 text-sm transition ${isLatest ? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]" : "border-white/10"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-semibold ${tone}`}>{result}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    {isLatest ? <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-cyan-300" /> : null}
                    <span className="text-slate-400">{timeAgo(event.occurredAt)}</span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-cyan-100">
                  {event.occurredAtLocal || "Hora local pendiente"} {event.timezoneLabel ? `- ${event.timezoneLabel}` : ""}
                </p>
                <p className="mt-1 text-slate-300">
                  {String(event.tenantSlug || "-")} - {String(event.batchId || "-")} - {String(event.uidMasked || "-")}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {event.city || "Geolocalizando"}, {event.country || "--"} - {deviceSummary(event)} - {locationSourceLabel(event)}
                </p>
              </div>
            );
          })}
          {!visibleEvents.length ? <p className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-300">Sin eventos aun en el stream activo para este tenant.</p> : null}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Scope activo: <span className="font-mono text-slate-200">{selectedTenant === "all" ? "todos los tenants" : selectedTenant}</span>
        </p>
        {selectedTenant !== "all" ? (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Link href={`/tenants/${encodeURIComponent(selectedTenant)}`} className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100 hover:bg-cyan-500/20">Ver tenant</Link>
            <Link href={`/events?tenant=${encodeURIComponent(selectedTenant)}`} className="rounded border border-indigo-300/30 bg-indigo-500/10 px-2 py-1 text-indigo-100 hover:bg-indigo-500/20">Abrir eventos filtrados</Link>
            <Link href={`/tags?tenant=${encodeURIComponent(selectedTenant)}`} className="rounded border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100 hover:bg-emerald-500/20">Ver tags del tenant</Link>
          </div>
        ) : null}
      </Card>

      <div className="min-w-0">
        <p className="mb-2 text-xs text-slate-400">{labels.mapTitle} - {labels.mapSubtitle}</p>
        <DemoOpsMap points={mapPoints} mode={mode} />
      </div>
    </div>
  );
}
