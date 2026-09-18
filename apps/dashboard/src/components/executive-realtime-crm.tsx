"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import room from "./control-room.module.css";
import { useControlRoom } from "./use-control-room";
import { MapSourceControls } from "./map-source-controls";
import { filterMapLocations, summarizeMapLocations, mapLocationDescription, type MapSourceFilter } from "../lib/map-location-evidence";
import { ThemeToggle } from "@product/ui";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Clock,
  Crosshair,
  Download,
  Expand,
  Globe,
  Layers,
  MapPin,
  Megaphone,
  MousePointerClick,
  Radio,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RealtimeMapLibreMap, type BaseMapLayer } from "./realtime-maplibre-map";
import { TenantAccountMenu } from "./tenant-account-menu";
import { EnterpriseOpsState } from "./enterprise-ops-state";
import { IncidentEventDrawer } from "./incident-event-drawer";
import { CrmWindowActivityPanel } from "./crm-window-activity-panel";
import { incidentEventNavigationKey, moveIncidentEventSelection, snapshotIncidentEventSelection, type IncidentEventSelection } from "../lib/incident-event-navigation";
import { formatReadingDateTime, parseOperationalTimestamp, resolveOperationalTimeZone } from "../lib/operational-reading-time";
import { PhysicalTapsCommandCenter } from "./physical-taps-command-center";
import { useDashboardRealtime } from "./dashboard-realtime-provider";
import { SecureDashboardLogoutButton } from "./secure-dashboard-logout-button";
import { exportToCsv } from "../lib/export-utils";
import { strictCoordinatePair } from "../lib/geo-coordinates";
import { classifyLocationProvenance } from "../lib/location-provenance";
import { realtimeTapArrivalIsVisible, type RealtimeTapArrival } from "../lib/realtime-tap-arrival";
import type { PhysicalTapsResult } from "../lib/physical-taps-contract";
import {
  classifyRealtimeVerdict,
  isRealtimeRisk,
  mergeRealtimeEvents,
  sortRealtimeEvents,
  type RealtimeAvailability,
  type RealtimeDataSource,
  type RealtimeStreamSource,
  type TenantTapRealtimeEvent,
} from "../lib/realtime-feed";
import {
  dashboardHighImpactPermissionMatches,
  dashboardPermissionDenied,
  dashboardPermissionMatches,
} from "../lib/permission-policy";
import { DASHBOARD_DESTINATIONS } from "../lib/dashboard-destination-policy";
import { dashboardCanOpenDestination } from "../lib/dashboard-destination-policy";
import { dashboardRealtimeConsumerFellBehind, unreadDashboardRealtimeFrames } from "../lib/dashboard-realtime-buffer";
import {
  incidentByEvent,
  incidentStatusLabel,
  isIncidentRealtimeWireEvent,
  type DashboardIncident,
} from "../lib/incident-workflow";
import {
  EXECUTIVE_REALTIME_EVENT_LIMIT,
  executiveRealtimeResponseScopeMatches,
  executiveRealtimeRowsMatchTenant,
  executiveRealtimeSnapshotScopeMatches,
  executiveRealtimeSourceMatchesRequest,
  isExecutiveRealtimeEvent,
  normalizeExecutiveRealtimeTenantDirectory,
  recentEventSamplePresentation,
  resolveExecutiveRealtimeQueryTenant,
  type ExecutiveRealtimeTenantDirectoryEntry,
} from "../lib/executive-realtime-scope";

type MapMode = "tenant" | "global";
type CrmSection = "summary" | "infra" | "loyalty";
export type ExecutiveCrmView = "overview" | "physical-taps";
type MapView = "heat" | "points" | "nearby";
type TimeRange = "5m" | "1h" | "24h";

type CrmRailItem = {
  icon: ReactNode;
  active: boolean;
  label: string;
  short: string;
  title: string;
  action: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

const tooltipStyle = {
  backgroundColor: "var(--dashboard-chart-tooltip-bg)",
  border: "1px solid var(--dashboard-chart-tooltip-border)",
  borderRadius: "10px",
  color: "var(--dashboard-chart-tooltip-text)",
  fontSize: "12px",
};

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string; ms: number }> = [
  { value: "5m", label: "Últimos 5m", ms: 5 * 60_000 },
  { value: "1h", label: "Última 1h", ms: 60 * 60_000 },
  { value: "24h", label: "Últimas 24h", ms: 24 * 60 * 60_000 },
];

const BASEMAP_OPTIONS: Array<{ value: BaseMapLayer; label: string; title: string }> = [
  { value: "light", label: "Calles", title: "Capa de calles para ubicar comercios y barrios" },
  { value: "dark", label: "Control", title: "Capa base oscura para sala de control" },
  { value: "satellite", label: "Imagen", title: "Capa de imagen satelital provista por el mapa base" },
  { value: "terrain", label: "Relieve", title: "Capa de relieve y sombreado para lectura territorial" },
];

const MAP_VIEW_OPTIONS: Array<{ value: MapView; label: string; title: string; description: string; icon: ReactNode }> = [
  {
    value: "heat",
    label: "Densidad",
    title: "Ver concentración de lecturas por ciudad o zona",
    description: "Volumen relativo de lecturas con ubicación observada. El riesgo se muestra por separado y no altera la intensidad.",
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

function isClientReportedGps(value?: string | null) {
  return classifyLocationProvenance(value) === "consented_gps";
}

function timeRangeLabel(value: TimeRange) {
  return TIME_RANGE_OPTIONS.find((item) => item.value === value)?.label || "Últimas 24h";
}

function timeRangeMs(value: TimeRange) {
  return TIME_RANGE_OPTIONS.find((item) => item.value === value)?.ms || TIME_RANGE_OPTIONS[2].ms;
}

function preferredDashboardBaseMap(): BaseMapLayer {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("theme-light") || document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
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

function formatInTimeZone(value: unknown, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const ms = parseOperationalTimestamp(value);
  if (ms === null) return "Fecha y hora no informadas";
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

function timeAgo(value: unknown) {
  const ms = safeDate(value);
  if (!ms) return "sin actualización";
  const sec = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.round(sec / 60)}m`;
  return `hace ${Math.round(sec / 3600)}h`;
}

function realtimeSourcePresentation(
  source: RealtimeDataSource,
  availability: RealtimeAvailability,
  detail: string,
) {
  if (availability !== "ready") {
    const isSeed = source === "seed";
    const isDemo = source === "demo";
    return {
      label: isSeed ? "Respaldo seed" : isDemo ? "Demo de respaldo" : "Fuente no confirmada",
      detail: detail || "La fuente operativa no esta confirmada.",
      badge: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    };
  }
  if (source === "demo") {
    return {
      label: "Demo declarada",
      detail: "Stream de demostracion aislado de produccion.",
      badge: "border-violet-300/30 bg-violet-400/10 text-violet-100",
    };
  }
  if (source === "mixed") {
    return {
      label: "Fuente mixta",
      detail: "Vista solicitada con origenes de produccion y demo; no equivale a produccion pura.",
      badge: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    };
  }
  if (source === "production") {
    return {
      label: "Produccion",
      detail: "Solo eventos canonicos real/imported.",
      badge: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
    };
  }
  return {
    label: "Fuente no identificada",
    detail: detail || "El origen del dato no pudo clasificarse.",
    badge: "border-slate-500/40 bg-slate-700/30 text-slate-200",
  };
}

function mapEvidencePresentation(source: RealtimeDataSource, unconfirmed: boolean) {
  if (unconfirmed || source === "unavailable" || source === "mixed") {
    return {
      state: "unavailable" as const,
      label: source === "mixed" ? "Fuente mixta · no confirmada" : "Datos del mapa sin confirmar",
      detail: "La cartografía base sigue disponible. La capa de eventos no debe interpretarse como actividad actual hasta confirmar fuente, tenant y ventana.",
      badge: "border-amber-300/30 bg-amber-400/12 text-amber-100",
    };
  }
  if (source === "demo" || source === "seed") {
    return {
      state: "demo" as const,
      label: "Mapa demo · datos ilustrativos",
      detail: "La cartografía es real; los eventos pertenecen al recorrido demo aislado y no representan actividad productiva.",
      badge: "border-violet-300/30 bg-violet-400/12 text-violet-100",
    };
  }
  return {
    state: "real" as const,
    label: "Mapa operativo · eventos confirmados",
    detail: "La capa muestra únicamente eventos confirmados para el tenant y la ventana activos.",
    badge: "border-emerald-300/25 bg-emerald-400/12 text-emerald-100",
  };
}

function locationSourceLabel(row: TenantTapRealtimeEvent) {
  const source = String(row.locationSource || "").toLowerCase();
  const coordinate = strictCoordinatePair(row.lat, row.lng);
  if (isClientReportedGps(source)) return coordinate
    ? (row.locationAccuracyM ? `GPS reportado por dispositivo (+/-${Math.round(row.locationAccuracyM)}m); no verificacion independiente` : "GPS reportado por dispositivo; no verificacion independiente")
    : "GPS reportado sin coordenada valida; no verificacion independiente";
  if (source === "ip_geo") return coordinate ? "IP aproximada" : "IP sin coordenada válida; ciudad estimada";
  if (source.includes("error") || source.includes("denied")) return coordinate ? "Coordenada reportada; GPS no autorizado" : "GPS no autorizado; ciudad estimada";
  return coordinate ? "Coordenada reportada; precisión no informada" : row.city ? "Ciudad estimada; no es GPS" : "Sin ubicación utilizable";
}

function deviceSummary(row: TenantTapRealtimeEvent) {
  return [row.deviceLabel, row.deviceOs, row.deviceType].map((item) => String(item || "").trim()).filter(Boolean).join(" · ") || "Dispositivo sin clasificar";
}

const CRM_ACTIONABLE_INTERACTION_TYPES = new Set(["TAP_VALID", "PROVENANCE_VIEWED"]);

function isCommercialActivitySignal(row: TenantTapRealtimeEvent) {
  return row.productIdentityRecognized === true
    && row.interactionClass !== "security_signal"
    && row.knownActor === true
    && row.commercialConsentGranted === true
    && row.commercialConsentChannels.length > 0
    && CRM_ACTIONABLE_INTERACTION_TYPES.has(String(row.eventType || "").toUpperCase());
}

function isGeoOpportunitySignal(row: TenantTapRealtimeEvent) {
  return isCommercialActivitySignal(row)
    && isClientReportedGps(row.locationSource)
    && strictCoordinatePair(row.lat, row.lng) != null;
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
    unknown: number;
    lastUid: string;
    device: string;
    lastSeenMs: number;
  }>();

  rows.forEach((row) => {
    const city = String(row.city || "Unknown");
    const country = String(row.country || "--");
    const key = `${city.toLowerCase()}|${country}`;
    const verdictBucket = classifyRealtimeVerdict(row.verdict, row.reason);
    const valid = row.authenticationVerified === true;
    const gps = isClientReportedGps(row.locationSource);
    const lastSeenMs = safeDate(row.occurredAt);
    const current = buckets.get(key) || {
      key,
      city,
      country,
      taps: 0,
      valid: 0,
      gps: 0,
      risk: 0,
      unknown: 0,
      lastUid: String(row.uidMasked || "N/A"),
      device: deviceSummary(row),
      lastSeenMs,
    };
    current.taps += 1;
    if (valid) current.valid += 1;
    if (gps) current.gps += 1;
    if (isRealtimeRisk(row.verdict, row.reason)) current.risk += 1;
    if (verdictBucket === "unknown") current.unknown += 1;
    if (lastSeenMs >= current.lastSeenMs) {
      current.lastSeenMs = lastSeenMs;
      current.lastUid = String(row.uidMasked || current.lastUid);
      current.device = deviceSummary(row);
    }
    buckets.set(key, current);
  });

  return [...buckets.values()].sort((a, b) => b.taps - a.taps || b.lastSeenMs - a.lastSeenMs).slice(0, 5);
}

function MiniSparkline({ data, color, dataKey = "taps" }: { data: Array<Record<string, number | string>>; color: string; dataKey?: string }) {
  if (!data.length) return <div className="h-6 w-full rounded border border-dashed border-white/8 bg-slate-950/25" aria-hidden="true" />;
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
  const color = `var(--crm-chart-${tone})`;
  return (
    <div data-testid="crm-metric-card" className="min-w-0 rounded-xl border border-slate-700/70 bg-[linear-gradient(180deg,rgba(17,31,52,.92),rgba(7,15,29,.94))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="flex min-w-0 flex-col items-start gap-2">
        <div data-testid="crm-metric-label" className="flex min-w-0 items-start gap-2 text-[11px] font-bold uppercase leading-4 tracking-[0.055em] text-slate-300">
          <span className="shrink-0" style={{ color }}>{icon}</span>
          <span className="min-w-0 break-words">{label}</span>
        </div>
        <span data-testid="crm-metric-delta" className={`max-w-full break-words rounded-full px-2 py-0.5 text-[10px] font-bold ${tone === "red" ? "bg-red-400/10 text-red-300" : "bg-emerald-400/10 text-emerald-300"}`}>{delta}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[26px] font-black leading-none tracking-[-0.035em] text-white">{value}</p>
        <p className="pb-0.5 text-[10px] font-medium text-slate-500">ventana activa</p>
      </div>
      <p className="mt-1.5 min-h-[32px] text-[10.5px] leading-4 text-slate-400">{help}</p>
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
  value: number | string;
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
      <p className="text-sm font-black text-white">{typeof value === "number" ? formatNumber(value) : value}</p>
      <p className="text-xs text-slate-400">{pctLabel || formatPercent(pct)}</p>
      <p className="mt-0.5 max-w-[5.5rem] text-[9px] leading-3 text-slate-500">{detail}</p>
    </div>
  );
}

export function ExecutiveRealtimeCrm({
  account,
  initialEvents,
  tenantScope,
  tenantDirectory,
  mode,
  initialDataSource,
  initialAvailability,
  initialAvailabilityDetail,
  initialView,
  physicalTapsResult,
  physicalTapsTenantDisplayName,
  onSectionChange,
}: {
  account: {
    email?: string | null;
    label?: string | null;
    mfaVerified?: boolean | null;
    permissions?: string[];
    deniedPermissions?: string[];
    role: string;
    setupCompleted?: boolean | null;
    tenantSlug?: string | null;
    clerkEnabled?: boolean;
    isDemo?: boolean;
  };
  initialEvents: TenantTapRealtimeEvent[];
  tenantScope: string;
  tenantDirectory: ExecutiveRealtimeTenantDirectoryEntry[];
  mode: MapMode;
  streamSource: RealtimeStreamSource;
  initialDataSource: RealtimeDataSource;
  initialAvailability: RealtimeAvailability;
  initialAvailabilityDetail: string;
  initialView: ExecutiveCrmView;
  physicalTapsResult: PhysicalTapsResult;
  physicalTapsTenantDisplayName: string;
  onSectionChange: (section: CrmSection) => void;
}) {
  const canReadSensitiveEvents = dashboardHighImpactPermissionMatches(
    account.role,
    account.permissions,
    "events.read_sensitive",
    account.deniedPermissions,
  );
  const eventsUnavailableReason = "Auditoría no habilitada: esta sesión no tiene events.read_sensitive.";
  const controlRoom=useControlRoom();
  const [locationFilter,setLocationFilter]=useState<MapSourceFilter>("all");
  const [activeView, setActiveView] = useState<ExecutiveCrmView>(initialView);
  const [activityPanelRequested, setActivityPanelRequested] = useState(false);
  const [mapPanelRequested, setMapPanelRequested] = useState(false);
  const [events, setEvents] = useState(() => canReadSensitiveEvents ? sortRealtimeEvents(initialEvents, EXECUTIVE_REALTIME_EVENT_LIMIT) : []);
  const [connected, setConnected] = useState(false);
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [streamConfirmed, setStreamConfirmed] = useState(initialAvailability === "ready" && initialEvents.length > 0);
  const [streamWarning, setStreamWarning] = useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(initialEvents[0]?.occurredAt || null);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const [activeDataSource, setActiveDataSource] = useState<RealtimeDataSource>(initialDataSource);
  const [dataAvailability, setDataAvailability] = useState<RealtimeAvailability>(initialAvailability);
  const [availabilityDetail, setAvailabilityDetail] = useState(initialAvailabilityDetail);
  const tenantSession = mode === "tenant";
  const lockedTenantScope = String(tenantScope || "").trim().toLowerCase();
  const [selectedTenant, setSelectedTenant] = useState(() => tenantSession ? lockedTenantScope : "all");
  const [mapView, setMapView] = useState<MapView>("heat");
  const [baseMap, setBaseMap] = useState<BaseMapLayer>("light");
  const baseMapFollowsTheme = useRef(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapArrival, setMapArrival] = useState<RealtimeTapArrival | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [clock, setClock] = useState("");
  const [incidentSelection, setIncidentSelection] = useState<IncidentEventSelection<TenantTapRealtimeEvent> | null>(null);
  const selectedEvent = incidentSelection?.events[incidentSelection.index] || null;
  const [incidentsByEventId, setIncidentsByEventId] = useState<Record<string, DashboardIncident>>({});
  const [incidentAvailability, setIncidentAvailability] = useState<"loading" | "ready" | "unavailable">("loading");
  const canReadIncidents = account.role === "super-admin"
    ? !dashboardPermissionDenied(account.deniedPermissions, "incidents:read")
    : dashboardPermissionMatches(account.permissions, "incidents:read", account.deniedPermissions);
  const canWriteIncidents = account.role === "super-admin"
    ? !dashboardPermissionDenied(account.deniedPermissions, "incidents:write")
    : dashboardPermissionMatches(account.permissions, "incidents:write", account.deniedPermissions);
  const effectiveSelectedTenant = tenantSession ? lockedTenantScope : selectedTenant;
  const queryTenant = resolveExecutiveRealtimeQueryTenant({ mode, tenantScope: lockedTenantScope, selectedTenant });
  const router = useRouter();
  const realtime = useDashboardRealtime();
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const incidentRequestAbortRef = useRef<AbortController | null>(null);
  const consumedEventSequenceRef = useRef(0);
  const requestTransitionPending = false;
  const valuesUnavailable = requestTransitionPending || !streamConfirmed;

  useEffect(() => {
    // Changing a view or recovering a snapshot is never a new physical read.
    setMapArrival(null);
  }, [queryTenant, timeRange, activeView, realtime.activeScopeKey, realtime.snapshot]);

  useEffect(() => {
    if (tenantSession) setSelectedTenant(lockedTenantScope);
  }, [lockedTenantScope, tenantSession]);

  useEffect(() => {
    function syncBaseMapWithTheme() {
      if (baseMapFollowsTheme.current) setBaseMap(preferredDashboardBaseMap());
    }
    syncBaseMapWithTheme();
    const observer = new MutationObserver(syncBaseMapWithTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  function selectBaseMap(nextBaseMap: BaseMapLayer) {
    baseMapFollowsTheme.current = false;
    setBaseMap(nextBaseMap);
  }

  function resetMapPresentation() {
    baseMapFollowsTheme.current = true;
    setMapView("heat");
    setMapZoom(1);
    setBaseMap(preferredDashboardBaseMap());
  }

  const handleIncident = useCallback((incident: DashboardIncident) => {
    setIncidentsByEventId((current) => ({ ...current, [String(incident.eventId)]: incident }));
    setIncidentAvailability("ready");
  }, []);

  const refreshIncidents = useCallback(async () => {
    if (!canReadIncidents) return;
    incidentRequestAbortRef.current?.abort();
    const controller = new AbortController();
    incidentRequestAbortRef.current = controller;
    const url = new URL("/api/admin/incidents", window.location.origin);
    url.searchParams.set("limit", "100");
    if (queryTenant) url.searchParams.set("tenant", queryTenant);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setIncidentAvailability("unavailable");
        return;
      }
      const payload = await response.json().catch(() => null) as { ok?: boolean; scope?: { tenant?: unknown }; incidents?: DashboardIncident[] } | null;
      if (controller.signal.aborted) return;
      if (!payload?.ok
        || !executiveRealtimeResponseScopeMatches(queryTenant, payload.scope?.tenant)
        || !Array.isArray(payload.incidents)
        || !executiveRealtimeRowsMatchTenant(payload.incidents, queryTenant)) {
        setIncidentAvailability("unavailable");
        return;
      }
      setIncidentsByEventId(incidentByEvent(payload.incidents));
      setIncidentAvailability("ready");
    } catch {
      if (!controller.signal.aborted) setIncidentAvailability("unavailable");
    } finally {
      if (incidentRequestAbortRef.current === controller) incidentRequestAbortRef.current = null;
    }
  }, [canReadIncidents, queryTenant]);

  useEffect(() => {
    document.body.classList.add("nexid-crm-overlay-active");
    return () => document.body.classList.remove("nexid-crm-overlay-active");
  }, []);

  const selectActiveView = useCallback((nextView: ExecutiveCrmView) => {
    setActiveView(nextView);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("section");
    if (nextView === "physical-taps") nextUrl.searchParams.set("view", "physical-taps");
    else nextUrl.searchParams.delete("view");
    const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextHref !== currentHref) window.history.pushState(null, "", nextHref);
  }, []);

  const openWindowActivity = () => {
    selectActiveView("overview");
    setActivityPanelRequested(true);
  };

  const openMapPanel = () => {
    selectActiveView("overview");
    setMapPanelRequested(true);
  };

  useEffect(() => {
    if (!mapPanelRequested) return;
    setMapPanelRequested(false);
    if (activeView !== "overview") return;
    const panel = document.getElementById("live-tap-map");
    if (!panel) return;
    panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    panel.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [mapPanelRequested, activeView]);

  useEffect(() => {
    if (!activityPanelRequested) return;
    // Consume once, including when another navigation interrupted this request.
    setActivityPanelRequested(false);
    if (activeView !== "overview") return;
    const panel = document.getElementById("window-activity-panel");
    const heading = document.getElementById("window-activity-title");
    if (!panel || !heading) return;
    panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    heading.focus({ preventScroll: true });
  }, [activityPanelRequested, activeView]);

  useEffect(() => {
    setActiveView(initialView);
    const handlePopState = () => {
      const requestedView = new URL(window.location.href).searchParams.get("view");
      setActiveView(requestedView === "physical-taps" ? "physical-taps" : "overview");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialView]);

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
    const timer = window.setInterval(() => setFreshnessNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canReadIncidents) {
      incidentRequestAbortRef.current?.abort();
      setIncidentsByEventId({});
      setIncidentAvailability("unavailable");
      return;
    }
    setIncidentsByEventId({});
    setIncidentAvailability("loading");
    void refreshIncidents();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshIncidents();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      incidentRequestAbortRef.current?.abort();
    };
  }, [canReadIncidents, refreshIncidents]);

  useEffect(() => {
    if (!canReadSensitiveEvents) {
      setEvents([]);
      setConnected(false);
      setConnectionAttempted(true);
      setStreamConfirmed(false);
      setActiveDataSource("unavailable");
      setDataAvailability("upstream_error");
      setAvailabilityDetail("events.read_sensitive permission required");
      return;
    }
    setEvents(sortRealtimeEvents(initialEvents, EXECUTIVE_REALTIME_EVENT_LIMIT));
    setIncidentSelection(null);
    setLastUpdateAt(initialEvents[0]?.occurredAt || null);
    setStreamConfirmed(initialAvailability === "ready" && initialEvents.length > 0);
    setStreamWarning(null);
    setActiveDataSource(initialDataSource);
    setDataAvailability(initialAvailability);
    setAvailabilityDetail(initialAvailabilityDetail);
  }, [canReadSensitiveEvents, initialAvailability, initialAvailabilityDetail, initialDataSource, initialEvents, realtime.activeScopeKey]);

  useEffect(() => {
    if (!canReadSensitiveEvents) return;
    setConnectionAttempted(realtime.status !== "connecting");
    setConnected(realtime.status === "connected");
    if (realtime.status === "reconnecting") {
      setStreamWarning("El canal en vivo se interrumpió; EventSource está reconectando sin polling.");
    }
  }, [canReadSensitiveEvents, realtime.status]);

  useEffect(() => {
    const frame = realtime.snapshot;
    if (!frame || frame.scopeKey !== realtime.activeScopeKey) return;
    const parsed = frame.data;
    const payload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { rows?: unknown; scope?: { tenant?: unknown; window?: unknown }; source?: unknown; availability?: unknown }
      : null;
    const rawRows = payload && Array.isArray(payload.rows) ? payload.rows : null;
    const normalizedRows = rawRows ? rawRows.filter(isExecutiveRealtimeEvent) : [];
    if (!payload
      || !rawRows
      || normalizedRows.length !== rawRows.length
      || !executiveRealtimeSnapshotScopeMatches(realtime.activeScope.tenant, realtime.activeScope.window, payload.scope)
      || !executiveRealtimeRowsMatchTenant(normalizedRows, realtime.activeScope.tenant)
      || !executiveRealtimeSourceMatchesRequest(realtime.activeScope.source, payload.source)
      || normalizedRows.some((row) => !executiveRealtimeSourceMatchesRequest(realtime.activeScope.source, row.source))) {
      setDataAvailability("invalid_payload");
      setAvailabilityDetail("El snapshot inmediato no confirmó tenant, ventana, origen y contrato de eventos válidos.");
      return;
    }
    const snapshotAvailability = String(payload.availability || "").toLowerCase();
    if (snapshotAvailability !== "ready" && snapshotAvailability !== "fallback") {
      setConnectionAttempted(true);
      setConnected(false);
      setStreamWarning("El canal inmediato no confirmó un snapshot; EventSource reintentará sin polling.");
      return;
    }
    setEvents(sortRealtimeEvents(normalizedRows, EXECUTIVE_REALTIME_EVENT_LIMIT));
    const confirmedSource = String(payload.source).toLowerCase();
    setActiveDataSource(confirmedSource === "all" ? "mixed" : confirmedSource === "demo" ? "demo" : "production");
    setDataAvailability(snapshotAvailability === "fallback" ? "fallback" : "ready");
    setAvailabilityDetail(snapshotAvailability === "fallback" ? "Stream operando con datos de respaldo declarados." : "Fuente confirmada por nexID Core.");
    if (snapshotAvailability !== "fallback") setStreamWarning(null);
    setStreamConfirmed(true);
    setLastUpdateAt(frame.receivedAt);
    // A reconnect snapshot recovers tap truth; incidents reconcile once from
    // their durable endpoint. No timer or browser polling loop is created.
    if (canReadIncidents) void refreshIncidents();
  }, [canReadIncidents, realtime.activeScope.source, realtime.activeScope.tenant, realtime.activeScope.window, realtime.activeScopeKey, realtime.snapshot, refreshIncidents]);

  useEffect(() => {
    const frames = unreadDashboardRealtimeFrames(
      realtime.events,
      consumedEventSequenceRef.current,
      realtime.activeScopeKey,
    );
    const fellBehind = dashboardRealtimeConsumerFellBehind(
      consumedEventSequenceRef.current,
      realtime.droppedThroughSequence,
    );
    if (!frames.length && !fellBehind) return;
    consumedEventSequenceRef.current = frames[frames.length - 1]?.sequence || realtime.droppedThroughSequence;

    let incidentChanged = false;
    let contractMismatch = false;
    const accepted: Array<{ payload: TenantTapRealtimeEvent; receivedAt: string }> = [];
    const arrivalIds: string[] = [];
    for (const frame of frames) {
      const payload = frame.data;
      if (isIncidentRealtimeWireEvent(payload)) {
        if (
          executiveRealtimeRowsMatchTenant([{ tenant_slug: payload.tenant_slug }], realtime.activeScope.tenant)
          && executiveRealtimeRowsMatchTenant([{ tenant_slug: payload.tenant_slug }], queryTenant)
        ) incidentChanged = true;
        continue;
      }
      if (!isExecutiveRealtimeEvent(payload) || !executiveRealtimeSourceMatchesRequest(realtime.activeScope.source, payload.source)) {
        contractMismatch = true;
        continue;
      }
      if (!executiveRealtimeRowsMatchTenant([payload], realtime.activeScope.tenant)) continue;
      accepted.push({ payload, receivedAt: frame.receivedAt });
      if (realtimeTapArrivalIsVisible(frame, payload, {
        connected: realtime.status === "connected",
        active: activeView === "overview",
        snapshotSequence: realtime.snapshot?.sequence || 0,
        tenant: queryTenant,
        windowStart: Date.now() - timeRangeMs(timeRange),
        now: Date.now(),
      })) {
        arrivalIds.push(payload.eventId);
      }
    }

    if (contractMismatch) {
      setStreamWarning("El canal inmediato emitió un evento fuera del contrato esperado; se descarta y el stream seguirá activo.");
    }
    if (accepted.length) {
      // Durable events can be re-projected when actor association or consent
      // changes. Drain the complete burst in transport order and replace ids.
      setEvents((previous) => accepted.reduce(
        (next, item) => mergeRealtimeEvents(next, item.payload, EXECUTIVE_REALTIME_EVENT_LIMIT),
        previous,
      ));
      setActiveDataSource(realtime.activeScope.source === "all" ? "mixed" : realtime.activeScope.source);
      setLastUpdateAt(accepted[accepted.length - 1].receivedAt);
    }
    if (arrivalIds.length && !fellBehind) {
      setMapArrival({
        key: `${realtime.activeScopeKey}:${consumedEventSequenceRef.current}`,
        eventIds: arrivalIds.slice(-8),
        expiresAt: Date.now() + 1_500,
      });
    }
    if (incidentChanged) void refreshIncidents();
    if (fellBehind) {
      setStreamWarning("Una ráfaga superó el buffer local; se solicita una reconciliación durable sin polling.");
      router.refresh();
    }
  }, [activeView, queryTenant, realtime.activeScope.source, realtime.activeScope.tenant, realtime.activeScopeKey, realtime.droppedThroughSequence, realtime.events, realtime.snapshot, realtime.status, refreshIncidents, router, timeRange]);

  useEffect(() => {
    const frame = realtime.heartbeat;
    if (!frame || frame.scopeKey !== realtime.activeScopeKey) return;
    const payload = frame.data as { ts?: number | string } | null;
    const heartbeatAt = safeDate(payload?.ts);
    setLastUpdateAt(heartbeatAt ? new Date(heartbeatAt).toISOString() : frame.receivedAt);
    setConnectionAttempted(true);
    // Heartbeats prove transport liveness only; the scoped snapshot still
    // controls whether dashboard values are considered confirmed.
  }, [realtime.activeScopeKey, realtime.heartbeat]);

  useEffect(() => {
    const frame = realtime.warning;
    if (!frame || frame.scopeKey !== realtime.activeScopeKey) return;
    const payload = frame.data as { reason?: string; source?: string; availability?: string } | null;
    const hasReason = Boolean(String(payload?.reason || "").trim());
    if (payload?.availability === "fallback") setDataAvailability("fallback");
    else setDataAvailability("upstream_error");
    if (String(payload?.source || "").toLowerCase() === "demo") setActiveDataSource("demo");
    if (String(payload?.source || "").toLowerCase() === "seed") setActiveDataSource("seed");
    setAvailabilityDetail(String(payload?.reason || "Stream realtime degradado"));
    setStreamWarning(hasReason
      ? "La fuente en tiempo real informó una degradación; se conserva el último snapshot confirmado."
      : "El stream opera en modo degradado.");
  }, [realtime.activeScopeKey, realtime.warning]);

  const tenantOptions = useMemo(
    () => normalizeExecutiveRealtimeTenantDirectory(tenantDirectory),
    [tenantDirectory],
  );
  const queryTenantDisplayName = queryTenant
    ? tenantOptions.find((tenant) => tenant.slug === queryTenant)?.name || tenantDisplayName(queryTenant)
    : "todos los tenants";

  const visibleEvents = useMemo(
    () => {
      if (valuesUnavailable) return [];
      const cutoff = freshnessNow - timeRangeMs(timeRange);
      return (effectiveSelectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === effectiveSelectedTenant))
        .filter((event) => {
          const at = safeDate(event.occurredAt);
          return !at || at >= cutoff;
        });
    },
    [effectiveSelectedTenant, events, freshnessNow, timeRange, valuesUnavailable],
  );
  const commercialActivityEvents = useMemo(
    () => visibleEvents.filter(isCommercialActivitySignal),
    [visibleEvents],
  );
  const geoOpportunityEvents = useMemo(
    () => visibleEvents.filter(isGeoOpportunitySignal),
    [visibleEvents],
  );

  const operationalTimeZone = useMemo(
    () => resolveOperationalTimeZone(visibleEvents, effectiveSelectedTenant, tenantScope),
    [effectiveSelectedTenant, tenantScope, visibleEvents],
  );
  const consoleTimezone = operationalTimeZone.timeZone;
  const consoleTimezoneLabel = operationalTimeZone.isFallback ? "UTC · zona no confirmada" : timezoneLabel(consoleTimezone);

  useEffect(() => {
    const updateClock = () => setClock(formatTimeInZone(Date.now(), consoleTimezone));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [consoleTimezone]);

  const selectTenant = (nextTenant: string) => {
    if (tenantSession || nextTenant === selectedTenant) return;
    setIncidentSelection(null);
    setIncidentsByEventId({});
    setIncidentAvailability(canReadIncidents ? "loading" : "unavailable");
    setSelectedTenant(nextTenant);
  };

  const selectTimeRange = (nextTimeRange: TimeRange) => {
    if (nextTimeRange === timeRange) return;
    setIncidentSelection(null);
    setTimeRange(nextTimeRange);
  };

  const cycleTimeRange = () => {
    setIncidentSelection(null);
    setTimeRange((current) => current === "5m" ? "1h" : current === "1h" ? "24h" : "5m");
  };

  const metrics = useMemo(() => {
    const total = visibleEvents.length;
    const productRecognized = visibleEvents.filter((event) => event.productIdentityRecognized === true).length;
    const authenticated = visibleEvents.filter((event) => event.authenticationVerified === true).length;
    const knownActors = visibleEvents.filter((event) => event.knownActor === true).length;
    const channelConsented = visibleEvents.filter((event) => event.knownActor === true
      && event.commercialConsentGranted === true
      && event.commercialConsentChannels.length > 0).length;
    const risk = visibleEvents.filter((event) => isRealtimeRisk(event.verdict, event.reason)).length;
    const unknown = visibleEvents.filter((event) => event.interactionClass === "unclassified_activity").length;
    const gps = visibleEvents.filter((event) => isClientReportedGps(event.locationSource) && strictCoordinatePair(event.lat, event.lng) != null).length;
    const commercialSignals = commercialActivityEvents.length;
    const geoCommercialSignals = geoOpportunityEvents.length;
    return {
      total,
      productRecognized,
      authenticated,
      knownActors,
      channelConsented,
      risk,
      unknown,
      gps,
      commercialSignals,
      geoCommercialSignals,
      productRecognizedRate: total ? (productRecognized / total) * 100 : 0,
      authenticationRate: total ? (authenticated / total) * 100 : 0,
      knownActorRate: total ? (knownActors / total) * 100 : 0,
      channelConsentRate: total ? (channelConsented / total) * 100 : 0,
      explicitRiskRate: total ? (risk / total) * 100 : 0,
      gpsCoverage: total ? (gps / total) * 100 : 0,
      commercialSignalRate: total ? (commercialSignals / total) * 100 : 0,
    };
  }, [commercialActivityEvents, geoOpportunityEvents, visibleEvents]);
  const recentEventSample = recentEventSamplePresentation(metrics.total);

  const velocitySeries = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const start = now - (11 - index) * 2 * 60_000;
      return {
        label: formatShortTimeInZone(start, consoleTimezone),
        taps: 0,
        risk: 0,
        productRecognized: 0,
        authenticated: 0,
        knownActors: 0,
        consented: 0,
        unknown: 0,
      };
    });
    visibleEvents.forEach((event) => {
      const at = safeDate(event.occurredAt);
      if (!at) return;
      const diff = Math.floor((now - at) / (2 * 60_000));
      const bucket = 11 - diff;
      if (bucket < 0 || bucket > 11) return;
      buckets[bucket].taps += 1;
      if (event.authenticationVerified) buckets[bucket].authenticated += 1;
      if (event.productIdentityRecognized) buckets[bucket].productRecognized += 1;
      if (event.knownActor) buckets[bucket].knownActors += 1;
      if (event.commercialConsentGranted && event.commercialConsentChannels.length > 0) buckets[bucket].consented += 1;
      if (isRealtimeRisk(event.verdict, event.reason)) buckets[bucket].risk += 1;
      else if (!event.productIdentityRecognized && !event.authenticationVerified) buckets[bucket].unknown += 1;
    });
    return buckets;
  }, [consoleTimezone, visibleEvents]);

  const mapLocations=useMemo(()=>filterMapLocations(visibleEvents,locationFilter),[visibleEvents,locationFilter]);
  const mapLocationCounts=useMemo(()=>summarizeMapLocations(visibleEvents),[visibleEvents]);
  const hotspots = useMemo(() => buildHotspots(mapLocations), [mapLocations]);
  const latestEvent = visibleEvents[0] || null;
  const todayLabel = useMemo(() => formatDateInZone(Date.now(), consoleTimezone), [consoleTimezone]);
  const lastUpdateMs = safeDate(lastUpdateAt);
  const streamIsStale = Boolean(connected && streamConfirmed && lastUpdateMs && freshnessNow - lastUpdateMs > 20_000);
  const sourcePresentation = realtimeSourcePresentation(activeDataSource, dataAvailability, availabilityDetail);
  const streamHealth = streamWarning || dataAvailability !== "ready"
    ? { label: "Degradado", detail: streamWarning || sourcePresentation.detail, dot: "bg-amber-300", badge: "border-amber-300/30 bg-amber-400/10 text-amber-100" }
    : !connected
      ? connectionAttempted
        ? { label: "Reconectando", detail: "La conexión se interrumpió; EventSource reintentará automáticamente sin polling.", dot: "bg-amber-300", badge: "border-amber-300/30 bg-amber-400/10 text-amber-100" }
        : { label: "Conectando", detail: "Abriendo el canal de eventos y esperando su primera confirmación.", dot: "bg-cyan-300", badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" }
      : !streamConfirmed
        ? { label: "Sincronizando", detail: "Conexión abierta; esperando la primera confirmación de datos.", dot: "bg-cyan-300", badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" }
        : streamIsStale
          ? { label: "Desactualizado", detail: "No se recibió heartbeat ni snapshot en los últimos 20 segundos.", dot: "bg-rose-300", badge: "border-rose-300/30 bg-rose-400/10 text-rose-100" }
          : { label: activeDataSource === "demo" ? "En vivo - demo" : activeDataSource === "mixed" ? "En vivo - fuente mixta" : "En vivo - produccion", detail: `Stream event-driven confirmado, sin polling. ${sourcePresentation.detail}`, dot: "bg-emerald-400", badge: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" };
  const streamDataUnconfirmed = Boolean(dataAvailability !== "ready" || !streamConfirmed || streamIsStale);
  const mapEvidence = mapEvidencePresentation(activeDataSource, requestTransitionPending || streamDataUnconfirmed);
  const handleExport = () => {
    if (commercialActivityEvents.length === 0) return;
    exportToCsv(
      `nexid-activity-signals-${effectiveSelectedTenant || "tenant-sin-scope"}-${new Date().toISOString().slice(0, 10)}`,
      commercialActivityEvents.map((event) => ({
        eventId: event.eventId,
        tenant: event.tenantSlug || "",
        uid: event.uidMasked,
        occurredAt: event.occurredAt,
        occurredAtTenant: formatDateTimeInZone(event.occurredAt, consoleTimezone),
        timezone: consoleTimezone,
        verdict: event.verdict,
        eventType: event.eventType,
        interactionClass: event.interactionClass,
        productRecognized: event.productIdentityRecognized,
        authenticationVerified: event.authenticationVerified,
        knownActor: event.knownActor,
        commercialConsent: event.commercialConsentGranted,
        city: event.city || "",
        country: event.country || "",
        location: locationSourceLabel(event),
        device: deviceSummary(event),
      })),
      [
        { key: "eventId", label: "Evento" },
        { key: "tenant", label: "Tenant" },
        { key: "uid", label: "UID producto" },
        { key: "occurredAtTenant", label: "Fecha tenant" },
        { key: "timezone", label: "Zona horaria" },
        { key: "occurredAt", label: "Fecha UTC/origen" },
        { key: "verdict", label: "Veredicto" },
        { key: "eventType", label: "Tipo de evento" },
        { key: "interactionClass", label: "Clase de interacción" },
        { key: "productRecognized", label: "Producto reconocido" },
        { key: "authenticationVerified", label: "Autenticación verificada" },
        { key: "knownActor", label: "Actor conocido" },
        { key: "commercialConsent", label: "Consentimiento comercial asociado" },
        { key: "city", label: "Ciudad" },
        { key: "country", label: "País" },
        { key: "location", label: "Ubicación" },
        { key: "device", label: "Dispositivo" },
      ],
    );
  };

  const exportDisabledReason = "No hay actividad con producto reconocido, actor asociado, tipo elegible y consentimiento por canal para exportar.";
  const streetViewTarget = useMemo(
    () => visibleEvents
      .map((event) => strictCoordinatePair(event.lat, event.lng))
      .find((coordinate) => coordinate != null) || null,
    [visibleEvents],
  );
  const streetViewDisabledReason = "No hay coordenadas reportadas utilizables en la ventana actual.";

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
    if (!streetViewTarget) return;
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewTarget.lat},${streetViewTarget.lng}`, "_blank", "noopener,noreferrer");
  };

  const railItems: CrmRailItem[] = [
    { icon: <Activity className="h-5 w-5" />, active: activeView === "overview", label: "Resumen operativo", short: "Vista", title: "Ver KPIs explicados, funnel post-tap y estado de la ventana activa.", action: () => selectActiveView("overview") },
    { icon: <ScanLine className="h-5 w-5" />, active: activeView === "physical-taps", label: "TAP físicos", short: "TAP", title: "Abrir evidencia NFC física, estados reportados, mapa e inbox del tenant.", action: () => selectActiveView("physical-taps") },
    { icon: <Globe className="h-5 w-5" />, active: false, label: "Mapa por capas", short: "Capas", title: "Abrir el mapa y conservar la capa seleccionada.", action: openMapPanel },
    { icon: <Activity className="h-5 w-5" />, active: false, label: "Actividad", short: "DATOS", title: "Ver zonas, productos y eventos observados en esta ventana.", action: openWindowActivity },
    { icon: <Users className="h-5 w-5" />, active: false, label: "Clientes & campañas", short: "Clientes", title: "Abrir segmentos, beneficios, vouchers y campañas post-tap.", action: () => onSectionChange("loyalty") },
    ...(canReadSensitiveEvents ? [{ icon: <ShieldCheck className="h-5 w-5" />, active: false, label: "Riesgos", short: "Riesgo", title: "Abrir eventos para auditar replay, tamper, GPS bajo y dispositivos.", action: () => { router.push(`${DASHBOARD_DESTINATIONS.events.href}?filter=risk`); } }] : []),
    { icon: <BarChart3 className="h-5 w-5" />, active: false, label: "Exportar actividad", short: "CSV", title: "Exportar sólo interacciones con señal comercial; no exporta audiencia ni destinatarios.", action: handleExport, disabled: valuesUnavailable || commercialActivityEvents.length === 0, disabledReason: valuesUnavailable ? "Esperando la confirmación del tenant y la ventana seleccionados." : exportDisabledReason },
    { icon: <Settings className="h-5 w-5" />, active: false, label: "Limpiar filtros", short: "Reset", title: "Restablecer tenant, densidad, zoom y capa base.", action: () => { if (!tenantSession && selectedTenant !== "all") selectTenant("all"); resetMapPresentation(); } },
  ];

  return (
    <div ref={controlRoom.rootRef} data-display-mode={controlRoom.enabled ? "room" : "workspace"} className={`${room.roomShell} nexid-crm-shell fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-[#030a16] text-slate-100 lg:overflow-hidden`}>
      <div className="nexid-crm-backdrop pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(14,165,233,.16),transparent_32%),linear-gradient(180deg,#05101f,#030713_55%,#030713)]" />
      <header data-testid="crm-responsive-header" className="nexid-crm-header relative z-[640] flex min-h-[70px] flex-wrap items-center gap-3 border-b border-cyan-200/10 bg-[#06101d]/90 px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,.04)] lg:px-4">
        <div className="nexid-crm-identity order-1 flex min-w-0 flex-1 items-center gap-4 lg:gap-5">
          <div className="pr-4 text-[24px] font-black tracking-[-0.04em] text-white lg:pr-6 lg:text-[28px]">
            nex<span className="text-cyan-300">ID</span>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-4 lg:pl-5">
            <p className="text-xs text-slate-400">Admin enterprise</p>
            <h1 className="text-[1.4rem] font-black leading-tight tracking-[-0.035em] text-white lg:text-[1.65rem]">{controlRoom.enabled ? "Centro en Vivo" : "CRM y trazabilidad"}</h1>
          </div>
        </div>

        <nav className="nexid-crm-nav order-3 flex min-h-10 w-full overflow-x-auto rounded-xl border border-white/8 bg-slate-950/45 text-xs font-bold text-slate-300">
          <button type="button" aria-label="Volver al mapa y CRM" aria-pressed={activeView === "overview"} title="Volver a métricas, mapa y funnel del CRM en vivo" onClick={() => selectActiveView("overview")} className={`flex min-h-12 items-center justify-center gap-2 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300 ${activeView === "overview" ? "border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200" : "hover:bg-white/5"}`}>
            <Activity className="h-4 w-4" /> CRM en vivo
          </button>
          <button type="button" aria-label="Abrir TAP físicos" aria-pressed={activeView === "physical-taps"} title="Abrir evidencia NFC física, estados reportados, mapa e inbox del tenant" onClick={() => selectActiveView("physical-taps")} className={`flex min-h-12 items-center justify-center gap-2 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300 ${activeView === "physical-taps" ? "border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200" : "hover:bg-white/5"}`}>
            <ScanLine className="h-4 w-4" /> TAP físicos
          </button>
          <button type="button" title="Abrir operación NFC: lotes, tags, QA, anclaje y publicación" onClick={() => onSectionChange("infra")} className="flex min-h-12 items-center justify-center gap-2 px-2 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300">
            <Truck className="h-4 w-4" /> Operación NFC
          </button>
          <button type="button" title="Abrir segmentos, beneficios y campañas post-tap" onClick={() => onSectionChange("loyalty")} className="flex min-h-12 items-center justify-center gap-2 px-2 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300">
            <Users className="h-4 w-4" /> Clientes & campañas
          </button>
          {dashboardCanOpenDestination("map", account) && <button type="button" onClick={() => router.push(`/analytics/map${tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : ""}`)} className="flex min-h-12 items-center justify-center gap-2 px-2 hover:bg-white/5" data-testid="crm-professional-map-link"><Globe className="h-4 w-4"/>Mapa profesional</button>}
          {dashboardCanOpenDestination("batches", account) && <button type="button" onClick={() => router.push(DASHBOARD_DESTINATIONS.batches.href)} className="flex min-h-12 items-center justify-center gap-2 px-2 hover:bg-white/5" data-testid="crm-rolls-link"><Layers className="h-4 w-4"/>Rollos y productos</button>}
        </nav>

        <div className="nexid-crm-header-status order-2 ml-auto flex min-w-0 w-auto flex-wrap items-center justify-end gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-2" title={streamHealth.detail}><i className={`h-2 w-2 rounded-full ${streamHealth.dot}`} /> Stream: {streamHealth.label}</span>
          <span data-testid="crm-source-badge" className={`rounded-full border px-2.5 py-1 font-semibold ${sourcePresentation.badge}`} title={sourcePresentation.detail}>Fuente: {sourcePresentation.label}</span>
          <span className="hidden items-center gap-2 2xl:flex" title={operationalTimeZone.isFallback ? "Zona no confirmada: horario mostrado en UTC" : `Zona informada para la operación: ${consoleTimezone}`}><Clock className="h-4 w-4 text-slate-500" /> {clock}<span className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{consoleTimezoneLabel}</span></span>
          <span className="hidden items-center gap-2 2xl:flex"><CalendarDays className="h-4 w-4 text-slate-500" /> {todayLabel}</span>
          <button ref={controlRoom.buttonRef} type="button" data-testid="control-room-toggle" aria-pressed={controlRoom.enabled} onClick={()=>void controlRoom.toggle()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/30 px-3 text-xs font-bold"><Expand className="h-4 w-4"/>{controlRoom.enabled ? "Salir de modo sala" : "Modo sala"}</button>
          <div className="nexid-crm-theme-control shrink-0" data-testid="crm-theme-control">
            <ThemeToggle locale="es-AR" />
          </div>
          <TenantAccountMenu
            className="nexid-crm-account-menu w-full sm:w-auto"
            email={account.email}
            label={account.label}
            mfaVerified={account.mfaVerified}
            mode={mode}
            permissions={account.permissions}
            deniedPermissions={account.deniedPermissions}
            role={account.role}
            setupCompleted={account.setupCompleted}
            surface="crm"
            tenantSlug={account.tenantSlug || tenantScope}
            clerkEnabled={account.clerkEnabled}
            isDemo={account.isDemo}
          />
        </div>
      </header>

      {controlRoom.notice && <p className={room.roomNotice} role="status">{controlRoom.notice}</p>}
      <aside className="nexid-crm-rail relative z-10 hidden w-24 flex-col items-center border-r border-cyan-200/10 bg-[#07111e]/92 py-4 lg:flex">
        <div className="space-y-3">
          {railItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-pressed={Boolean(item.active)}
              title={item.disabled ? item.disabledReason : item.title}
              onClick={item.action}
              disabled={item.disabled}
              className={`group relative flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl border text-[9px] font-black uppercase tracking-[0.04em] transition ${item.disabled ? "cursor-not-allowed border-white/5 text-slate-600" : item.active ? "border-cyan-300/50 bg-cyan-400/16 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.18)]" : "border-white/6 text-slate-400 hover:border-cyan-300/25 hover:bg-white/5 hover:text-white"}`}
            >
              {item.icon}
              <span className="max-w-full truncate">{item.short}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto" title="Cerrar sesión segura">
          <SecureDashboardLogoutButton
            clerkEnabled={account.clerkEnabled}
            label="Cerrar sesión segura"
            pendingLabel="Cerrando sesión"
            testId="crm-rail-secure-logout"
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-white/8 text-[0px] text-slate-500 transition hover:border-rose-300/35 hover:text-rose-100 disabled:cursor-wait disabled:opacity-70 [&_svg]:h-5 [&_svg]:w-5"
          />
        </div>
      </aside>

      {activeView === "physical-taps" ? (
        <main data-testid="crm-physical-taps-view" className="nexid-crm-main relative z-10 overflow-visible px-3 py-3 pb-14 lg:overflow-y-auto lg:p-4 2xl:p-5">
          <section className="mx-auto w-full max-w-[1600px] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-slate-950/55 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">CRM · evidencia física del tenant</p>
                <h2 className="mt-1 text-xl font-black text-white">TAP físicos en tiempo operativo</h2>
              </div>
              <button type="button" aria-label="Volver al mapa y CRM" onClick={() => selectActiveView("overview")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/10">
                <Activity className="h-4 w-4 text-cyan-200" /> Volver al mapa y CRM
              </button>
            </div>
            <PhysicalTapsCommandCenter
              result={physicalTapsResult}
              tenantSlug={tenantScope}
              tenantDisplayName={physicalTapsTenantDisplayName}
              clerkEnabled={account.clerkEnabled}
            />
          </section>
        </main>
      ) : (
      <main className="nexid-crm-main relative z-10 flex flex-col gap-3 overflow-visible px-3 py-3 pb-14 lg:flex-row lg:gap-3 lg:overflow-hidden lg:p-3 2xl:gap-4 2xl:p-4">
        {controlRoom.enabled ? <section className={room.roomMetrics} aria-label="Indicadores de sala de control">
          {[["Lecturas visibles",valuesUnavailable ? "—" : metrics.total],["Autenticaciones",valuesUnavailable ? "—" : metrics.authenticated],["Zona del teléfono",valuesUnavailable ? "—" : mapLocationCounts.phone],["Estimación Red/IP",valuesUnavailable ? "—" : mapLocationCounts.network],["Señales de riesgo",valuesUnavailable ? "—" : metrics.risk]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}
          <p>{queryTenantDisplayName} · {TIME_RANGE_OPTIONS.find(option=>option.value===timeRange)?.label} · muestra de hasta 50 eventos · {sourcePresentation.label}. Ubicaciones de lecturas, no seguimiento continuo de activos.</p>
        </section> : (
        <section aria-label="Indicadores operativos de la ventana" className="nexid-crm-kpi-column order-2 min-h-0 space-y-2 overflow-hidden lg:order-1 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 xl:w-96">
          <div className="flex items-start justify-between gap-3">
            <span>
              <h2 className="text-xl font-extrabold tracking-[-0.025em] text-white">Lectura operativa</h2>
              <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">Qué pasó, qué es confiable y qué se puede activar ahora.</p>
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-400" title={streamHealth.detail}><i className={`h-2 w-2 rounded-full ${streamHealth.dot}`} /> {streamHealth.label}</span>
          </div>

          <div className="nexid-crm-metric-grid grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricCard icon={<Radio className="h-5 w-5" />} label="Eventos recientes visibles" value={valuesUnavailable ? "—" : recentEventSample.value} delta={valuesUnavailable ? "sin confirmar" : recentEventSample.detail} help={activeDataSource === "demo" ? "Muestra de hasta 50 eventos del recorrido demo aislado; no representa actividad productiva ni un total histórico." : "Muestra de hasta 50 eventos persistidos para el tenant y la ventana activos; no representa un total histórico."} tone="cyan" data={valuesUnavailable ? [] : velocitySeries} />
            <MetricCard icon={<BadgeCheck className="h-5 w-5" />} label="Producto reconocido" value={valuesUnavailable ? "—" : formatPercent(metrics.productRecognizedRate)} delta={valuesUnavailable ? "sin confirmar" : `${metrics.productRecognized} interacciones`} help="Producto, lote o unidad resuelto contra registros NexID. No identifica a una persona ni equivale a autenticación física." tone="blue" data={valuesUnavailable ? [] : velocitySeries} dataKey="productRecognized" />
            <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Autenticación verificada" value={valuesUnavailable ? "—" : formatPercent(metrics.authenticationRate)} delta={valuesUnavailable ? "sin confirmar" : `${metrics.authenticated} eventos`} help="Sólo mensajes SUN con verdict válido, CMAC correcto y UID allowlisted." tone="green" data={valuesUnavailable ? [] : velocitySeries} dataKey="authenticated" />
            <MetricCard icon={<Users className="h-5 w-5" />} label="Actor conocido" value={valuesUnavailable ? "—" : formatPercent(metrics.knownActorRate)} delta={valuesUnavailable ? "sin confirmar" : `${metrics.knownActors} interacciones`} help="Interacciones vinculadas a un consumer/member pseudónimo persistido. No cuenta UIDs como personas ni expone el identificador del actor." tone="blue" data={valuesUnavailable ? [] : velocitySeries} dataKey="knownActors" />
            <MetricCard icon={<Megaphone className="h-5 w-5" />} label="Consentimiento por canal" value={valuesUnavailable ? "—" : formatPercent(metrics.channelConsentRate)} delta={valuesUnavailable ? "sin confirmar" : `${metrics.channelConsented} interacciones`} help="Actor conocido con consentimiento vigente para WhatsApp, teléfono o email. Consentimientos genéricos no habilitan contacto." tone="green" data={valuesUnavailable ? [] : velocitySeries} dataKey="consented" />
            <MetricCard icon={<Target className="h-5 w-5" />} label="Señales comerciales" value={valuesUnavailable ? "—" : formatNumber(metrics.commercialSignals)} delta={valuesUnavailable ? "sin confirmar" : `${metrics.geoCommercialSignals} con zona útil`} help="Actividad event-level: producto reconocido, actor asociado, tipo elegible y canal consentido. No representa audiencia, contactos ni destinatarios; éstos se resuelven server-side con permisos." tone="blue" data={valuesUnavailable ? [] : velocitySeries} dataKey="consented" />
          </div>
          <p data-testid="crm-recent-events-sample-note" className="px-1 text-[10px] leading-4 text-slate-500">
            Indicadores calculados sobre hasta 50 eventos recientes visibles. {recentEventSample.limitReached ? "La muestra alcanzó el límite; puede haber más eventos en la ventana." : "No se presenta este recorte como un total histórico."}
          </p>

          <div className="rounded-lg border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Velocidad de lecturas <span className="font-normal text-slate-400">(lecturas por minuto)</span></p>
              <button type="button" title="Cambiar ventana temporal del CRM" onClick={cycleTimeRange} className="rounded-lg border border-white/8 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">{timeRangeLabel(timeRange)}</button>
            </div>
            <div className="mt-2 h-[92px] 2xl:h-[112px]">
              {valuesUnavailable ? (
                <div data-testid="crm-velocity-pending" className="grid h-full place-items-center rounded-lg border border-dashed border-cyan-300/15 bg-slate-950/35 text-xs font-semibold text-slate-500">Esperando datos confirmados</div>
              ) : <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocitySeries} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="execTaps" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--crm-chart-cyan)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--crm-chart-cyan)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--crm-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--crm-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="taps" stroke="var(--crm-chart-cyan)" strokeWidth={2} fill="url(#execTaps)" dot={{ r: 2, fill: "var(--crm-chart-cyan)" }} />
                </AreaChart>
              </ResponsiveContainer>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
            <div className="flex items-center justify-between">
              <span>
                <p className="text-sm font-bold text-white">Funnel post-tap</p>
                <p className="text-[11px] text-slate-500">De actividad registrada a acción comercial consentida.</p>
              </span>
              <span className="text-xs text-slate-500">{valuesUnavailable ? "sin confirmar" : metrics.commercialSignals ? `${metrics.commercialSignals} señales de actividad` : "sin señales listas aún"}</span>
            </div>
            <div className="mt-3 flex items-start gap-1 overflow-x-auto pb-1">
              <FunnelNode icon={<MousePointerClick className="h-5 w-5" />} label="Actividad" value={valuesUnavailable ? "—" : metrics.total} pct={100} tone="#22d3ee" detail="eventos recientes visibles" pctLabel={valuesUnavailable ? "sin confirmar" : "base"} />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<BadgeCheck className="h-5 w-5" />} label="Producto" value={valuesUnavailable ? "—" : metrics.productRecognized} pct={metrics.productRecognizedRate} tone="#38bdf8" detail="lote o unidad resuelto" pctLabel={valuesUnavailable ? "sin confirmar" : undefined} />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Users className="h-5 w-5" />} label="Actor" value={valuesUnavailable ? "—" : metrics.knownActors} pct={metrics.knownActorRate} tone="#22c55e" detail="pseudónimo persistido" pctLabel={valuesUnavailable ? "sin confirmar" : undefined} />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Megaphone className="h-5 w-5" />} label="Señal comercial" value={valuesUnavailable ? "—" : metrics.commercialSignals} pct={metrics.commercialSignalRate} tone="#a855f7" detail="actividad, no audiencia" pctLabel={valuesUnavailable ? "sin confirmar" : undefined} />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<MapPin className="h-5 w-5" />} label="Con GPS" value={valuesUnavailable ? "—" : metrics.geoCommercialSignals} pct={metrics.total ? metrics.geoCommercialSignals / metrics.total * 100 : 0} tone="#38bdf8" detail="actividad elegible con GPS" pctLabel={valuesUnavailable ? "sin confirmar" : undefined} />
            </div>
          </div>
        </section>

        )}

        <section className="nexid-crm-workspace order-1 flex min-h-0 flex-col gap-4 lg:order-2 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <div className="nexid-crm-map-stack flex min-h-0 shrink-0 flex-col">
            <div className="nexid-crm-scope-toolbar mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold tracking-[-0.025em] text-white">Mapa de eventos por capas</h2>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${streamHealth.badge}`} title={streamHealth.detail}>{streamHealth.label}</span>
              </div>
              <div className="nexid-crm-filters grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <select size={1} aria-label="Filtrar lecturas por tenant" title={tenantSession ? "Alcance fijado por la sesión tenant" : "Consultar lecturas del tenant seleccionado"} value={effectiveSelectedTenant} disabled={tenantSession} onChange={(event) => selectTenant(event.target.value)} className="col-span-2 h-12 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold text-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:text-slate-400 sm:col-span-1 sm:w-auto sm:min-w-[160px]">
                  {tenantSession ? (
                    <option value={lockedTenantScope}>{lockedTenantScope ? tenantDisplayName(lockedTenantScope) : "Tenant no disponible"}</option>
                  ) : (
                    <>
                      <option value="all">Todos los tenants</option>
                      {tenantOptions.map((tenant) => <option key={tenant.slug} value={tenant.slug}>{tenant.name}</option>)}
                    </>
                  )}
                </select>
                <select size={1} aria-label="Cambiar ventana temporal del mapa y KPIs" title="Cambiar ventana temporal del mapa y KPIs" value={timeRange} onChange={(event) => selectTimeRange(event.target.value as TimeRange)} className="h-12 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold text-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20">
                  {TIME_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select size={1} aria-label="Cambiar capa base del mapa" title="Cambiar capa base del mapa" value={baseMap} onChange={(event) => selectBaseMap(event.target.value as BaseMapLayer)} className="h-12 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold text-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 2xl:hidden">
                  {BASEMAP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" title={valuesUnavailable ? "Esperando la confirmación del tenant y la ventana seleccionados." : commercialActivityEvents.length === 0 ? exportDisabledReason : "Exportar actividad con señal comercial a CSV"} onClick={handleExport} disabled={valuesUnavailable || commercialActivityEvents.length === 0} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-4 text-sm font-bold text-white transition hover:border-cyan-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"><Download className="h-4 w-4" /> {valuesUnavailable ? "Sin confirmar" : commercialActivityEvents.length === 0 ? "Sin señales" : "Exportar"}</button>
              </div>
            </div>

            {(requestTransitionPending || streamDataUnconfirmed || !visibleEvents.length) ? (
              <div className="mb-3">
                {controlRoom.enabled ? <details className={room.roomWarning}><summary>{requestTransitionPending ? "Sincronizando empresa" : streamDataUnconfirmed ? "Actividad sin confirmar · ver estado" : "Sin eventos en la ventana"}</summary><p>{streamHealth.detail} Última actualización: {timeAgo(lastUpdateAt)}. Una falla de la fuente no representa cero eventos.</p></details> : <EnterpriseOpsState
                  compact
                  variant={requestTransitionPending || streamDataUnconfirmed ? "warning" : "empty"}
                  title={requestTransitionPending ? "Sincronizando tenant…" : streamDataUnconfirmed ? "Actividad todavía no confirmada" : "Sin eventos en los filtros activos"}
                  description={requestTransitionPending
                    ? `Consultando ${queryTenantDisplayName} para la ventana y fuente activas. Todavía no se confirma un cero operativo.`
                    : streamDataUnconfirmed
                      ? `${streamHealth.detail} Los indicadores visibles pueden provenir del último snapshot confirmado y no representan un cero operativo.`
                      : "El stream y la consulta persistida confirmaron que no hay eventos recientes visibles para este tenant y esta ventana temporal."}
                  checklist={requestTransitionPending
                    ? ["Esperar la respuesta del scope seleccionado", "No usar los indicadores hasta completar la sincronización"]
                    : streamDataUnconfirmed
                      ? ["Esperar reconexión o revisar la fuente antes de decidir", `Última actualización: ${timeAgo(lastUpdateAt)}`]
                      : ["Ampliar el rango temporal", "Cambiar tenant o realizar un tap NFC de control"]}
                  testId="crm-realtime-data-state"
                />}
              </div>
            ) : null}

            <MapSourceControls value={locationFilter} onChange={setLocationFilter} counts={mapLocationCounts} />
            <div id="live-tap-map" ref={mapPanelRef} data-map-fullscreen={isMapFullscreen ? "true" : "false"} data-map-evidence-state={mapEvidence.state} className={`nexid-crm-map-panel relative flex shrink-0 flex-col overflow-hidden border border-cyan-100/10 bg-[#061426] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ${isMapFullscreen ? "fixed inset-0 z-[260] h-screen min-h-screen rounded-none border-cyan-300/25 bg-[#020713] p-2" : "rounded-2xl"}`}>
              <div className="nexid-crm-map-control-deck relative z-30 grid shrink-0 gap-3 border-b border-white/8 bg-slate-950/72 p-3 backdrop-blur-xl lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                <div role="group" aria-label="Acciones del mapa" className="nexid-crm-map-actions flex min-w-0 items-center gap-2 overflow-x-auto">
                  <button type="button" title="Acercar mapa sin agrandar artificialmente los eventos" onClick={() => setMapZoom((value) => Math.min(1.22, Number((value + 0.08).toFixed(2))))} className="nexid-crm-map-control grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-xl font-bold text-white shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Acercar mapa">+</button>
                  <button type="button" title="Alejar mapa para ver más territorio" onClick={() => setMapZoom((value) => Math.max(0.9, Number((value - 0.08).toFixed(2))))} className="nexid-crm-map-control grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-xl font-bold text-white shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Alejar mapa">−</button>
                  <button type="button" title="Restablecer densidad, zoom y capa base según el tema activo" onClick={resetMapPresentation} className="nexid-crm-map-control grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-slate-200 shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Restablecer mapa"><RotateCcw className="h-5 w-5" /></button>
                  <button type="button" title={isMapFullscreen ? "Salir de pantalla completa" : "Pantalla completa real para monitor de control"} onClick={() => void toggleMapFullscreen()} className="nexid-crm-map-control grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-slate-200 shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label={isMapFullscreen ? "Salir de pantalla completa" : "Abrir pantalla completa"}><Expand className="h-5 w-5" /></button>
                </div>

                <div className="nexid-crm-map-toolbar flex min-w-0 items-start justify-end gap-2">
                  <div role="group" aria-label="Visualización de eventos" className="nexid-crm-map-view-controls flex min-w-0 flex-1 items-center justify-start gap-2 overflow-x-auto lg:justify-end">
                    {MAP_VIEW_OPTIONS.map((option) => (
                      <button key={option.value} type="button" aria-pressed={mapView === option.value} title={option.title} onClick={() => setMapView(option.value)} className={`nexid-crm-map-view-button flex h-11 min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold shadow-lg transition sm:min-w-0 sm:flex-none sm:gap-2 sm:px-3 sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${mapView === option.value ? "border-cyan-300 bg-cyan-400/16 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.2)]" : "border-white/10 bg-slate-950/72 text-slate-300 hover:border-cyan-300/35 hover:text-white"}`}>
                        {option.icon}<span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <div role="group" aria-label="Capa base del mapa" className="nexid-crm-map-base-controls hidden shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-slate-950/72 p-1 2xl:flex" title="Cambiar capa base del mapa">
                    {BASEMAP_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        title={option.title}
                        aria-pressed={baseMap === option.value}
                        onClick={() => selectBaseMap(option.value)}
                        className={`min-h-10 rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.06em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${baseMap === option.value ? "bg-cyan-300 text-slate-950 shadow-[0_6px_18px_rgba(34,211,238,.2)]" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" title={valuesUnavailable ? "Esperando la confirmación del tenant y la ventana seleccionados." : streetViewTarget ? "Abrir Google Maps Street View en una coordenada reportada de la ventana actual" : streetViewDisabledReason} onClick={openStreetView} disabled={valuesUnavailable || !streetViewTarget} className="nexid-crm-map-street hidden h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/72 px-3 text-sm font-bold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-600 2xl:flex"><Globe className="h-4 w-4" /> {valuesUnavailable ? "Sin confirmar" : streetViewTarget ? "Street" : "Sin GPS"}</button>
                </div>
              </div>

              <div className={`nexid-crm-map-body grid min-h-0 ${isMapFullscreen ? "flex-1" : ""} 2xl:grid-cols-[minmax(0,1fr)_282px] 2xl:grid-rows-[auto_minmax(0,1fr)]`}>
                <details aria-label="Leyenda y fuente del mapa" className="nexid-crm-map-legend relative z-20 m-3 mb-0 min-w-0 rounded-xl border border-white/10 bg-slate-950/72 p-3 text-xs text-slate-200 shadow-xl backdrop-blur 2xl:col-start-2 2xl:row-start-1 2xl:ml-0 2xl:max-w-none">
                  <summary>Cómo leer la capa y su evidencia</summary>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-cyan-100">Capa {MAP_VIEW_OPTIONS.find((option) => option.value === mapView)?.label}</p>
                    <span data-testid="crm-map-data-mode" data-state={mapEvidence.state} className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] ${mapEvidence.badge}`}>{mapEvidence.label}</span>
                  </div>
                  <p className="mb-2 text-xs font-medium leading-[1.15rem] text-slate-400">{MAP_VIEW_OPTIONS.find((option) => option.value === mapView)?.description}</p>
                  <p className="mb-2 text-[11px] font-semibold leading-4 text-slate-300">{mapEvidence.detail}</p>
                {mapView === "heat" ? (
                  <div aria-label="Escala relativa de volumen observado">
                    <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600" aria-hidden="true" />
                    <div className="mt-1.5 flex justify-between gap-3 text-[10px] font-semibold text-slate-300"><span>Menor volumen</span><span>Mayor volumen</span></div>
                  </div>
                ) : mapView === "points" ? (
                  <div className="space-y-1.5 text-[11px] font-medium text-slate-300">
                    <p className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-cyan-300" /> Lectura observada</p>
                    <p className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Evento con señal de riesgo</p>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[11px] font-medium text-slate-300"><i className="h-3 w-3 rounded-full border border-cyan-300/70 bg-cyan-300/10" /> Radio visual; no es geofencing</p>
                )}
                </details>

                <div className={`nexid-crm-map-canvas-region ${isMapFullscreen ? "min-h-0 h-full" : "h-[460px] sm:h-[520px]"} min-w-0 w-full p-3 2xl:col-start-1 2xl:row-span-2 2xl:row-start-1`}>
                  <RealtimeMapLibreMap hotspots={hotspots} events={mapLocations} mapView={mapView} mode={mode} zoom={mapZoom} baseMap={baseMap} dataState={mapEvidence.state} dataStateDetail={mapEvidence.detail} arrival={mapArrival} />
                </div>

                <div tabIndex={0} role="region" aria-label="Últimos eventos visibles" data-incident-event-list className="nexid-crm-events-rail relative z-20 m-3 mt-0 max-h-[250px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/78 p-3.5 shadow-2xl backdrop-blur 2xl:col-start-2 2xl:row-start-2 2xl:ml-0 2xl:mt-3 2xl:min-h-0 2xl:max-h-none">
                <p className="text-base font-extrabold tracking-[-0.015em] text-white">Últimos eventos visibles</p>
                <div className="mt-3 space-y-2">
                  {valuesUnavailable ? <p data-testid="crm-events-pending" className="rounded-xl border border-dashed border-white/10 bg-slate-900/45 p-3 text-xs leading-5 text-slate-400">La actividad aparecerá cuando el tenant y la ventana queden confirmados.</p> : null}
                  {visibleEvents.slice(0, 4).map((event) => {
                    const authenticated = event.authenticationVerified === true;
                    const recognized = event.productIdentityRecognized === true;
                    const risk = isRealtimeRisk(event.verdict, event.reason);
                    const linkedIncident = incidentsByEventId[String(event.eventId)] || null;
                    return (
                      <button type="button" onClick={() => setIncidentSelection(snapshotIncidentEventSelection(event, visibleEvents.slice(0, 4)))} key={incidentEventNavigationKey(event)} aria-haspopup="dialog" aria-expanded={selectedEvent ? incidentEventNavigationKey(selectedEvent) === incidentEventNavigationKey(event) : false} data-incident-event-key={incidentEventNavigationKey(event)} data-selected={selectedEvent ? incidentEventNavigationKey(selectedEvent) === incidentEventNavigationKey(event) : false} className="min-h-[5.25rem] w-full rounded-xl border border-white/8 bg-slate-900/70 p-3 text-left transition hover:border-cyan-300/35 hover:bg-slate-900 data-[selected=true]:border-cyan-300 data-[selected=true]:ring-1 data-[selected=true]:ring-cyan-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" data-testid="open-event-incident-drawer">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-[11px] leading-4 text-slate-500">{formatReadingDateTime(event, operationalTimeZone)}</p>
                          <span className={`rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold ${linkedIncident ? "bg-cyan-400/10 text-cyan-200" : authenticated ? "bg-emerald-400/10 text-emerald-300" : risk ? "bg-rose-400/10 text-rose-300" : "bg-sky-400/10 text-sky-300"}`}>{linkedIncident ? `Incidente · ${incidentStatusLabel(linkedIncident.status)}` : authenticated ? "Autenticación verificada" : recognized ? "Producto reconocido" : risk ? "Riesgo" : "Actividad"}</span>
                        </div>
                        <p className="mt-1.5 text-[15px] font-black tracking-[-0.015em] text-white">{event.productName?.trim() || "Lectura NFC"}</p>
                        {event.city && event.locationSource ? <p className="mt-0.5 text-xs text-slate-300">{event.city}{event.country ? `, ${event.country}` : ""} · {mapLocationDescription(event)}</p> : null}
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">UID: {event.uidMasked || "no disponible"}</p>
                        <p className="text-xs text-slate-400">{deviceSummary(event)}</p>
                        <p className="mt-1.5 text-[11px] font-bold text-cyan-300">Abrir evidencia y expediente →</p>
                      </button>
                    );
                  })}
                </div>
                {canReadSensitiveEvents ? (
                  <button type="button" title="Abrir la auditoría completa de eventos" onClick={() => { router.push(DASHBOARD_DESTINATIONS.events.href); }} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 text-sm font-bold text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Ver todos los eventos</button>
                ) : (
                  <span aria-disabled="true" title={eventsUnavailableReason} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/45 px-3 text-center text-sm font-semibold text-slate-500" data-testid="events-audit-unavailable">{eventsUnavailableReason}</span>
                )}
                </div>
              </div>
            </div>
          </div>

          <CrmWindowActivityPanel
            events={visibleEvents}
            confirmed={!valuesUnavailable && mapEvidence.state !== "unavailable"}
            source={activeDataSource}
            sourceLabel={sourcePresentation.label}
            tenantLabel={queryTenantDisplayName}
            timeRangeLabel={timeRangeLabel(timeRange)}
            formatEventTime={(event) => formatReadingDateTime(event, operationalTimeZone)}
            onSelectEvent={(event, selection) => setIncidentSelection(snapshotIncidentEventSelection(event, selection))}
            onOpenPhysicalTaps={() => selectActiveView("physical-taps")}
            onOpenAudit={canReadSensitiveEvents ? () => router.push(DASHBOARD_DESTINATIONS.events.href) : undefined}
            auditUnavailableReason={eventsUnavailableReason}
          />
        </section>
      </main>
      )}

      {selectedEvent ? (
        <IncidentEventDrawer
          key={`${selectedEvent.tenantSlug || "global"}:${selectedEvent.eventId}`}
          event={selectedEvent}
          operationalTimeZone={operationalTimeZone}
          incident={incidentsByEventId[String(selectedEvent.eventId)] || null}
          incidentAvailability={incidentAvailability}
          canRead={canReadIncidents}
          canWrite={canWriteIncidents && selectedEvent.source === "production"}
          onClose={() => setIncidentSelection(null)}
          onIncident={handleIncident}
          navigation={incidentSelection ? {
            position: incidentSelection.index + 1,
            total: incidentSelection.events.length,
            onPrevious: incidentSelection.index > 0 ? () => setIncidentSelection((current) => moveIncidentEventSelection(current, -1)) : undefined,
            onNext: incidentSelection.index < incidentSelection.events.length - 1 ? () => setIncidentSelection((current) => moveIncidentEventSelection(current, 1)) : undefined,
          } : undefined}
        />
      ) : null}

      <footer className="nexid-crm-footer fixed bottom-0 left-0 right-0 z-20 flex h-9 items-center justify-between gap-3 border-t border-white/8 bg-[#06101d]/95 px-3 text-[11px] text-slate-400 lg:px-8 lg:text-xs">
        <span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${streamHealth.dot}`} /> Stream: {streamHealth.label}</span>
        <span className="hidden sm:inline">Actualizado: {timeAgo(lastUpdateAt)}</span>
        <span className="hidden md:inline">Fuente: {sourcePresentation.label} · nexID Core · Precisión de ubicación: {latestEvent?.locationAccuracyM ? `±${Math.round(Number(latestEvent.locationAccuracyM))} m` : "según evento"}</span>
      </footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="crm-stream-live-region">
        Estado del stream: {streamHealth.label}. {streamHealth.detail}
      </p>
    </div>
  );
}
