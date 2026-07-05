"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CalendarDays,
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
import { TenantAccountMenu } from "./tenant-account-menu";
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
  { value: "dark", label: "Control", title: "Capa base oscura para sala de control" },
  { value: "light", label: "Calles", title: "Capa de calles para ubicar comercios y barrios" },
  { value: "satellite", label: "Imagen", title: "Capa de imagen satelital provista por el mapa base" },
  { value: "terrain", label: "Relieve", title: "Capa de relieve y sombreado para lectura territorial" },
];

const MAP_VIEW_OPTIONS: Array<{ value: MapView; label: string; title: string; description: string; icon: ReactNode }> = [
  {
    value: "heat",
    label: "Densidad",
    title: "Ver concentración de lecturas por ciudad o zona",
    description: "Concentración relativa de lecturas NFC/QR; no equivale a ventas confirmadas.",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    value: "points",
    label: "Eventos",
    title: "Ver lecturas individuales como puntos",
    description: "Cada punto representa un evento visible del stream, con color por riesgo.",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    value: "nearby",
    label: "Cercanía",
    title: "Ver radios visuales para priorizar acciones por zona",
    description: "Radio visual de cercanía comercial; no activa geofencing automático.",
    icon: <Crosshair className="h-4 w-4" />,
  },
];

type CommercialContext = {
  key: "wine" | "agro" | "general";
  panelTitle: string;
  panelSubtitle: string;
  headline: string;
  noData: string;
  playbooks: Array<{ eyebrow: string; title: string; body: string }>;
};

const COMMERCIAL_CONTEXTS: Record<CommercialContext["key"], CommercialContext> = {
  wine: {
    key: "wine",
    panelTitle: "IA de cercanía comercial",
    panelSubtitle: "reglas sobre lecturas visibles para priorizar ciudad, club, stock y canje",
    headline: "Próxima acción comercial",
    noData: "Cuando entren lecturas válidas, la consola prioriza ciudad, club, voucher, stock y punto de canje.",
    playbooks: [
      {
        eyebrow: "Señal",
        title: "Unidad verificada",
        body: "Cada botella, caja o ticket queda unido a NFC/QR, lote, producto, ciudad y momento real de lectura.",
      },
      {
        eyebrow: "Zona",
        title: "Actividad por ciudad",
        body: "El CRM muestra dónde hay lecturas válidas, audiencia accionable y actividad suficiente para reponer o pautar.",
      },
      {
        eyebrow: "Acción",
        title: "Club y recompra",
        body: "Activa voucher, cata, visita guiada, WhatsApp/email y recompra desde el mismo evento.",
      },
    ],
  },
  agro: {
    key: "agro",
    panelTitle: "IA de cercanía comercial",
    panelSubtitle: "reglas sobre lecturas visibles para priorizar canal, territorio, stock y soporte",
    headline: "Zona agro accionable",
    noData: "Cuando entren lecturas válidas, la consola prioriza lote, canal, región, uso responsable y soporte técnico.",
    playbooks: [
      {
        eyebrow: "Señal",
        title: "Unidad física verificada",
        body: "Bolsa, bidón, caja o ticket queda unido a NFC/QR, lote, canal y geografía real del tap.",
      },
      {
        eyebrow: "Zona",
        title: "Canal y territorio",
        body: "El CRM muestra actividad por zona, GPS bajo, riesgo, canal gris y audiencia lista para soporte o campaña.",
      },
      {
        eyebrow: "Acción",
        title: "Post-venta accionable",
        body: "Activa capacitación, uso responsable, reclamos, garantía, recompra y logística desde el mismo evento.",
      },
    ],
  },
  general: {
    key: "general",
    panelTitle: "IA de cercanía comercial",
    panelSubtitle: "reglas sobre lecturas visibles para priorizar zona, segmento, canal y acción",
    headline: "Dónde actuar ahora",
    noData: "Cuando entren lecturas válidas, la consola prioriza ciudad, segmento, canal y acción comercial.",
    playbooks: [
      {
        eyebrow: "Señal",
        title: "Producto real",
        body: "Cada unidad queda unida a NFC/QR, lote, ubicación, evento y contexto de cliente.",
      },
      {
        eyebrow: "Zona",
        title: "Actividad por zona",
        body: "El CRM muestra ciudades con actividad, riesgo, lectura válida y audiencia accionable.",
      },
      {
        eyebrow: "Acción",
        title: "Accion post-tap",
        body: "Activa beneficio, soporte, encuesta, ticket, recompra o campaña desde el mismo tap.",
      },
    ],
  },
};

const DEFAULT_CONSOLE_TIMEZONE = "America/Argentina/Buenos_Aires";

const TENANT_TIMEZONE_HINTS: Record<string, string> = {
  demobodega: DEFAULT_CONSOLE_TIMEZONE,
  bodegabalmec: DEFAULT_CONSOLE_TIMEZONE,
  "bodega-balmec": DEFAULT_CONSOLE_TIMEZONE,
};

const COUNTRY_TIMEZONE_HINTS: Record<string, string> = {
  AR: DEFAULT_CONSOLE_TIMEZONE,
  UY: "America/Montevideo",
  CL: "America/Santiago",
  BR: "America/Sao_Paulo",
  PY: "America/Asuncion",
  BO: "America/La_Paz",
  PE: "America/Lima",
  CO: "America/Bogota",
  MX: "America/Mexico_City",
  US: "America/New_York",
  ES: "Europe/Madrid",
};

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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function validTimeZone(value: unknown) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    new Intl.DateTimeFormat("es-AR", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "";
  }
}

function formatInTimeZone(value: unknown, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const ms = safeDate(value) || Date.now();
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone }).format(new Date(ms));
}

function formatTimeInZone(value: unknown, timeZone: string) {
  return formatInTimeZone(value, timeZone, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatShortTimeInZone(value: unknown, timeZone: string) {
  return formatInTimeZone(value, timeZone, { hour: "2-digit", minute: "2-digit" });
}

function formatDateInZone(value: unknown, timeZone: string) {
  return formatInTimeZone(value, timeZone, { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
}

function formatDateTimeInZone(value: unknown, timeZone: string) {
  return formatInTimeZone(value, timeZone, { dateStyle: "short", timeStyle: "medium" });
}

function timezoneLabel(timeZone: string) {
  return timeZone.replace(/^America\//, "").replace(/^Europe\//, "").replace(/_/g, " ");
}

function tenantDisplayName(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  if (!value || normalized === "all") return "Todos los tenants";
  if (normalized === "demobodega" || normalized === "bodegabalmec" || normalized === "bodega-balmec") return "Bodega Balmec";
  return String(value);
}

function resolveConsoleTimezone(rows: TenantTapRealtimeEvent[], selectedTenant: string, tenantScope: string) {
  const selectedSlug = selectedTenant !== "all" ? selectedTenant : tenantScope;
  const tenantHint = TENANT_TIMEZONE_HINTS[String(selectedSlug || "").toLowerCase()];
  if (tenantHint) return tenantHint;

  for (const row of rows) {
    const zone = validTimeZone(row.timezone);
    if (zone) return zone;
  }

  for (const row of rows) {
    const country = String(row.country || "").toUpperCase();
    const zone = validTimeZone(COUNTRY_TIMEZONE_HINTS[country]);
    if (zone) return zone;
  }

  return DEFAULT_CONSOLE_TIMEZONE;
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
    let playbook = "Enviar beneficio a UIDs válidos y medir canje por ciudad.";
    let reason = "Señal válida suficiente para probar fidelización.";

    if (riskRate > 12) {
      channel = "Riesgo + retención";
      offer = "Beneficio con validación";
      playbook = "Separar lecturas sospechosas, auditar dispositivo y mandar beneficio solo a válidos.";
      reason = "La zona tiene actividad, pero necesita control antifraude antes de escalar.";
    } else if (gpsRate < 60) {
      channel = "Portal + WhatsApp";
      offer = "Bono por activar GPS";
      playbook = "Pedir opt-in de portal y mejorar precision antes de pauta paga.";
      reason = "Hay actividad, pero falta ubicación fina para cercanía comercial.";
    } else if (hotspot.taps >= 10) {
      channel = "Instagram + WhatsApp";
      offer = "Drop local 2x1";
      playbook = "Activar pauta local, historias con QR/NFC y cupo limitado por barrio.";
      reason = "Volumen suficiente para campaña geolocalizada.";
    } else if (validRate >= 90) {
      channel = "Voucher premium";
      offer = "Early access club";
      playbook = "Premiar primeros compradores y pedir referido en portal de usuario.";
      reason = "Pocas lecturas, pero de alta calidad comercial.";
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
      campaignName: `Campaña CRM ${index + 1}: ${hotspot.city}`,
    };
  }).sort((a, b) => b.score - a.score || b.taps - a.taps).slice(0, 5);
}

function resolveCommercialContext(
  rows: TenantTapRealtimeEvent[],
  tenantScope: string,
  selectedTenant: string,
): CommercialContext {
  const haystack = [
    tenantScope,
    selectedTenant,
    ...rows.flatMap((row) => [row.tenantSlug, row.productName, row.batchId, row.city, row.country]),
  ].filter(Boolean).join(" ").toLowerCase();

  if (/(syngenta|agro|semilla|seed|campo|bidon|bidón|fertiliz|crop|soja|maiz|maíz)/.test(haystack)) {
    return COMMERCIAL_CONTEXTS.agro;
  }
  if (/(bodega|balmec|vino|wine|malbec|cabernet|chardonnay|pinot|cata|viñedo|vinedo)/.test(haystack)) {
    return COMMERCIAL_CONTEXTS.wine;
  }
  return COMMERCIAL_CONTEXTS.general;
}

function commercialRecommendation(context: CommercialContext, opportunity: MarketOpportunity) {
  if (context.key === "wine") {
    return `Activar ${opportunity.offer} en ${opportunity.city}: cata, visita o beneficio para UIDs válidos. Reponer producto, habilitar QR/NFC de canje y pauta local donde ya hay ${opportunity.taps} lecturas.`;
  }
  if (context.key === "agro") {
    return `Priorizar ${opportunity.city}: revisar canal, disponibilidad de lote, soporte técnico y uso responsable. Activar comunicación por ${opportunity.channel} donde ya hay ${opportunity.taps} lecturas.`;
  }
  return `Activar ${opportunity.offer} en ${opportunity.city} por ${opportunity.channel}. Priorizar stock, QR/NFC activos, puntos de canje y pauta local donde ya hay ${opportunity.taps} lecturas.`;
}

function MiniSparkline({ data, color, dataKey = "taps" }: { data: Array<Record<string, number | string>>; color: string; dataKey?: string }) {
  return (
    <div className="h-6 w-full">
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
  help,
  tone,
  data,
  dataKey,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  delta: string;
  help: string;
  tone: "cyan" | "green" | "red" | "blue";
  data: Array<Record<string, number | string>>;
  dataKey?: string;
}) {
  const color = tone === "red" ? "#ef4444" : tone === "green" ? "#22c55e" : tone === "blue" ? "#60a5fa" : "#22d3ee";
  return (
    <div className="rounded-lg border border-slate-700/70 bg-[linear-gradient(180deg,rgba(17,31,52,.92),rgba(7,15,29,.94))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-300">
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <span className={tone === "red" ? "text-[11px] font-semibold text-red-300" : "text-[11px] font-semibold text-emerald-300"}>{delta}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[22px] font-black tracking-[-0.02em] text-white">{value}</p>
        <p className="pb-1 text-[10px] text-slate-500">ventana activa</p>
      </div>
      <p className="mt-1 min-h-[28px] text-[10px] leading-3 text-slate-400">{help}</p>
      <div className="mt-1">
        <MiniSparkline data={data} color={color} dataKey={dataKey} />
      </div>
    </div>
  );
}

function FunnelNode({
  icon,
  label,
  value,
  pct,
  tone,
  detail,
  pctLabel,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  pct: number;
  tone: string;
  detail: string;
  pctLabel?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full border shadow-[0_0_22px_rgba(34,211,238,.16)]" style={{ borderColor: tone, background: `${tone}22`, color: tone }}>
        {icon}
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-200">{label}</p>
      <p className="text-sm font-black text-white">{formatNumber(value)}</p>
      <p className="text-xs text-slate-400">{pctLabel || formatPercent(pct)}</p>
      <p className="mt-0.5 max-w-[5.5rem] text-[9px] leading-3 text-slate-500">{detail}</p>
    </div>
  );
}

export function ExecutiveRealtimeCrm({
  account,
  initialEvents,
  tenantScope,
  mode,
  onSectionChange,
}: {
  account: {
    email?: string | null;
    label?: string | null;
    mfaVerified?: boolean | null;
    permissions?: string[];
    role: string;
    setupCompleted?: boolean | null;
    tenantSlug?: string | null;
    clerkEnabled?: boolean;
  };
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
    const onFullscreenChange = () => {
      setIsMapFullscreen(document.fullscreenElement === mapPanelRef.current);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMapFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
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

  const consoleTimezone = useMemo(
    () => resolveConsoleTimezone(visibleEvents, selectedTenant, tenantScope),
    [selectedTenant, tenantScope, visibleEvents],
  );
  const consoleTimezoneLabel = useMemo(() => timezoneLabel(consoleTimezone), [consoleTimezone]);

  useEffect(() => {
    const updateClock = () => setClock(formatTimeInZone(Date.now(), consoleTimezone));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [consoleTimezone]);

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
        label: formatShortTimeInZone(start, consoleTimezone),
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
  }, [consoleTimezone, visibleEvents]);

  const hotspots = useMemo(() => buildHotspots(visibleEvents), [visibleEvents]);
  const marketOpportunities = useMemo(() => buildMarketOpportunities(hotspots, visibleEvents), [hotspots, visibleEvents]);
  const topOpportunity = marketOpportunities[0] || null;
  const commercialContext = useMemo(
    () => resolveCommercialContext(visibleEvents, tenantScope, selectedTenant),
    [selectedTenant, tenantScope, visibleEvents],
  );
  const latestEvent = visibleEvents[0] || null;
  const todayLabel = useMemo(() => formatDateInZone(Date.now(), consoleTimezone), [consoleTimezone]);

  const alerts = useMemo(() => {
    const rows: Array<{ id: string; tone: "red" | "amber" | "blue"; title: string; detail: string; time: string }> = [];
    if (metrics.fraudRate > 10) {
      rows.push({ id: `risk-${hotspots[0]?.key || "operation"}`, tone: "red", title: `Riesgo elevado en ${hotspots[0]?.city || "la operación"}`, detail: `Tasa de riesgo ${formatPercent(metrics.fraudRate)} en la ventana visible`, time: formatShortTimeInZone(Date.now(), consoleTimezone) });
    }
    if (metrics.gpsCoverage < 60 && metrics.total > 0) {
      rows.push({ id: `gps-${metrics.total}-${Math.round(metrics.gpsCoverage)}`, tone: "amber", title: "Cobertura GPS baja", detail: `Solo ${formatPercent(metrics.gpsCoverage)} de lecturas con GPS útil`, time: formatShortTimeInZone(Date.now(), consoleTimezone) });
    }
    visibleEvents.filter((event) => String(event.verdict || "").toLowerCase() !== "valid").slice(0, 3).forEach((event, index) => {
      rows.push({ id: `exception-${String(event.eventId || event.uidMasked || "uid")}-${index}`, tone: "amber", title: `UID con excepción ${event.uidMasked}`, detail: `${event.city || "sin ciudad"} · ${deviceSummary(event)}`, time: timeAgo(event.occurredAt) });
    });
    if (metrics.actionable > 0) {
      rows.push({ id: `actionable-${String(latestEvent?.eventId || metrics.actionable)}`, tone: "blue", title: "Pico de actividad listo para CRM", detail: `${metrics.actionable} lecturas válidas tienen ubicación accionable`, time: timeAgo(latestEvent?.occurredAt) });
    }
    return rows.slice(0, 4);
  }, [consoleTimezone, hotspots, latestEvent, metrics, visibleEvents]);

  const handleExport = () => {
    exportToCsv(
      `nexid-crm-realtime-${selectedTenant}-${new Date().toISOString().slice(0, 10)}`,
      visibleEvents.map((event) => ({
        eventId: event.eventId,
        tenant: event.tenantSlug || "",
        uid: event.uidMasked,
        occurredAt: event.occurredAt,
        occurredAtTenant: formatDateTimeInZone(event.occurredAt, consoleTimezone),
        timezone: consoleTimezone,
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
        { key: "occurredAtTenant", label: "Fecha tenant" },
        { key: "timezone", label: "Zona horaria" },
        { key: "occurredAt", label: "Fecha UTC/origen" },
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
        occurredAtTenant: formatDateTimeInZone(event.occurredAt, consoleTimezone),
        timezone: consoleTimezone,
        product: event.productName || "",
        device: deviceSummary(event),
        location: locationSourceLabel(event),
      })),
      [
        { key: "campaign", label: "Campaña" },
        { key: "city", label: "Ciudad" },
        { key: "country", label: "País" },
        { key: "channel", label: "Canal sugerido" },
        { key: "offer", label: "Promo sugerida" },
        { key: "tenant", label: "Tenant" },
        { key: "uid", label: "UID" },
        { key: "verdict", label: "Veredicto" },
        { key: "occurredAtTenant", label: "Fecha tenant" },
        { key: "timezone", label: "Zona horaria" },
        { key: "occurredAt", label: "Fecha UTC/origen" },
        { key: "product", label: "Producto" },
        { key: "device", label: "Dispositivo" },
        { key: "location", label: "Ubicacion" },
      ],
    );
    setCampaignDraft(`${opportunity.campaignName}: segmento ${opportunity.channel} exportado (${rows.length} lecturas).`);
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
        setIsMapFullscreen(false);
      } else if (isMapFullscreen) {
        setIsMapFullscreen(false);
      } else {
        await panel.requestFullscreen();
        setIsMapFullscreen(true);
      }
    } catch {
      setIsMapFullscreen((value) => !value);
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
    { icon: <Activity className="h-5 w-5" />, active: true, label: "Resumen operativo", short: "Vista", title: "Ver KPIs explicados, funnel post-tap y estado de la ventana activa.", action: () => onSectionChange?.("summary") },
    { icon: <Globe className="h-5 w-5" />, active: false, label: "Mapa por capas", short: "Capas", title: "Centrar el mapa y conservar la capa seleccionada.", action: () => { setMapZoom(1); document.getElementById("live-tap-map")?.scrollIntoView({ behavior: "smooth", block: "start" }); } },
    { icon: <Megaphone className="h-5 w-5" />, active: false, label: "IA de cercanía", short: "IA", title: "Ver priorización comercial por zona basada en eventos visibles.", action: () => document.getElementById("commercial-ai-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }) },
    { icon: <Users className="h-5 w-5" />, active: false, label: "Clientes & campañas", short: "Clientes", title: "Abrir segmentos, beneficios, vouchers y campañas post-tap.", action: () => onSectionChange?.("loyalty") },
    { icon: <ShieldCheck className="h-5 w-5" />, active: false, label: "Riesgos", short: "Riesgo", title: "Abrir eventos para auditar replay, tamper, GPS bajo y dispositivos.", action: () => { window.location.href = "/events?filter=risk"; } },
    { icon: <BarChart3 className="h-5 w-5" />, active: false, label: "Exportar ventana", short: "CSV", title: "Exportar eventos visibles con horario del tenant.", action: handleExport },
    { icon: <Settings className="h-5 w-5" />, active: false, label: "Limpiar filtros", short: "Reset", title: "Restablecer tenant, densidad, zoom y capa base.", action: () => { setSelectedTenant("all"); setMapView("heat"); setMapZoom(1); setBaseMap("dark"); } },
  ];

  return (
    <div className="nexid-crm-shell fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-[#030a16] text-slate-100 lg:overflow-hidden">
      <div className="nexid-crm-backdrop pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(14,165,233,.16),transparent_32%),linear-gradient(180deg,#05101f,#030713_55%,#030713)]" />
      <header className="relative z-[640] flex min-h-[70px] flex-wrap items-center gap-3 border-b border-cyan-200/10 bg-[#06101d]/90 px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,.04)] lg:h-[70px] lg:flex-nowrap lg:px-4 lg:py-0">
        <div className="flex w-full items-center gap-4 sm:w-auto lg:w-[510px] lg:gap-5">
          <div className="pr-4 text-[24px] font-black tracking-[-0.04em] text-white lg:pr-6 lg:text-[28px]">
            nex<span className="text-cyan-300">ID</span>
          </div>
          <div className="border-l border-white/10 pl-4 lg:pl-5">
            <p className="text-xs text-slate-400">Admin enterprise</p>
            <h1 className="text-xl font-black tracking-[-0.03em] text-white lg:text-2xl">CRM Semántica Operativa</h1>
          </div>
        </div>

        <nav className="order-3 grid h-11 w-full grid-cols-3 overflow-hidden rounded-xl border border-white/8 bg-slate-950/45 text-[11px] font-semibold text-slate-300 sm:text-sm lg:order-none lg:mx-auto lg:h-12 lg:w-[500px]">
          <button type="button" title="Volver a métricas, mapa y funnel del CRM en vivo" onClick={() => onSectionChange?.("summary")} className="flex items-center justify-center gap-2 border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200">
            <Activity className="h-4 w-4" /> CRM en vivo
          </button>
          <button type="button" title="Abrir operación NFC: lotes, tags, QA, anclaje y publicación" onClick={() => onSectionChange?.("infra")} className="flex items-center justify-center gap-2 hover:bg-white/5">
            <Truck className="h-4 w-4" /> Operación NFC
          </button>
          <button type="button" title="Abrir segmentos, beneficios y campañas post-tap" onClick={() => onSectionChange?.("loyalty")} className="flex items-center justify-center gap-2 hover:bg-white/5">
            <Users className="h-4 w-4" /> Clientes & campañas
          </button>
        </nav>

        <div className="ml-0 flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-300 lg:ml-auto lg:w-auto lg:flex-nowrap lg:justify-start lg:gap-5">
          <span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> Stream de eventos</span>
          <span className="flex items-center gap-2" title={`Horario operativo del tenant: ${consoleTimezone}`}><Clock className="h-4 w-4 text-slate-500" /> {clock}<span className="hidden text-[10px] uppercase tracking-[0.08em] text-slate-500 xl:inline">{consoleTimezoneLabel}</span></span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-500" /> {todayLabel}</span>
          <TenantAccountMenu
            className="w-full sm:w-auto"
            email={account.email}
            label={account.label}
            mfaVerified={account.mfaVerified}
            mode={mode}
            permissions={account.permissions}
            role={account.role}
            setupCompleted={account.setupCompleted}
            tenantSlug={account.tenantSlug || tenantScope}
            clerkEnabled={account.clerkEnabled}
          />
        </div>
      </header>

      <aside className="absolute bottom-0 left-0 top-[70px] z-10 hidden w-24 flex-col items-center border-r border-cyan-200/10 bg-[#07111e]/92 py-4 lg:flex">
        <div className="space-y-3">
          {railItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-pressed={Boolean(item.active)}
              title={item.title}
              onClick={item.action}
              className={`group relative flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl border text-[9px] font-black uppercase tracking-[0.04em] transition ${item.active ? "border-cyan-300/50 bg-cyan-400/16 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.18)]" : "border-white/6 text-slate-400 hover:border-cyan-300/25 hover:bg-white/5 hover:text-white"}`}
            >
              {item.icon}
              <span className="max-w-full truncate">{item.short}</span>
              <span className="pointer-events-none absolute left-14 top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <form method="post" action="/logout" className="mt-auto">
          <button type="submit" title="Cerrar sesion" className="grid h-10 w-10 place-items-center rounded-lg border border-white/8 text-slate-500 hover:border-rose-300/35 hover:text-rose-100" aria-label="Salir">
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </aside>

      <main className="relative z-10 flex min-h-[calc(100vh-70px)] flex-col gap-3 overflow-visible px-3 py-3 pb-14 lg:ml-24 lg:h-[calc(100vh-102px)] lg:flex-row lg:gap-3 lg:overflow-hidden lg:p-3 2xl:gap-4 2xl:p-4">
        <section className="order-2 min-h-0 space-y-2 overflow-hidden lg:order-1 lg:w-96 lg:shrink-0">
          <div className="flex items-start justify-between gap-3">
            <span>
              <h2 className="text-lg font-bold text-white">Lectura operativa</h2>
              <p className="text-[11px] text-slate-500">Qué pasó, qué es confiable y qué se puede activar ahora.</p>
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-400"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> {connected ? "En vivo" : "Sincronizando"}</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricCard icon={<Radio className="h-5 w-5" />} label="Lecturas" value={formatNumber(metrics.total)} delta="stream" help="Eventos NFC/QR recibidos para tenant y ventana activos." tone="cyan" data={velocitySeries} />
            <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Lecturas válidas" value={formatPercent(metrics.validRate)} delta="VALID" help="Porcentaje de eventos con verdict válido sobre el total visible." tone="green" data={velocitySeries} dataKey="valid" />
            <MetricCard icon={<ShieldAlert className="h-5 w-5" />} label="Riesgo" value={formatPercent(metrics.fraudRate)} delta={metrics.risk ? "revisar" : "0 alertas"} help="Eventos no válidos; revisar UID, lote y dispositivo antes de campañas." tone="red" data={velocitySeries} dataKey="risk" />
            <MetricCard icon={<MapPin className="h-5 w-5" />} label="Ubicación útil" value={formatPercent(metrics.gpsCoverage)} delta="GPS" help="Eventos con coordenada de teléfono, no solo ciudad o IP aproximada." tone="green" data={velocitySeries} />
            <MetricCard icon={<Users className="h-5 w-5" />} label="Audiencia accionable" value={formatNumber(metrics.actionable)} delta="UID + zona" help="Lecturas válidas con UID y ubicación para segmentar sin asumir identidad." tone="blue" data={velocitySeries} dataKey="valid" />
            <MetricCard icon={<Filter className="h-5 w-5" />} label="Señales listas" value={formatPercent(metrics.leadConversion)} delta="post-tap" help="Share de lecturas que pueden alimentar segmento, beneficio o campaña." tone="green" data={velocitySeries} dataKey="valid" />
          </div>

          <div className="rounded-lg border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Velocidad de lecturas <span className="font-normal text-slate-400">(lecturas por minuto)</span></p>
              <button type="button" title="Cambiar ventana temporal del CRM" onClick={cycleTimeRange} className="rounded-lg border border-white/8 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">{timeRangeLabel(timeRange)}</button>
            </div>
            <div className="mt-2 h-[92px] 2xl:h-[112px]">
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
              <span>
                <p className="text-sm font-bold text-white">Funnel post-tap</p>
                <p className="text-[11px] text-slate-500">De lectura física a acción comercial.</p>
              </span>
              <span className="text-xs text-slate-500">{metrics.actionable ? `${metrics.actionable} señales accionables` : "sin señales listas aún"}</span>
            </div>
            <div className="mt-3 flex items-start gap-1 overflow-x-auto pb-1">
              <FunnelNode icon={<MousePointerClick className="h-5 w-5" />} label="Lecturas" value={metrics.total} pct={100} tone="#22d3ee" detail="entrada del stream" pctLabel="base" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<ShieldCheck className="h-5 w-5" />} label="Válidas" value={metrics.valid} pct={metrics.validRate} tone="#22c55e" detail="aptas para acción" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<BadgeCheck className="h-5 w-5" />} label="Ubicación" value={metrics.gps} pct={metrics.gpsCoverage} tone="#facc15" detail="GPS del teléfono" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Users className="h-5 w-5" />} label="UID + zona" value={metrics.actionable} pct={metrics.leadConversion} tone="#a855f7" detail="segmento usable" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Tags className="h-5 w-5" />} label="Campaña" value={metrics.offerReady} pct={metrics.offerReady ? 100 : 0} tone="#38bdf8" detail="zonas con señal" pctLabel={metrics.offerReady ? "zonas listas" : "sin zona"} />
            </div>
          </div>
        </section>

        <section className="order-1 flex min-h-0 flex-col gap-4 lg:order-2 lg:min-w-0 lg:flex-1">
          <div className="flex min-h-0 flex-col lg:flex-1">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Mapa vivo por capas</h2>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Live</span>
              </div>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <select size={1} title="Filtrar lecturas por tenant" value={selectedTenant} onChange={(event) => setSelectedTenant(event.target.value)} className="col-span-2 h-9 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white sm:col-span-1 sm:w-auto sm:min-w-[150px]">
                  <option value="all">Todos los tenants</option>
                  {tenantOptions.map((tenant) => <option key={tenant} value={tenant}>{tenantDisplayName(tenant)}</option>)}
                </select>
                <select size={1} title="Cambiar ventana temporal del mapa y KPIs" value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRange)} className="h-9 min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white">
                  {TIME_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select size={1} title="Cambiar capa base del mapa" value={baseMap} onChange={(event) => setBaseMap(event.target.value as BaseMapLayer)} className="h-9 min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white xl:hidden">
                  {BASEMAP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" title="Exportar eventos visibles a CSV" onClick={handleExport} className="flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-4 text-sm text-white hover:border-cyan-300/50"><Download className="h-4 w-4" /> Exportar</button>
              </div>
            </div>

            <div id="live-tap-map" ref={mapPanelRef} className={`relative overflow-hidden border border-cyan-100/10 bg-[#061426] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ${isMapFullscreen ? "fixed inset-0 z-[260] h-screen min-h-screen rounded-none border-cyan-300/25 bg-[#020713] p-2" : "min-h-[520px] rounded-xl sm:min-h-[560px] lg:min-h-0"}`}>
              <div className="absolute left-4 top-4 z-20 grid gap-2">
                <button type="button" title="Acercar mapa sin agrandar artificialmente los eventos" onClick={() => setMapZoom((value) => Math.min(1.22, Number((value + 0.08).toFixed(2))))} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-white" aria-label="Acercar mapa">+</button>
                <button type="button" title="Alejar mapa para ver más territorio" onClick={() => setMapZoom((value) => Math.max(0.9, Number((value - 0.08).toFixed(2))))} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-white" aria-label="Alejar mapa">-</button>
                <button type="button" title="Mostrar radio visual de cercanía por hotspot" onClick={() => setMapView("nearby")} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-cyan-200" aria-label="Mostrar cercanía comercial"><Crosshair className="h-4 w-4" /></button>
                <button type="button" title="Mostrar puntos individuales de lectura" onClick={() => setMapView("points")} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-cyan-200" aria-label="Mostrar puntos"><Layers className="h-4 w-4" /></button>
              </div>

              <div className="absolute left-[72px] right-3 top-4 z-30 flex flex-wrap items-center justify-end gap-2 lg:left-auto lg:right-5 lg:flex-nowrap">
                {MAP_VIEW_OPTIONS.map((option) => (
                  <button key={option.value} type="button" aria-pressed={mapView === option.value} title={option.title} onClick={() => setMapView(option.value)} className={`flex h-9 items-center gap-2 rounded-lg border px-2 text-sm font-semibold sm:px-3 ${mapView === option.value ? "border-cyan-300 bg-cyan-400/12 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-white/10 bg-slate-950/65 text-slate-300"}`}>
                    {option.icon}<span className="hidden sm:inline">{option.label}</span>
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
                <button type="button" title="Restablecer mapa a capa de densidad y zoom normal" onClick={() => { setMapView("heat"); setMapZoom(1); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/65 text-slate-300" aria-label="Restablecer mapa"><Settings className="h-4 w-4" /></button>
                <button type="button" title={isMapFullscreen ? "Salir de pantalla completa" : "Pantalla completa real para monitor de control"} onClick={() => void toggleMapFullscreen()} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/65 text-slate-300 hover:border-cyan-300/50 hover:text-cyan-100" aria-label={isMapFullscreen ? "Salir de pantalla completa" : "Abrir pantalla completa"}><Expand className="h-4 w-4" /></button>
              </div>

              <div className="absolute bottom-[260px] left-4 z-20 rounded-lg border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-200 shadow-xl lg:bottom-20">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Capa {MAP_VIEW_OPTIONS.find((option) => option.value === mapView)?.label}</p>
                <p className="mb-2 max-w-[13rem] text-[10px] leading-4 text-slate-400">{MAP_VIEW_OPTIONS.find((option) => option.value === mapView)?.description}</p>
                {[
                  ["Muy alto", "bg-red-500"],
                  ["Alto", "bg-amber-400"],
                  ["Medio", "bg-lime-400"],
                  ["Bajo", "bg-sky-400"],
                ].map(([label, color]) => (
                  <p key={label} className="mt-1 flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}</p>
                ))}
              </div>

              <div className={`${isMapFullscreen ? "h-full" : "h-[460px] sm:h-[520px]"} w-full p-3 pt-[76px] lg:h-full lg:p-3 lg:pr-[300px]`}>
                <RealtimeMapLibreMap hotspots={hotspots} events={visibleEvents} mapView={mapView} mode={mode} zoom={mapZoom} baseMap={baseMap} />
              </div>

              <div className="relative z-20 m-3 mt-0 max-h-[250px] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/72 p-3 shadow-2xl backdrop-blur lg:absolute lg:bottom-4 lg:right-4 lg:top-[76px] lg:m-0 lg:w-[270px] lg:max-h-none">
                <p className="text-sm font-semibold text-white">Últimos eventos visibles</p>
                <div className="mt-3 space-y-2">
                  {visibleEvents.slice(0, 4).map((event) => {
                    const valid = String(event.verdict || "").toLowerCase() === "valid";
                    return (
                      <div key={String(event.eventId || `${event.uidMasked}-${event.occurredAt}`)} className="rounded-lg border border-white/8 bg-slate-900/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500">{formatTimeInZone(event.occurredAt || Date.now(), consoleTimezone)}</p>
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

          <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div id="commercial-ai-panel" className="rounded-xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_36%),linear-gradient(180deg,rgba(10,24,43,.98),rgba(4,10,20,.95))] p-3 2xl:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-white">
                  <Megaphone className="h-4 w-4 text-cyan-300" />
                  <span className="truncate">{commercialContext.panelTitle}</span>
                  <span className="hidden text-sm font-normal text-slate-400 sm:inline">({commercialContext.panelSubtitle})</span>
                </p>
                <button type="button" title="Abrir Clientes & campañas con estas señales" onClick={() => { window.location.href = "/loyalty/campaigns"; }} className="shrink-0 text-sm font-semibold text-cyan-300">Crear campaña</button>
              </div>

              {topOpportunity ? (
                <div className="mb-3 grid gap-3 rounded-xl border border-cyan-300/20 bg-cyan-400/8 p-3 text-xs text-slate-300 sm:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold uppercase tracking-[0.08em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> {commercialContext.headline}</p>
                    <p className="mt-1 text-sm leading-5">
                      {commercialRecommendation(commercialContext, topOpportunity)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2" title="Prioridad heurística calculada con lecturas válidas, GPS, volumen y riesgo."><b className="block text-base text-white">{topOpportunity.score}</b> prioridad</span>
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2"><b className="block text-base text-white">{topOpportunity.audience}</b> señales</span>
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2"><b className="block text-base text-white">{formatPercent(topOpportunity.validRate)}</b> válido</span>
                  </div>
                </div>
              ) : null}

              <div className="mb-3 grid gap-2 md:grid-cols-3">
                {commercialContext.playbooks.map((item) => (
                  <div key={item.title} className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] p-3 text-xs text-slate-300">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">{item.eyebrow}</p>
                    <p className="mt-1 font-bold text-white">{item.title}</p>
                    <p className="mt-1 leading-4 text-slate-400">{item.body}</p>
                  </div>
                ))}
              </div>

              {campaignDraft ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                  <BadgeCheck className="h-4 w-4" /> {campaignDraft}
                </div>
              ) : null}

              <div className="max-h-[150px] space-y-2 overflow-y-auto pr-1 2xl:max-h-[210px]">
                {marketOpportunities.length ? marketOpportunities.map((opportunity) => (
                  <div key={opportunity.key} className="rounded-xl border border-white/8 bg-slate-950/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <b className="block truncate text-sm text-white">{opportunity.city}, {opportunity.country}</b>
                        <span className="block truncate text-[11px] text-slate-400">{opportunity.reason}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-xs font-bold text-cyan-200" title="Prioridad heurística">P{opportunity.score}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block text-sm text-white">{opportunity.audience}</b> señales CRM</span>
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block truncate text-sm text-white">{opportunity.channel}</b> canal</span>
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block truncate text-sm text-emerald-200">{opportunity.offer}</b> beneficio</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" title={`Exportar señales de ${opportunity.city} con UIDs, canal y beneficio sugerido`} onClick={() => handleCampaignExport(opportunity)} className="rounded-md border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:border-cyan-300/50">
                        <Download className="mr-1 inline h-3.5 w-3.5" /> CSV
                      </button>
                      <button type="button" title={`Abrir campaña para ${opportunity.city}: ${opportunity.playbook}`} onClick={() => openCampaignStudio(opportunity)} className="rounded-md border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:border-emerald-200/60">
                        <Send className="mr-1 inline h-3.5 w-3.5" /> Campaña
                      </button>
                      <span className="min-w-0 truncate text-[11px] text-slate-500"><Gift className="mr-1 inline h-3.5 w-3.5 text-emerald-300" /> {opportunity.playbook}</span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-white/8 bg-slate-950/48 px-3 py-5 text-sm text-slate-400">
                    {commercialContext.noData}
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
