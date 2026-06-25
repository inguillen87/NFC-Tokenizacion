"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock,
  Crosshair,
  Download,
  Expand,
  Filter,
  Gift,
  Globe,
  Layers,
  LogOut,
  MapPin,
  Megaphone,
  MousePointerClick,
  Radio,
  Settings,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  Truck,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RealtimeMapLibreMap, type BaseMapLayer } from "./realtime-maplibre-map";
import { exportToCsv } from "../lib/export-utils";
import { mergeRealtimeEvents, sortRealtimeEvents, type TenantTapRealtimeEvent } from "../lib/realtime-feed";

type MapMode = "tenant" | "global";
type CrmSection = "summary" | "infra" | "loyalty";
type MapView = "heat" | "points" | "nearby";
type TimeRange = "5m" | "1h" | "24h";

type MarketOpportunity = {
  key: string;
  city: string;
  country: string;
  taps: number;
  validRate: number;
  gpsRate: number;
  riskRate: number;
  crmReady: number;
  audience: number;
  score: number;
  channel: string;
  offer: string;
  playbook: string;
  reason: string;
  campaignName: string;
};

const tooltipStyle = {
  backgroundColor: "rgba(5, 12, 25, 0.96)",
  border: "1px solid rgba(34, 211, 238, 0.2)",
  borderRadius: "10px",
  color: "#f8fafc",
  fontSize: "12px",
};

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string; ms: number }> = [
  { value: "5m", label: "Últimos 5m", ms: 5 * 60_000 },
  { value: "1h", label: "Última 1h", ms: 60 * 60_000 },
  { value: "24h", label: "Últimas 24h", ms: 24 * 60 * 60_000 },
];

const BASEMAP_OPTIONS: Array<{ value: BaseMapLayer; label: string; title: string }> = [
  { value: "dark", label: "Oscuro", title: "Mapa operativo oscuro para sala de control" },
  { value: "light", label: "Calles", title: "Mapa claro con calles para ubicar comercios y barrios" },
  { value: "satellite", label: "Satélite", title: "Vista satelital para acercamiento urbano y territorio" },
];

function timeRangeLabel(value: TimeRange) {
  return TIME_RANGE_OPTIONS.find((item) => item.value === value)?.label || "Últimas 24h";
}

function timeRangeMs(value: TimeRange) {
  return TIME_RANGE_OPTIONS.find((item) => item.value === value)?.ms || TIME_RANGE_OPTIONS[2].ms;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 10) / 10}%`.replace(".", ",");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function safeDate(value: unknown) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function timeAgo(value: unknown) {
  const ms = safeDate(value);
  if (!ms) return "ahora";
  const sec = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.round(sec / 60)}m`;
  return `hace ${Math.round(sec / 3600)}h`;
}

function locationSourceLabel(row: TenantTapRealtimeEvent) {
  const source = String(row.locationSource || "").toLowerCase();
  if (source === "browser_gps") return row.locationAccuracyM ? `GPS teléfono ${Math.round(row.locationAccuracyM)}m` : "GPS teléfono";
  if (source === "ip_geo") return "IP aproximada";
  if (source.includes("error") || source.includes("denied")) return "GPS no autorizado";
  return Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) ? "Coordenada reportada" : "Ciudad estimada";
}

function deviceSummary(row: TenantTapRealtimeEvent) {
  return [row.deviceLabel, row.deviceOs, row.deviceType].map((item) => String(item || "").trim()).filter(Boolean).join(" · ") || "Dispositivo sin clasificar";
}

function buildHotspots(rows: TenantTapRealtimeEvent[]) {
  const buckets = new Map<string, {
    key: string;
    city: string;
    country: string;
    taps: number;
    valid: number;
    gps: number;
    risk: number;
    lastUid: string;
    device: string;
    lastSeenMs: number;
  }>();

  rows.forEach((row) => {
    const city = String(row.city || "Unknown");
    const country = String(row.country || "--");
    const key = `${city.toLowerCase()}|${country}`;
    const valid = String(row.verdict || "").toLowerCase() === "valid";
    const gps = String(row.locationSource || "").toLowerCase() === "browser_gps";
    const lastSeenMs = safeDate(row.occurredAt);
    const current = buckets.get(key) || {
      key,
      city,
      country,
      taps: 0,
      valid: 0,
      gps: 0,
      risk: 0,
      lastUid: String(row.uidMasked || "N/A"),
      device: deviceSummary(row),
      lastSeenMs,
    };
    current.taps += 1;
    if (valid) current.valid += 1;
    if (gps) current.gps += 1;
    if (!valid) current.risk += 1;
    if (lastSeenMs >= current.lastSeenMs) {
      current.lastSeenMs = lastSeenMs;
      current.lastUid = String(row.uidMasked || current.lastUid);
      current.device = deviceSummary(row);
    }
    buckets.set(key, current);
  });

  return [...buckets.values()].sort((a, b) => b.taps - a.taps || b.lastSeenMs - a.lastSeenMs).slice(0, 5);
}

function buildMarketOpportunities(
  hotspots: ReturnType<typeof buildHotspots>,
  rows: TenantTapRealtimeEvent[],
): MarketOpportunity[] {
  return hotspots.map((hotspot, index) => {
    const cityRows = rows.filter((row) => {
      const city = String(row.city || "Unknown");
      const country = String(row.country || "--");
      return city === hotspot.city && country === hotspot.country;
    });
    const validRate = hotspot.taps ? (hotspot.valid / hotspot.taps) * 100 : 0;
    const gpsRate = hotspot.taps ? (hotspot.gps / hotspot.taps) * 100 : 0;
    const riskRate = hotspot.taps ? (hotspot.risk / hotspot.taps) * 100 : 0;
    const crmReady = cityRows.filter((row) => String(row.verdict || "").toLowerCase() === "valid" && Boolean(row.uidMasked)).length;
    const audience = Math.max(crmReady, Math.round(hotspot.valid * 1.4 + hotspot.gps * 0.8));

    let channel = "WhatsApp + voucher";
    let offer = "15% club post-tap";
    let playbook = "Enviar voucher de recompra a UIDs válidos y medir canje por ciudad.";
    let reason = "Alta señal válida para fidelización.";

    if (riskRate > 12) {
      channel = "Riesgo + retencion";
      offer = "Beneficio con validacion";
      playbook = "Separar taps sospechosos, auditar device y mandar promo solo a válidos.";
      reason = "La zona vende, pero necesita control antifraude antes de escalar.";
    } else if (gpsRate < 60) {
      channel = "Portal + WhatsApp";
      offer = "Bono por activar GPS";
      playbook = "Pedir opt-in de portal y mejorar precision antes de pauta paga.";
      reason = "Hay demanda, pero falta ubicacion fina para cercanias.";
    } else if (hotspot.taps >= 10) {
      channel = "Instagram + WhatsApp";
      offer = "Drop local 2x1";
      playbook = "Activar pauta local, historias con QR/NFC y cupo limitado por barrio.";
      reason = "Volumen suficiente para campana geolocalizada.";
    } else if (validRate >= 90) {
      channel = "Voucher premium";
      offer = "Early access club";
      playbook = "Premiar primeros compradores y pedir referido en portal de usuario.";
      reason = "Pocos taps, pero de alta calidad comercial.";
    }

    const score = Math.max(
      0,
      Math.min(99, Math.round(validRate * 0.42 + gpsRate * 0.22 + Math.min(hotspot.taps * 7, 28) + crmReady * 2 - riskRate * 0.45)),
    );

    return {
      key: hotspot.key,
      city: hotspot.city,
      country: hotspot.country,
      taps: hotspot.taps,
      validRate,
      gpsRate,
      riskRate,
      crmReady,
      audience,
      score,
      channel,
      offer,
      playbook,
      reason,
      campaignName: `Growth ${index + 1}: ${hotspot.city}`,
    };
  }).sort((a, b) => b.score - a.score || b.taps - a.taps).slice(0, 5);
}

function MiniSparkline({ data, color, dataKey = "taps" }: { data: Array<Record<string, number | string>>; color: string; dataKey?: string }) {
  return (
    <div className="h-7 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  tone,
  data,
  dataKey,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  delta: string;
  tone: "cyan" | "green" | "red" | "blue";
  data: Array<Record<string, number | string>>;
  dataKey?: string;
}) {
  const color = tone === "red" ? "#ef4444" : tone === "green" ? "#22c55e" : tone === "blue" ? "#60a5fa" : "#22d3ee";
  return (
    <div className="rounded-lg border border-slate-700/70 bg-[linear-gradient(180deg,rgba(17,31,52,.92),rgba(7,15,29,.94))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-300">
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <span className={tone === "red" ? "text-[11px] font-semibold text-red-300" : "text-[11px] font-semibold text-emerald-300"}>{delta}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-black tracking-[-0.02em] text-white">{value}</p>
        <p className="pb-1 text-[10px] text-slate-500">vs ventana previa</p>
      </div>
      <div className="mt-1">
        <MiniSparkline data={data} color={color} dataKey={dataKey} />
      </div>
    </div>
  );
}

function FunnelNode({ icon, label, value, pct, tone }: { icon: ReactNode; label: string; value: number; pct: number; tone: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border shadow-[0_0_26px_rgba(34,211,238,.18)]" style={{ borderColor: tone, background: `${tone}22`, color: tone }}>
        {icon}
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-200">{label}</p>
      <p className="text-sm font-black text-white">{formatNumber(value)}</p>
      <p className="text-xs text-slate-400">{formatPercent(pct)}</p>
    </div>
  );
}

export function ExecutiveRealtimeCrm({
  initialEvents,
  tenantScope,
  mode,
  onSectionChange,
}: {
  initialEvents: TenantTapRealtimeEvent[];
  tenantScope: string;
  mode: MapMode;
  onSectionChange?: (section: CrmSection) => void;
}) {
  const [events, setEvents] = useState(() => sortRealtimeEvents(initialEvents, 50));
  const [connected, setConnected] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState(initialEvents[0]?.occurredAt || new Date().toISOString());
  const [selectedTenant, setSelectedTenant] = useState("all");
  const [mapView, setMapView] = useState<MapView>("heat");
  const [baseMap, setBaseMap] = useState<BaseMapLayer>("dark");
  const [mapZoom, setMapZoom] = useState(1);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [clock, setClock] = useState("");
  const [campaignDraft, setCampaignDraft] = useState<string | null>(null);
  const lastEventIdRef = useRef("");
  const mapPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.body.classList.add("nexid-crm-overlay-active");
    return () => document.body.classList.remove("nexid-crm-overlay-active");
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString("es-AR")), 1000);
    setClock(new Date().toLocaleTimeString("es-AR"));
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsMapFullscreen(document.fullscreenElement === mapPanelRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const streamUrl = new URL("/api/admin/events/stream", window.location.origin);
    streamUrl.searchParams.set("limit", "50");
    streamUrl.searchParams.set("range", timeRange);
    streamUrl.searchParams.set("source", "all");
    if (tenantScope) streamUrl.searchParams.set("tenant", tenantScope);

    const source = new EventSource(streamUrl.toString());
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { rows?: TenantTapRealtimeEvent[] };
        if (!Array.isArray(payload.rows)) return;
        setEvents((prev) => sortRealtimeEvents([...(payload.rows || []), ...prev], 50));
        setLastUpdateAt(new Date().toISOString());
      } catch {
        // keep previous state
      }
    };

    const onEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as TenantTapRealtimeEvent;
        const incomingId = String(payload.eventId || "");
        if (incomingId && incomingId === lastEventIdRef.current) return;
        lastEventIdRef.current = incomingId;
        setEvents((prev) => mergeRealtimeEvents(prev, payload, 50));
        setLastUpdateAt(new Date().toISOString());
      } catch {
        // keep previous state
      }
    };

    source.addEventListener("snapshot", onSnapshot as EventListener);
    source.addEventListener("event", onEvent as EventListener);
    return () => {
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.removeEventListener("event", onEvent as EventListener);
      source.close();
    };
  }, [tenantScope, timeRange]);

  const tenantOptions = useMemo(
    () => [...new Set(events.map((event) => String(event.tenantSlug || "unknown").toLowerCase()))].filter(Boolean).sort(),
    [events],
  );

  const visibleEvents = useMemo(
    () => {
      const cutoff = Date.now() - timeRangeMs(timeRange);
      return (selectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === selectedTenant))
        .filter((event) => {
          const at = safeDate(event.occurredAt);
          return !at || at >= cutoff;
        });
    },
    [events, selectedTenant, timeRange],
  );

  const cycleTimeRange = () => {
    setTimeRange((current) => current === "5m" ? "1h" : current === "1h" ? "24h" : "5m");
  };

  const metrics = useMemo(() => {
    const total = visibleEvents.length;
    const valid = visibleEvents.filter((event) => String(event.verdict || "").toLowerCase() === "valid").length;
    const risk = Math.max(0, total - valid);
    const gps = visibleEvents.filter((event) => String(event.locationSource || "").toLowerCase() === "browser_gps").length;
    const actionable = visibleEvents.filter((event) => {
      const hasLocation = Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng));
      return String(event.verdict || "").toLowerCase() === "valid" && hasLocation && Boolean(event.uidMasked);
    }).length;
    const offerReady = buildHotspots(visibleEvents).filter((item) => item.valid > 0).length;
    return {
      total,
      valid,
      risk,
      gps,
      actionable,
      offerReady,
      validRate: total ? (valid / total) * 100 : 0,
      fraudRate: total ? (risk / total) * 100 : 0,
      gpsCoverage: total ? (gps / total) * 100 : 0,
      leadConversion: total ? (actionable / total) * 100 : 0,
    };
  }, [visibleEvents]);

  const velocitySeries = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const start = now - (11 - index) * 2 * 60_000;
      return {
        label: new Date(start).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        taps: 0,
        risk: 0,
        valid: 0,
      };
    });
    visibleEvents.forEach((event) => {
      const at = safeDate(event.occurredAt);
      if (!at) return;
      const diff = Math.floor((now - at) / (2 * 60_000));
      const bucket = 11 - diff;
      if (bucket < 0 || bucket > 11) return;
      buckets[bucket].taps += 1;
      if (String(event.verdict || "").toLowerCase() === "valid") buckets[bucket].valid += 1;
      else buckets[bucket].risk += 1;
    });
    return buckets;
  }, [visibleEvents]);

  const hotspots = useMemo(() => buildHotspots(visibleEvents), [visibleEvents]);
  const marketOpportunities = useMemo(() => buildMarketOpportunities(hotspots, visibleEvents), [hotspots, visibleEvents]);
  const topOpportunity = marketOpportunities[0] || null;
  const latestEvent = visibleEvents[0] || null;
  const todayLabel = useMemo(() => new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", ""), []);

  const alerts = useMemo(() => {
    const rows: Array<{ id: string; tone: "red" | "amber" | "blue"; title: string; detail: string; time: string }> = [];
    if (metrics.fraudRate > 10) {
      rows.push({ id: `risk-${hotspots[0]?.key || "operation"}`, tone: "red", title: `Riesgo elevado en ${hotspots[0]?.city || "la operación"}`, detail: `Tasa de riesgo ${formatPercent(metrics.fraudRate)} en la ventana visible`, time: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) });
    }
    if (metrics.gpsCoverage < 60 && metrics.total > 0) {
      rows.push({ id: `gps-${metrics.total}-${Math.round(metrics.gpsCoverage)}`, tone: "amber", title: "Cobertura GPS baja", detail: `Solo ${formatPercent(metrics.gpsCoverage)} de taps con GPS real`, time: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) });
    }
    visibleEvents.filter((event) => String(event.verdict || "").toLowerCase() !== "valid").slice(0, 3).forEach((event, index) => {
      rows.push({ id: `exception-${String(event.eventId || event.uidMasked || "uid")}-${index}`, tone: "amber", title: `UID con excepción ${event.uidMasked}`, detail: `${event.city || "sin ciudad"} · ${deviceSummary(event)}`, time: timeAgo(event.occurredAt) });
    });
    if (metrics.actionable > 0) {
      rows.push({ id: `actionable-${String(latestEvent?.eventId || metrics.actionable)}`, tone: "blue", title: "Pico de actividad listo para CRM", detail: `${metrics.actionable} taps válidos tienen ubicación accionable`, time: timeAgo(latestEvent?.occurredAt) });
    }
    return rows.slice(0, 4);
  }, [hotspots, latestEvent, metrics, visibleEvents]);

  const handleExport = () => {
    exportToCsv(
      `nexid-crm-realtime-${selectedTenant}-${new Date().toISOString().slice(0, 10)}`,
      visibleEvents.map((event) => ({
        eventId: event.eventId,
        tenant: event.tenantSlug || "",
        uid: event.uidMasked,
        occurredAt: event.occurredAt,
        verdict: event.verdict,
        city: event.city || "",
        country: event.country || "",
        location: locationSourceLabel(event),
        device: deviceSummary(event),
      })),
      [
        { key: "eventId", label: "Evento" },
        { key: "tenant", label: "Tenant" },
        { key: "uid", label: "UID" },
        { key: "occurredAt", label: "Fecha" },
        { key: "verdict", label: "Veredicto" },
        { key: "city", label: "Ciudad" },
        { key: "country", label: "País" },
        { key: "location", label: "Ubicación" },
        { key: "device", label: "Dispositivo" },
      ],
    );
  };

  const rowsForOpportunity = (opportunity: MarketOpportunity) => {
    return visibleEvents.filter((event) => {
      const city = String(event.city || "Unknown");
      const country = String(event.country || "--");
      return city === opportunity.city && country === opportunity.country;
    });
  };

  const handleCampaignExport = (opportunity: MarketOpportunity) => {
    const rows = rowsForOpportunity(opportunity);
    exportToCsv(
      `nexid-growth-segment-${opportunity.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`,
      rows.map((event) => ({
        campaign: opportunity.campaignName,
        city: opportunity.city,
        country: opportunity.country,
        channel: opportunity.channel,
        offer: opportunity.offer,
        tenant: event.tenantSlug || "",
        uid: event.uidMasked,
        verdict: event.verdict,
        occurredAt: event.occurredAt,
        product: event.productName || "",
        device: deviceSummary(event),
        location: locationSourceLabel(event),
      })),
      [
        { key: "campaign", label: "Campana" },
        { key: "city", label: "Ciudad" },
        { key: "country", label: "Pais" },
        { key: "channel", label: "Canal sugerido" },
        { key: "offer", label: "Promo sugerida" },
        { key: "tenant", label: "Tenant" },
        { key: "uid", label: "UID" },
        { key: "verdict", label: "Veredicto" },
        { key: "occurredAt", label: "Fecha" },
        { key: "product", label: "Producto" },
        { key: "device", label: "Dispositivo" },
        { key: "location", label: "Ubicacion" },
      ],
    );
    setCampaignDraft(`${opportunity.campaignName}: segmento ${opportunity.channel} exportado (${rows.length} taps).`);
  };

  const openCampaignStudio = (opportunity: MarketOpportunity) => {
    const params = new URLSearchParams({
      city: opportunity.city,
      country: opportunity.country,
      channel: opportunity.channel,
      offer: opportunity.offer,
      audience: String(opportunity.audience),
    });
    window.location.href = `/loyalty/campaigns?${params.toString()}`;
  };

  const toggleMapFullscreen = async () => {
    const panel = mapPanelRef.current;
    if (!panel) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
    } catch {
      setIsMapFullscreen(false);
    }
  };

  const openStreetView = () => {
    const target = visibleEvents.find((event) => Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng)));
    if (!target) return;
    const lat = Number(target.lat);
    const lng = Number(target.lng);
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`, "_blank", "noopener,noreferrer");
  };

  const railItems = [
    { icon: <Activity className="h-6 w-6" />, active: true, label: "Realtime CRM", action: () => onSectionChange?.("summary") },
    { icon: <Globe className="h-5 w-5" />, label: "Mapa", action: () => setMapView("heat") },
    { icon: <Target className="h-5 w-5" />, label: "Cercanías", action: () => setMapView("nearby") },
    { icon: <Users className="h-5 w-5" />, label: "Clientes", action: () => onSectionChange?.("loyalty") },
    { icon: <ShieldCheck className="h-5 w-5" />, label: "Riesgo", action: () => setMapView("points") },
    { icon: <BarChart3 className="h-5 w-5" />, label: "Analítica", action: () => onSectionChange?.("summary") },
    { icon: <Settings className="h-5 w-5" />, label: "Ajustes", action: () => setSelectedTenant("all") },
  ];

  return (
    <div className="nexid-crm-shell fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-[#030a16] text-slate-100 lg:overflow-hidden">
      <div className="nexid-crm-backdrop pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(14,165,233,.16),transparent_32%),linear-gradient(180deg,#05101f,#030713_55%,#030713)]" />
      <header className="relative z-10 flex min-h-[70px] flex-wrap items-center gap-3 border-b border-cyan-200/10 bg-[#06101d]/90 px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,.04)] lg:h-[70px] lg:flex-nowrap lg:px-4 lg:py-0">
        <div className="flex w-full items-center gap-4 sm:w-auto lg:w-[510px] lg:gap-5">
          <div className="pr-4 text-[24px] font-black tracking-[-0.04em] text-white lg:pr-6 lg:text-[28px]">
            nex<span className="text-cyan-300">ID</span>
          </div>
          <div className="border-l border-white/10 pl-4 lg:pl-5">
            <p className="text-xs text-slate-400">Centro de Control</p>
            <h1 className="text-xl font-black tracking-[-0.03em] text-white lg:text-2xl">CRM realtime</h1>
          </div>
        </div>

        <nav className="order-3 grid h-11 w-full grid-cols-3 overflow-hidden rounded-xl border border-white/8 bg-slate-950/45 text-xs font-semibold text-slate-300 sm:text-sm lg:order-none lg:mx-auto lg:h-12 lg:w-[470px]">
          <button type="button" title="Volver al cockpit de CRM realtime" onClick={() => onSectionChange?.("summary")} className="flex items-center justify-center gap-2 border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200">
            <Activity className="h-4 w-4" /> Realtime CRM
          </button>
          <button type="button" title="Abrir rollout operativo: lotes, tags, preflight y tokenización" onClick={() => onSectionChange?.("infra")} className="flex items-center justify-center gap-2 hover:bg-white/5">
            <Truck className="h-4 w-4" /> Rollout
          </button>
          <button type="button" title="Abrir clientes, loyalty y campañas post-tap" onClick={() => onSectionChange?.("loyalty")} className="flex items-center justify-center gap-2 hover:bg-white/5">
            <Users className="h-4 w-4" /> Customers
          </button>
        </nav>

        <div className="ml-0 flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-300 lg:ml-auto lg:w-auto lg:flex-nowrap lg:justify-start lg:gap-5">
          <span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> Sistema operativo</span>
          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-500" /> {clock}</span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-500" /> {todayLabel}</span>
          <button type="button" title="Filtrar la consola al tenant de tu sesión" className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-950/55 px-3 py-2 text-left" onClick={() => setSelectedTenant(tenantScope || "all")}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">TA</span>
            <span><b className="block text-white">Tenant Admin</b>{selectedTenant === "all" ? tenantScope || "Bodega Balmec" : selectedTenant}</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>

      <aside className="absolute bottom-0 left-0 top-[70px] z-10 hidden w-20 flex-col items-center border-r border-cyan-200/10 bg-[#07111e]/92 py-4 lg:flex">
        <div className="space-y-4">
          {railItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={item.action}
              className={`group relative grid h-12 w-12 place-items-center rounded-xl transition ${item.active ? "bg-cyan-400/16 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,.18)]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              {item.icon}
              <span className="pointer-events-none absolute left-14 top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <button type="button" title="Cerrar sesión" onClick={() => { window.location.href = "/logout"; }} className="mt-auto grid h-10 w-10 place-items-center rounded-lg border border-white/8 text-slate-500 hover:text-white" aria-label="Salir">
          <LogOut className="h-5 w-5" />
        </button>
      </aside>

      <main className="relative z-10 grid min-h-[calc(100vh-70px)] grid-cols-1 gap-4 overflow-visible px-3 py-4 pb-14 lg:ml-20 lg:h-[calc(100vh-102px)] lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-5 lg:overflow-hidden lg:p-5">
        <section className="order-2 min-h-0 space-y-3 overflow-hidden lg:order-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Visión ejecutiva en vivo</h2>
            <span className="flex items-center gap-2 text-xs text-slate-400"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> {connected ? "En vivo" : "Sincronizando"}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricCard icon={<Radio className="h-5 w-5" />} label="Taps en vivo" value={formatNumber(metrics.total)} delta="↗ real" tone="cyan" data={velocitySeries} />
            <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Tasa válida" value={formatPercent(metrics.validRate)} delta="↗ limpio" tone="green" data={velocitySeries} dataKey="valid" />
            <MetricCard icon={<ShieldAlert className="h-5 w-5" />} label="Riesgo de fraude" value={formatPercent(metrics.fraudRate)} delta={metrics.risk ? "↗ revisar" : "0 alertas"} tone="red" data={velocitySeries} dataKey="risk" />
            <MetricCard icon={<MapPin className="h-5 w-5" />} label="Cobertura GPS real" value={formatPercent(metrics.gpsCoverage)} delta="GPS" tone="green" data={velocitySeries} />
            <MetricCard icon={<Users className="h-5 w-5" />} label="Leads capturados" value={formatNumber(metrics.actionable)} delta="CRM listo" tone="blue" data={velocitySeries} dataKey="valid" />
            <MetricCard icon={<Filter className="h-5 w-5" />} label="Conversión a lead" value={formatPercent(metrics.leadConversion)} delta="post-tap" tone="green" data={velocitySeries} dataKey="valid" />
          </div>

          <div className="rounded-lg border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Velocidad de taps <span className="font-normal text-slate-400">(taps por minuto)</span></p>
              <button type="button" title="Cambiar ventana temporal del CRM" onClick={cycleTimeRange} className="rounded-lg border border-white/8 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">{timeRangeLabel(timeRange)}</button>
            </div>
            <div className="mt-3 h-[118px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocitySeries} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="execTaps" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="taps" stroke="#22d3ee" strokeWidth={2} fill="url(#execTaps)" dot={{ r: 2, fill: "#22d3ee" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Funnel post-tap</p>
              <span className="text-xs text-slate-500">CRM-ready: {metrics.actionable ? `${metrics.actionable} taps accionables` : "sin leads accionables"}</span>
            </div>
            <div className="mt-4 flex items-start gap-2">
              <FunnelNode icon={<MousePointerClick className="h-6 w-6" />} label="Tap" value={metrics.total} pct={100} tone="#22d3ee" />
              <span className="mt-4 text-xl text-slate-600">→</span>
              <FunnelNode icon={<ShieldCheck className="h-6 w-6" />} label="Válido" value={metrics.valid} pct={metrics.validRate} tone="#22c55e" />
              <span className="mt-4 text-xl text-slate-600">→</span>
              <FunnelNode icon={<BadgeCheck className="h-6 w-6" />} label="Claim" value={metrics.gps} pct={metrics.gpsCoverage} tone="#facc15" />
              <span className="mt-4 text-xl text-slate-600">→</span>
              <FunnelNode icon={<Users className="h-6 w-6" />} label="Lead" value={metrics.actionable} pct={metrics.leadConversion} tone="#a855f7" />
              <span className="mt-4 text-xl text-slate-600">→</span>
              <FunnelNode icon={<Tags className="h-6 w-6" />} label="Oferta" value={metrics.offerReady} pct={metrics.total ? (metrics.offerReady / metrics.total) * 100 : 0} tone="#38bdf8" />
            </div>
          </div>
        </section>

        <section className="order-1 grid min-h-0 grid-rows-none gap-4 lg:order-2 lg:grid-rows-[minmax(0,1fr)_340px]">
          <div className="grid min-h-0 grid-rows-none lg:grid-rows-[auto_minmax(0,1fr)]">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Mapa vivo de taps</h2>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">● En vivo</span>
              </div>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <select size={1} title="Filtrar taps por tenant" value={selectedTenant} onChange={(event) => setSelectedTenant(event.target.value)} className="col-span-2 h-9 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white sm:col-span-1 sm:w-auto sm:min-w-[150px]">
                  <option value="all">Todos los tenants</option>
                  {tenantOptions.map((tenant) => <option key={tenant} value={tenant}>{tenant}</option>)}
                </select>
                <select size={1} title="Cambiar ventana temporal del mapa y KPIs" value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRange)} className="h-9 min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white">
                  {TIME_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" title="Exportar eventos visibles a CSV" onClick={handleExport} className="flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-4 text-sm text-white hover:border-cyan-300/50"><Download className="h-4 w-4" /> Exportar</button>
              </div>
            </div>

            <div ref={mapPanelRef} className={`relative overflow-hidden border border-cyan-100/10 bg-[#061426] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ${isMapFullscreen ? "h-screen min-h-screen rounded-none border-cyan-300/25 bg-[#020713]" : "min-h-[700px] rounded-xl sm:min-h-[650px] lg:min-h-0"}`}>
              <div className="absolute left-4 top-4 z-20 grid gap-2">
                <button type="button" title="Acercar mapa sin agrandar artificialmente los taps" onClick={() => setMapZoom((value) => Math.min(1.22, Number((value + 0.08).toFixed(2))))} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-white" aria-label="Acercar mapa">+</button>
                <button type="button" title="Alejar mapa para ver más territorio" onClick={() => setMapZoom((value) => Math.max(0.9, Number((value - 0.08).toFixed(2))))} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-white" aria-label="Alejar mapa">−</button>
                <button type="button" title="Mostrar radio de cercanía por hotspot" onClick={() => setMapView("nearby")} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-cyan-200" aria-label="Mostrar cercanías"><Crosshair className="h-4 w-4" /></button>
                <button type="button" title="Mostrar puntos individuales de tap" onClick={() => setMapView("points")} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-cyan-200" aria-label="Mostrar puntos"><Layers className="h-4 w-4" /></button>
              </div>

              <div className="absolute left-[72px] right-3 top-4 z-30 flex flex-wrap items-center justify-end gap-2 lg:left-auto lg:right-5 lg:flex-nowrap">
                {[
                  ["heat", <Activity key="heat" className="h-4 w-4" />, "Calor"],
                  ["points", <MapPin key="points" className="h-4 w-4" />, "Puntos"],
                  ["nearby", <Crosshair key="nearby" className="h-4 w-4" />, "Cercanías"],
                ].map(([key, icon, label]) => (
                  <button key={String(key)} type="button" title={key === "heat" ? "Ver concentración de actividad por ciudad" : key === "points" ? "Ver taps individuales como puntos chicos" : "Ver radios de cercanía accionables"} onClick={() => setMapView(key as MapView)} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${mapView === key ? "border-cyan-300 bg-cyan-400/12 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-white/10 bg-slate-950/65 text-slate-300"}`}>
                    {icon}{label}
                  </button>
                ))}
                <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-slate-950/70 p-1 xl:flex" title="Cambiar capa base del mapa">
                  {BASEMAP_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      title={option.title}
                      onClick={() => setBaseMap(option.value)}
                      className={`h-7 rounded-md px-2 text-[11px] font-black uppercase tracking-[0.06em] ${baseMap === option.value ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" title="Abrir Google Maps Street View en la coordenada más reciente" onClick={openStreetView} className="hidden h-9 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/65 px-3 text-sm font-semibold text-slate-300 hover:border-cyan-300/50 hover:text-cyan-100 xl:flex"><Globe className="h-4 w-4" /> Street</button>
                <button type="button" title="Restablecer mapa: calor y zoom normal" onClick={() => { setMapView("heat"); setMapZoom(1); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/65 text-slate-300" aria-label="Restablecer mapa"><Settings className="h-4 w-4" /></button>
                <button type="button" title={isMapFullscreen ? "Salir de pantalla completa" : "Pantalla completa real para monitor de control"} onClick={() => void toggleMapFullscreen()} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/65 text-slate-300 hover:border-cyan-300/50 hover:text-cyan-100" aria-label={isMapFullscreen ? "Salir de pantalla completa" : "Abrir pantalla completa"}><Expand className="h-4 w-4" /></button>
              </div>

              <div className="absolute bottom-[260px] left-4 z-20 rounded-lg border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-200 shadow-xl lg:bottom-20">
                {[
                  ["Muy alto", "bg-red-500"],
                  ["Alto", "bg-amber-400"],
                  ["Medio", "bg-lime-400"],
                  ["Bajo", "bg-sky-400"],
                ].map(([label, color]) => (
                  <p key={label} className="mt-1 flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}</p>
                ))}
              </div>

              <div className="h-[420px] w-full p-3 pt-[76px] lg:h-full lg:p-3 lg:pr-[300px]">
                <RealtimeMapLibreMap hotspots={hotspots} events={visibleEvents} mapView={mapView} mode={mode} zoom={mapZoom} baseMap={baseMap} />
              </div>

              <div className="relative z-20 m-3 mt-0 max-h-[250px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/72 p-3 shadow-2xl backdrop-blur lg:absolute lg:bottom-4 lg:right-4 lg:top-[76px] lg:m-0 lg:w-[270px] lg:max-h-none">
                <p className="text-sm font-semibold text-white">Eventos cercanos (5 km)</p>
                <div className="mt-3 space-y-2">
                  {visibleEvents.slice(0, 4).map((event) => {
                    const valid = String(event.verdict || "").toLowerCase() === "valid";
                    return (
                      <div key={String(event.eventId || `${event.uidMasked}-${event.occurredAt}`)} className="rounded-lg border border-white/8 bg-slate-900/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500">{new Date(String(event.occurredAt || Date.now())).toLocaleTimeString("es-AR")}</p>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${valid ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{valid ? "Válido" : "Riesgo"}</span>
                        </div>
                        <p className="mt-1 text-sm font-black text-white">UID: {event.uidMasked}</p>
                        <p className="text-xs text-slate-400">{deviceSummary(event)}</p>
                      </div>
                    );
                  })}
                </div>
                <button type="button" title="Abrir la auditoría completa de eventos" onClick={() => { window.location.href = "/events"; }} className="mt-3 text-sm font-semibold text-cyan-300">Ver todos los eventos</button>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_392px]">
            <div className="rounded-xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_36%),linear-gradient(180deg,rgba(10,24,43,.98),rgba(4,10,20,.95))] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-white">
                  <Megaphone className="h-4 w-4 text-cyan-300" />
                  <span className="truncate">Inteligencia comercial por zona</span>
                  <span className="hidden text-sm font-normal text-slate-400 sm:inline">(promos, vouchers, stock y logística)</span>
                </p>
                <button type="button" title="Abrir Growth & BotIA para crear campañas con estas señales" onClick={() => { window.location.href = "/loyalty/campaigns"; }} className="shrink-0 text-sm font-semibold text-cyan-300">Growth & BotIA</button>
              </div>

              {topOpportunity ? (
                <div className="mb-3 grid gap-3 rounded-xl border border-cyan-300/20 bg-cyan-400/8 p-3 text-xs text-slate-300 sm:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold uppercase tracking-[0.08em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> Acción recomendada</p>
                    <p className="mt-1 text-sm leading-5">
                      Activar <b className="text-white">{topOpportunity.offer}</b> en <b className="text-white">{topOpportunity.city}</b> por {topOpportunity.channel}. Priorizar stock, QR/NFC activos y puntos de canje donde ya hay <b className="text-white">{topOpportunity.taps}</b> taps.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2"><b className="block text-base text-white">{topOpportunity.score}</b> score</span>
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2"><b className="block text-base text-white">{topOpportunity.audience}</b> audiencia</span>
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2"><b className="block text-base text-white">{formatPercent(topOpportunity.validRate)}</b> válido</span>
                  </div>
                </div>
              ) : null}

              {campaignDraft ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                  <BadgeCheck className="h-4 w-4" /> {campaignDraft}
                </div>
              ) : null}

              <div className="max-h-[210px] space-y-2 overflow-y-auto pr-1 lg:max-h-[220px]">
                {marketOpportunities.length ? marketOpportunities.map((opportunity) => (
                  <div key={opportunity.key} className="rounded-xl border border-white/8 bg-slate-950/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <b className="block truncate text-sm text-white">{opportunity.city}, {opportunity.country}</b>
                        <span className="block truncate text-[11px] text-slate-400">{opportunity.reason}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-xs font-bold text-cyan-200">{opportunity.score}/99</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block text-sm text-white">{opportunity.audience}</b> audiencia CRM</span>
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block truncate text-sm text-white">{opportunity.channel}</b> canal</span>
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block truncate text-sm text-emerald-200">{opportunity.offer}</b> promo</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" title={`Exportar audiencia de ${opportunity.city} con UIDs, canal y promo sugerida`} onClick={() => handleCampaignExport(opportunity)} className="rounded-md border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:border-cyan-300/50">
                        <Download className="mr-1 inline h-3.5 w-3.5" /> CSV
                      </button>
                      <button type="button" title={`Abrir campana para ${opportunity.city}: ${opportunity.playbook}`} onClick={() => openCampaignStudio(opportunity)} className="rounded-md border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:border-emerald-200/60">
                        <Send className="mr-1 inline h-3.5 w-3.5" /> Campana
                      </button>
                      <span className="min-w-0 truncate text-[11px] text-slate-500"><Gift className="mr-1 inline h-3.5 w-3.5 text-emerald-300" /> {opportunity.playbook}</span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-white/8 bg-slate-950/48 px-3 py-5 text-sm text-slate-400">
                    Sin zonas accionables todavía. Apenas entren taps válidos, la IA prioriza ciudad, canal, promo y logística.
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-white">Alertas y excepciones <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs">{alerts.length}</span></p>
                <button type="button" title="Abrir todas las alertas y excepciones" onClick={() => { window.location.href = "/events"; }} className="text-sm font-semibold text-cyan-300">Ver todas</button>
              </div>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center gap-3 rounded-lg border border-white/6 bg-slate-900/60 px-3 py-1.5">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${alert.tone === "red" ? "bg-red-500/12 text-red-300" : alert.tone === "amber" ? "bg-amber-400/12 text-amber-300" : "bg-sky-400/12 text-sky-300"}`}>
                      {alert.tone === "red" ? <ShieldAlert className="h-3.5 w-3.5" /> : alert.tone === "amber" ? <Target className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-xs text-white">{alert.title}</b>
                      <span className="block truncate text-[11px] text-slate-400">{alert.detail}</span>
                    </span>
                    <span className="text-xs text-slate-500">{alert.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-20 flex h-9 items-center justify-between gap-3 border-t border-white/8 bg-[#06101d]/95 px-3 text-[11px] text-slate-400 lg:absolute lg:h-8 lg:px-8 lg:text-xs">
        <span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> {connected ? "Conectado al stream en tiempo real" : "Reconectando stream"}</span>
        <span className="hidden sm:inline">Actualizado: {timeAgo(lastUpdateAt)}</span>
        <span className="hidden md:inline">Fuente: nexID Core · Precisión de ubicación: {latestEvent?.locationAccuracyM ? `±${Math.round(Number(latestEvent.locationAccuracyM))} m` : "según evento"}</span>
      </footer>
    </div>
  );
}
