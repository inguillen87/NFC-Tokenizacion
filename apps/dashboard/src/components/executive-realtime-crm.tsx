"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Clock,
  Crosshair,
  Download,
  Expand,
  Gift,
  Globe,
  Layers,
  MapPin,
  Megaphone,
  MousePointerClick,
  Radio,
  RotateCcw,
  ScanLine,
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
import { normalizeTenantTapRealtimeEvent } from "@product/core";
import { RealtimeMapLibreMap, type BaseMapLayer } from "./realtime-maplibre-map";
import { TenantAccountMenu } from "./tenant-account-menu";
import { EnterpriseOpsState } from "./enterprise-ops-state";
import { IncidentEventDrawer } from "./incident-event-drawer";
import { PhysicalTapsCommandCenter } from "./physical-taps-command-center";
import { SecureDashboardLogoutButton } from "./secure-dashboard-logout-button";
import { exportToCsv } from "../lib/export-utils";
import { strictCoordinatePair } from "../lib/geo-coordinates";
import { classifyLocationProvenance } from "../lib/location-provenance";
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
import { dashboardCanOpenDestination } from "../lib/dashboard-destination-policy";
import {
  incidentByEvent,
  isIncidentRealtimeWireEvent,
  type DashboardIncident,
} from "../lib/incident-workflow";

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

type MarketOpportunity = {
  key: string;
  city: string;
  country: string;
  taps: number;
  authenticationRate: number;
  gpsRate: number;
  riskRate: number;
  geoCommercialSignals: number;
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

type CommercialContext = {
  key: "wine" | "agro" | "general";
  panelTitle: string;
  panelSubtitle: string;
  headline: string;
  noData: string;
  playbooks: Array<{ eyebrow: string; title: string; body: string }>;
};

function isClientReportedGps(value?: string | null) {
  return classifyLocationProvenance(value) === "consented_gps";
}

const COMMERCIAL_CONTEXTS: Record<CommercialContext["key"], CommercialContext> = {
  wine: {
    key: "wine",
    panelTitle: "IA de cercanía comercial",
    panelSubtitle: "reglas sobre lecturas visibles para priorizar ciudad, club, stock y canje",
    headline: "Próxima acción comercial",
    noData: "Cuando entren productos reconocidos, actores conocidos y consentimientos por canal, la consola prioriza ciudad, club, voucher, stock y punto de canje.",
    playbooks: [
      {
        eyebrow: "Señal",
        title: "Mensaje NFC validado",
        body: "nexID separa el producto QR/NFC estático reconocido de la autenticación SUN verificada. La ciudad, coordenada y hora son datos reportados por el evento; no prueban la ubicación física de la unidad.",
      },
      {
        eyebrow: "Zona",
        title: "Actividad por ciudad",
        body: "El CRM muestra actividad, producto reconocido, autenticación verificada, actor conocido y consentimiento por canal como métricas independientes.",
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
    noData: "Cuando entren productos reconocidos, actores conocidos y consentimientos por canal, la consola prioriza lote, canal, región, uso responsable y soporte técnico.",
    playbooks: [
      {
        eyebrow: "Señal",
        title: "Producto NFC reconocido",
        body: "nexID distingue producto registrado de autenticación criptográfica SUN. La ubicación mostrada fue reportada por el evento y no certifica el recorrido físico de la unidad.",
      },
      {
        eyebrow: "Zona",
        title: "Canal y territorio",
        body: "El CRM muestra actividad por zona, GPS bajo, riesgo e interacciones elegibles por canal para soporte o campaña.",
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
    noData: "Cuando entren productos reconocidos, actores conocidos y consentimientos por canal, la consola prioriza ciudad, segmento, canal y acción comercial.",
    playbooks: [
      {
        eyebrow: "Señal",
        title: "Lectura asociada al producto",
        body: "El evento vincula NFC/QR, lote y producto con el contexto reportado. La ubicación es una señal del dispositivo o una estimación declarada, no una prueba física del producto.",
      },
      {
        eyebrow: "Zona",
        title: "Actividad por zona",
        body: "El CRM muestra ciudades con actividad, riesgo, producto reconocido e interacciones consentidas accionables.",
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
    const authenticationRate = hotspot.taps ? (hotspot.valid / hotspot.taps) * 100 : 0;
    const gpsRate = hotspot.taps ? (hotspot.gps / hotspot.taps) * 100 : 0;
    const riskRate = hotspot.taps ? (hotspot.risk / hotspot.taps) * 100 : 0;
    const geoCommercialSignals = cityRows.filter(isGeoOpportunitySignal).length;
    const consentChannels = [...new Set(cityRows
      .filter(isGeoOpportunitySignal)
      .flatMap((row) => row.commercialConsentChannels))];
    const channel = consentChannels
      .map((value) => value === "whatsapp" ? "WhatsApp" : value === "phone" ? "Teléfono" : value === "email" ? "Email" : value)
      .join(" + ") || "Sin canal consentido";

    let offer = "15% club post-tap";
    let playbook = "Enviar beneficio sólo por canales con consentimiento vigente y medir canje por ciudad.";
    let reason = "Hay interacciones asociadas a producto, actor conocido y canal consentido para evaluar fidelización.";

    if (riskRate > 12) {
      offer = "Beneficio con validación";
      playbook = "Separar lecturas sospechosas y resolver cualquier destinatario mediante el endpoint server-side de audiencia, alcance y permisos.";
      reason = "La zona tiene actividad, pero necesita control antifraude antes de escalar.";
    } else if (gpsRate < 60) {
      offer = "Bono por activar GPS";
      playbook = "Pedir opt-in de portal y mejorar precision antes de pauta paga.";
      reason = "Hay actividad, pero falta ubicación fina para cercanía comercial.";
    } else if (hotspot.taps >= 10) {
      offer = "Drop local 2x1";
      playbook = "Activar pauta local, historias con QR/NFC y cupo limitado por barrio.";
      reason = "Volumen suficiente para campaña geolocalizada.";
    } else if (authenticationRate >= 90) {
      offer = "Early access club";
      playbook = "Premiar primeros compradores y pedir referido en portal de usuario.";
      reason = "Pocas lecturas, pero de alta calidad comercial.";
    }

    const score = Math.max(
      0,
      Math.min(99, Math.round(authenticationRate * 0.42 + gpsRate * 0.22 + Math.min(hotspot.taps * 7, 28) + geoCommercialSignals * 2 - riskRate * 0.45)),
    );

    return {
      key: hotspot.key,
      city: hotspot.city,
      country: hotspot.country,
      taps: hotspot.taps,
      authenticationRate,
      gpsRate,
      riskRate,
      geoCommercialSignals,
      score,
      channel,
      offer,
      playbook,
      reason,
      campaignName: `Campaña CRM ${index + 1}: ${hotspot.city}`,
    };
  })
    .filter((opportunity) => opportunity.geoCommercialSignals > 0)
    .sort((a, b) => b.score - a.score || b.taps - a.taps)
    .slice(0, 5);
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
    return `Activar ${opportunity.offer} en ${opportunity.city}: cata, visita o beneficio sólo por canales con consentimiento vigente. Reponer producto, habilitar QR/NFC de canje y pauta local donde ya hay ${opportunity.taps} interacciones.`;
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
    <div className="rounded-xl border border-slate-700/70 bg-[linear-gradient(180deg,rgba(17,31,52,.92),rgba(7,15,29,.94))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase leading-4 tracking-[0.055em] text-slate-300">
          <span style={{ color }}>{icon}</span>
          {label}
        </div>
        <span className={tone === "red" ? "rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300" : "rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300"}>{delta}</span>
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
  streamSource,
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
  mode: MapMode;
  streamSource: RealtimeStreamSource;
  initialDataSource: RealtimeDataSource;
  initialAvailability: RealtimeAvailability;
  initialAvailabilityDetail: string;
  initialView: ExecutiveCrmView;
  physicalTapsResult: PhysicalTapsResult;
  physicalTapsTenantDisplayName: string;
  onSectionChange?: (section: CrmSection) => void;
}) {
  const canReadSensitiveEvents = dashboardHighImpactPermissionMatches(
    account.role,
    account.permissions,
    "events.read_sensitive",
    account.deniedPermissions,
  );
  const canOpenCampaigns = dashboardCanOpenDestination("campaigns", {
    role: account.role,
    permissions: account.permissions,
    deniedPermissions: account.deniedPermissions,
    isDemo: Boolean(account.isDemo),
  });
  const [activeView, setActiveView] = useState<ExecutiveCrmView>(initialView);
  const [events, setEvents] = useState(() => canReadSensitiveEvents ? sortRealtimeEvents(initialEvents, 50) : []);
  const [connected, setConnected] = useState(false);
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [pollingFallbackActive, setPollingFallbackActive] = useState(false);
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
  const [mapZoom, setMapZoom] = useState(1);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [clock, setClock] = useState("");
  const [campaignDraft, setCampaignDraft] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TenantTapRealtimeEvent | null>(null);
  const [incidentsByEventId, setIncidentsByEventId] = useState<Record<string, DashboardIncident>>({});
  const [incidentAvailability, setIncidentAvailability] = useState<"loading" | "ready" | "unavailable">("loading");
  const canReadIncidents = account.role === "super-admin"
    ? !dashboardPermissionDenied(account.deniedPermissions, "incidents:read")
    : dashboardPermissionMatches(account.permissions, "incidents:read", account.deniedPermissions);
  const canWriteIncidents = account.role === "super-admin"
    ? !dashboardPermissionDenied(account.deniedPermissions, "incidents:write")
    : dashboardPermissionMatches(account.permissions, "incidents:write", account.deniedPermissions);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tenantSession) setSelectedTenant(lockedTenantScope);
  }, [lockedTenantScope, tenantSession]);

  useEffect(() => {
    const syncBaseMapWithTheme = () => {
      setBaseMap((current) => current === "light" || current === "dark" ? preferredDashboardBaseMap() : current);
    };
    syncBaseMapWithTheme();
    const observer = new MutationObserver(syncBaseMapWithTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const effectiveSelectedTenant = tenantSession ? lockedTenantScope : selectedTenant;

  const handleIncident = useCallback((incident: DashboardIncident) => {
    setIncidentsByEventId((current) => ({ ...current, [String(incident.eventId)]: incident }));
    setIncidentAvailability("ready");
  }, []);

  const refreshIncidents = useCallback(async () => {
    if (!canReadIncidents) return;
    const url = new URL("/api/admin/incidents", window.location.origin);
    url.searchParams.set("limit", "100");
    if (tenantScope) url.searchParams.set("tenant", tenantScope);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        setIncidentAvailability("unavailable");
        return;
      }
      const payload = await response.json().catch(() => null) as { ok?: boolean; incidents?: DashboardIncident[] } | null;
      if (!payload?.ok || !Array.isArray(payload.incidents)) {
        setIncidentAvailability("unavailable");
        return;
      }
      setIncidentsByEventId(incidentByEvent(payload.incidents));
      setIncidentAvailability("ready");
    } catch {
      setIncidentAvailability("unavailable");
    }
  }, [canReadIncidents, tenantScope]);

  useEffect(() => {
    document.body.classList.add("nexid-crm-overlay-active");
    return () => document.body.classList.remove("nexid-crm-overlay-active");
  }, []);

  const selectActiveView = useCallback((nextView: ExecutiveCrmView) => {
    setActiveView(nextView);
    const nextUrl = new URL(window.location.href);
    if (nextView === "physical-taps") nextUrl.searchParams.set("view", "physical-taps");
    else nextUrl.searchParams.delete("view");
    const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextHref !== currentHref) window.history.pushState(null, "", nextHref);
  }, []);

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
    if (!canReadIncidents) return;
    void refreshIncidents();
    const poll = window.setInterval(() => void refreshIncidents(), 15_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshIncidents();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canReadIncidents, refreshIncidents]);

  useEffect(() => {
    if (!canReadSensitiveEvents) {
      setEvents([]);
      setConnected(false);
      setConnectionAttempted(true);
      setPollingFallbackActive(false);
      setStreamConfirmed(false);
      setActiveDataSource("unavailable");
      setDataAvailability("upstream_error");
      setAvailabilityDetail("events.read_sensitive permission required");
      return;
    }
    const streamUrl = new URL("/api/admin/events/stream", window.location.origin);
    streamUrl.searchParams.set("limit", "50");
    streamUrl.searchParams.set("window", timeRange);
    streamUrl.searchParams.set("source", streamSource);
    if (tenantScope) streamUrl.searchParams.set("tenant", tenantScope);
    const pollUrl = new URL("/api/admin/events", window.location.origin);
    pollUrl.searchParams.set("limit", "50");
    pollUrl.searchParams.set("range", timeRange);
    pollUrl.searchParams.set("source", streamSource);
    if (tenantScope) pollUrl.searchParams.set("tenant", tenantScope);

    let disposed = false;
    let pollInFlight = false;
    let pollTimer: number | null = null;
    const stopPollingFallback = () => {
      if (pollTimer !== null) window.clearInterval(pollTimer);
      pollTimer = null;
      if (!disposed) setPollingFallbackActive(false);
    };
    const pollPersistedEvents = async () => {
      if (disposed || pollInFlight) return;
      pollInFlight = true;
      try {
        const response = await fetch(pollUrl, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
        const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : null;
        if (!rawRows) return;
        const normalizedRows = rawRows.flatMap((row) => {
          try {
            return [normalizeTenantTapRealtimeEvent(row) as TenantTapRealtimeEvent];
          } catch {
            return [];
          }
        });
        if (streamSource === "production" && normalizedRows.some((row) => row.source !== "production")) return;
        setEvents((previous) => normalizedRows.reduce(
          (current, incoming) => mergeRealtimeEvents(current, incoming, 50),
          previous,
        ));
        setActiveDataSource(streamSource === "all" ? "mixed" : streamSource === "demo" ? "demo" : "production");
        setDataAvailability("ready");
        setAvailabilityDetail("Eventos persistidos confirmados; el canal inmediato está reconectando.");
        setStreamWarning(null);
        setStreamConfirmed(true);
        setLastUpdateAt(new Date().toISOString());
      } finally {
        pollInFlight = false;
      }
    };
    const startPollingFallback = () => {
      if (disposed || pollTimer !== null) return;
      setPollingFallbackActive(true);
      void pollPersistedEvents();
      pollTimer = window.setInterval(() => void pollPersistedEvents(), 10_000);
    };

    setConnected(false);
    setConnectionAttempted(false);
    setPollingFallbackActive(false);
    setStreamConfirmed(false);
    setStreamWarning(null);
    setActiveDataSource(initialDataSource);
    setDataAvailability(initialAvailability);
    setAvailabilityDetail(initialAvailabilityDetail);
    // Start with the durable path as a safety net. Only a tenant-scoped SSE
    // snapshot or tap event may retire it; open/heartbeat are transport-only.
    startPollingFallback();
    const source = new EventSource(streamUrl.toString());
    source.onopen = () => {
      setConnectionAttempted(true);
      setConnected(true);
      // An open TCP/SSE channel is not proof that the scoped dataset arrived.
      // Keep persisted polling alive until a snapshot or event confirms data.
    };
    source.onerror = () => {
      setConnectionAttempted(true);
      setConnected(false);
      startPollingFallback();
    };

    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { rows?: TenantTapRealtimeEvent[]; source?: string; availability?: string };
        if (!Array.isArray(payload.rows)) return;
        const snapshotAvailability = String(payload.availability || "ready").toLowerCase();
        if (snapshotAvailability !== "ready" && snapshotAvailability !== "fallback") {
          setConnectionAttempted(true);
          setConnected(false);
          setStreamWarning("El canal inmediato no confirmó un snapshot; se consultan los eventos persistidos.");
          startPollingFallback();
          return;
        }
        setEvents(sortRealtimeEvents(payload.rows || [], 50));
        const confirmedSource = String(payload.source || streamSource).toLowerCase();
        setActiveDataSource(confirmedSource === "all" ? "mixed" : confirmedSource === "demo" ? "demo" : "production");
        setDataAvailability(snapshotAvailability === "fallback" ? "fallback" : "ready");
        setAvailabilityDetail(snapshotAvailability === "fallback" ? "Stream operando con datos de respaldo declarados." : "Fuente confirmada por nexID Core.");
        if (snapshotAvailability !== "fallback") setStreamWarning(null);
        setStreamConfirmed(true);
        setLastUpdateAt(new Date().toISOString());
        stopPollingFallback();
      } catch {
        // keep previous state
      }
    };

    const onEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as unknown;
        if (isIncidentRealtimeWireEvent(payload)) {
          void refreshIncidents();
          return;
        }
        const tapPayload = payload as TenantTapRealtimeEvent;
        // A durable event can be re-projected when actor association or consent
        // changes. mergeRealtimeEvents replaces that id without adding activity.
        setEvents((prev) => mergeRealtimeEvents(prev, tapPayload, 50));
        setActiveDataSource(streamSource === "all" ? "mixed" : streamSource);
        setDataAvailability("ready");
        setAvailabilityDetail("Evento confirmado por nexID Core.");
        setStreamWarning(null);
        setStreamConfirmed(true);
        setLastUpdateAt(new Date().toISOString());
        stopPollingFallback();
      } catch {
        // keep previous state
      }
    };

    const onHeartbeat = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { ts?: number | string };
        const heartbeatAt = safeDate(payload.ts);
        setLastUpdateAt(heartbeatAt ? new Date(heartbeatAt).toISOString() : new Date().toISOString());
        setConnectionAttempted(true);
        setConnected(true);
        // Heartbeats prove transport liveness only. They cannot replace a
        // tenant-scoped snapshot or persisted event confirmation.
      } catch {
        setLastUpdateAt(new Date().toISOString());
      }
    };

    const onWarning = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { reason?: string; source?: string; availability?: string };
        const hasReason = Boolean(String(payload.reason || "").trim());
        if (payload.availability === "fallback") setDataAvailability("fallback");
        else setDataAvailability("upstream_error");
        if (String(payload.source || "").toLowerCase() === "demo") setActiveDataSource("demo");
        if (String(payload.source || "").toLowerCase() === "seed") setActiveDataSource("seed");
        setAvailabilityDetail(String(payload.reason || "Stream realtime degradado"));
        setStreamWarning(hasReason
          ? "La fuente en tiempo real informó una degradación; se conserva el último snapshot confirmado."
          : "El stream opera en modo degradado.");
        if (payload.availability !== "fallback") startPollingFallback();
      } catch {
        setStreamWarning("El stream opera en modo degradado.");
      }
    };

    source.addEventListener("snapshot", onSnapshot as EventListener);
    source.addEventListener("event", onEvent as EventListener);
    source.addEventListener("heartbeat", onHeartbeat as EventListener);
    source.addEventListener("warning", onWarning as EventListener);
    return () => {
      disposed = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.removeEventListener("event", onEvent as EventListener);
      source.removeEventListener("heartbeat", onHeartbeat as EventListener);
      source.removeEventListener("warning", onWarning as EventListener);
      source.close();
    };
  }, [canReadSensitiveEvents, initialAvailability, initialAvailabilityDetail, initialDataSource, initialEvents.length, refreshIncidents, streamSource, tenantScope, timeRange]);

  const tenantOptions = useMemo(
    () => [...new Set(events.map((event) => String(event.tenantSlug || "unknown").toLowerCase()))].filter(Boolean).sort(),
    [events],
  );

  const visibleEvents = useMemo(
    () => {
      const cutoff = Date.now() - timeRangeMs(timeRange);
      return (effectiveSelectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === effectiveSelectedTenant))
        .filter((event) => {
          const at = safeDate(event.occurredAt);
          return !at || at >= cutoff;
        });
    },
    [effectiveSelectedTenant, events, timeRange],
  );
  const commercialActivityEvents = useMemo(
    () => visibleEvents.filter(isCommercialActivitySignal),
    [visibleEvents],
  );
  const geoOpportunityEvents = useMemo(
    () => visibleEvents.filter(isGeoOpportunitySignal),
    [visibleEvents],
  );

  const consoleTimezone = useMemo(
    () => resolveConsoleTimezone(visibleEvents, effectiveSelectedTenant, tenantScope),
    [effectiveSelectedTenant, tenantScope, visibleEvents],
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
    const offerReady = buildMarketOpportunities(buildHotspots(visibleEvents), visibleEvents).filter((item) => item.geoCommercialSignals > 0).length;
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
      offerReady,
      productRecognizedRate: total ? (productRecognized / total) * 100 : 0,
      authenticationRate: total ? (authenticated / total) * 100 : 0,
      knownActorRate: total ? (knownActors / total) * 100 : 0,
      channelConsentRate: total ? (channelConsented / total) * 100 : 0,
      explicitRiskRate: total ? (risk / total) * 100 : 0,
      gpsCoverage: total ? (gps / total) * 100 : 0,
      commercialSignalRate: total ? (commercialSignals / total) * 100 : 0,
    };
  }, [commercialActivityEvents, geoOpportunityEvents, visibleEvents]);

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

  const hotspots = useMemo(() => buildHotspots(visibleEvents), [visibleEvents]);
  const marketOpportunities = useMemo(() => buildMarketOpportunities(hotspots, visibleEvents), [hotspots, visibleEvents]);
  const topOpportunity = marketOpportunities[0] || null;
  const commercialContext = useMemo(
    () => resolveCommercialContext(visibleEvents, tenantScope, effectiveSelectedTenant),
    [effectiveSelectedTenant, tenantScope, visibleEvents],
  );
  const latestEvent = visibleEvents[0] || null;
  const todayLabel = useMemo(() => formatDateInZone(Date.now(), consoleTimezone), [consoleTimezone]);
  const lastUpdateMs = safeDate(lastUpdateAt);
  const streamIsStale = Boolean(connected && streamConfirmed && lastUpdateMs && freshnessNow - lastUpdateMs > 20_000);
  const sourcePresentation = realtimeSourcePresentation(activeDataSource, dataAvailability, availabilityDetail);
  const streamHealth = pollingFallbackActive && dataAvailability === "ready" && streamConfirmed
    ? { label: "Actualizando por respaldo", detail: "El canal inmediato se está reconectando; los eventos persistidos se consultan cada 10 segundos.", dot: "bg-amber-300", badge: "border-amber-300/30 bg-amber-400/10 text-amber-100" }
    : streamWarning || dataAvailability !== "ready"
    ? { label: "Degradado", detail: streamWarning || sourcePresentation.detail, dot: "bg-amber-300", badge: "border-amber-300/30 bg-amber-400/10 text-amber-100" }
    : !connected
      ? connectionAttempted
        ? { label: "Reconectando", detail: "La conexión se interrumpió; EventSource reintentará automáticamente.", dot: "bg-amber-300", badge: "border-amber-300/30 bg-amber-400/10 text-amber-100" }
        : { label: "Conectando", detail: "Abriendo el canal de eventos y esperando su primera confirmación.", dot: "bg-cyan-300", badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" }
      : !streamConfirmed
        ? { label: "Sincronizando", detail: "Conexión abierta; esperando la primera confirmación de datos.", dot: "bg-cyan-300", badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" }
        : streamIsStale
          ? { label: "Desactualizado", detail: "No se recibió heartbeat ni snapshot en los últimos 20 segundos.", dot: "bg-rose-300", badge: "border-rose-300/30 bg-rose-400/10 text-rose-100" }
          : { label: activeDataSource === "demo" ? "En vivo - demo" : activeDataSource === "mixed" ? "En vivo - fuente mixta" : "En vivo - produccion", detail: `Stream confirmado. ${sourcePresentation.detail}`, dot: "bg-emerald-400", badge: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" };
  const streamDataUnconfirmed = Boolean(dataAvailability !== "ready" || !streamConfirmed || streamIsStale);

  const alerts = useMemo(() => {
    const rows: Array<{ id: string; tone: "red" | "amber" | "blue"; title: string; detail: string; time: string }> = [];
    if (metrics.explicitRiskRate > 10) {
      rows.push({ id: `risk-${hotspots[0]?.key || "operation"}`, tone: "red", title: `Riesgo elevado en ${hotspots[0]?.city || "la operación"}`, detail: `Riesgo explícito ${formatPercent(metrics.explicitRiskRate)}: solo replay, tamper o INVALID`, time: formatShortTimeInZone(Date.now(), consoleTimezone) });
    }
    if (metrics.gpsCoverage < 60 && metrics.total > 0) {
      rows.push({ id: `gps-${metrics.total}-${Math.round(metrics.gpsCoverage)}`, tone: "amber", title: "Cobertura GPS baja", detail: `Solo ${formatPercent(metrics.gpsCoverage)} de lecturas con GPS útil`, time: formatShortTimeInZone(Date.now(), consoleTimezone) });
    }
    visibleEvents.filter((event) => isRealtimeRisk(event.verdict, event.reason)).slice(0, 3).forEach((event, index) => {
      rows.push({ id: `exception-${String(event.eventId || event.uidMasked || "uid")}-${index}`, tone: "amber", title: `UID con excepción ${event.uidMasked}`, detail: `${event.city || "sin ciudad"} · ${deviceSummary(event)}`, time: timeAgo(event.occurredAt) });
    });
    if (metrics.unknown > 0) {
      rows.push({ id: `unknown-${metrics.unknown}`, tone: "blue", title: "Eventos sin clasificar", detail: `${metrics.unknown} eventos UNKNOWN, NOT_REGISTERED, NOT_ACTIVE o no reconocidos; no se cuentan como riesgo.`, time: formatShortTimeInZone(Date.now(), consoleTimezone) });
    }
    if (metrics.commercialSignals > 0) {
      rows.push({ id: `commercial-${String(latestEvent?.eventId || metrics.commercialSignals)}`, tone: "blue", title: "Actividad con señal comercial", detail: `${metrics.commercialSignals} interacciones tienen producto reconocido, actor asociado, tipo elegible y canal consentido; ${metrics.geoCommercialSignals} además tienen ubicación útil. No son destinatarios ni audiencia.`, time: timeAgo(latestEvent?.occurredAt) });
    }
    return rows.slice(0, 4);
  }, [consoleTimezone, hotspots, latestEvent, metrics, visibleEvents]);

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

  const rowsForOpportunity = (opportunity: MarketOpportunity) => {
    return visibleEvents.filter((event) => {
      const city = String(event.city || "Unknown");
      const country = String(event.country || "--");
      return city === opportunity.city && country === opportunity.country && isGeoOpportunitySignal(event);
    });
  };

  const handleCampaignExport = (opportunity: MarketOpportunity) => {
    const rows = rowsForOpportunity(opportunity);
    exportToCsv(
      `nexid-geo-opportunity-activity-${opportunity.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`,
      rows.map((event) => ({
        campaign: opportunity.campaignName,
        city: opportunity.city,
        country: opportunity.country,
        channel: opportunity.channel,
        offer: opportunity.offer,
        tenant: event.tenantSlug || "",
        uid: event.uidMasked,
        verdict: event.verdict,
        eventType: event.eventType,
        interactionClass: event.interactionClass,
        productRecognized: event.productIdentityRecognized,
        authenticationVerified: event.authenticationVerified,
        knownActor: event.knownActor,
        commercialConsent: event.commercialConsentGranted,
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
        { key: "uid", label: "UID producto" },
        { key: "verdict", label: "Veredicto" },
        { key: "eventType", label: "Tipo de evento" },
        { key: "interactionClass", label: "Clase de interacción" },
        { key: "productRecognized", label: "Producto reconocido" },
        { key: "authenticationVerified", label: "Autenticación verificada" },
        { key: "knownActor", label: "Actor conocido" },
        { key: "commercialConsent", label: "Consentimiento comercial asociado" },
        { key: "occurredAtTenant", label: "Fecha tenant" },
        { key: "timezone", label: "Zona horaria" },
        { key: "occurredAt", label: "Fecha UTC/origen" },
        { key: "product", label: "Producto" },
        { key: "device", label: "Dispositivo" },
        { key: "location", label: "Ubicacion" },
      ],
    );
    setCampaignDraft(`${opportunity.campaignName}: actividad geográfica ${opportunity.channel} exportada (${rows.length} interacciones; no destinatarios).`);
  };

  const openCampaignStudio = (opportunity: MarketOpportunity) => {
    const params = new URLSearchParams({
      city: opportunity.city,
      country: opportunity.country,
      channel: opportunity.channel,
      offer: opportunity.offer,
      activity_count: String(opportunity.geoCommercialSignals),
      audience_ready: "false",
      audience_source: "server_actor_scope_required",
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
    if (!streetViewTarget) return;
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewTarget.lat},${streetViewTarget.lng}`, "_blank", "noopener,noreferrer");
  };

  const railItems: CrmRailItem[] = [
    { icon: <Activity className="h-5 w-5" />, active: activeView === "overview", label: "Resumen operativo", short: "Vista", title: "Ver KPIs explicados, funnel post-tap y estado de la ventana activa.", action: () => selectActiveView("overview") },
    { icon: <ScanLine className="h-5 w-5" />, active: activeView === "physical-taps", label: "TAP físicos", short: "TAP", title: "Abrir evidencia NFC física, estados reportados, mapa e inbox del tenant.", action: () => selectActiveView("physical-taps") },
    { icon: <Globe className="h-5 w-5" />, active: false, label: "Mapa por capas", short: "Capas", title: "Centrar el mapa y conservar la capa seleccionada.", action: () => { setMapZoom(1); document.getElementById("live-tap-map")?.scrollIntoView({ behavior: "smooth", block: "start" }); } },
    { icon: <Megaphone className="h-5 w-5" />, active: false, label: "IA de cercanía", short: "IA", title: "Ver priorización comercial por zona basada en eventos visibles.", action: () => document.getElementById("commercial-ai-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }) },
    { icon: <Users className="h-5 w-5" />, active: false, label: "Clientes & campañas", short: "Clientes", title: "Abrir segmentos, beneficios, vouchers y campañas post-tap.", action: () => onSectionChange?.("loyalty") },
    ...(canReadSensitiveEvents ? [{ icon: <ShieldCheck className="h-5 w-5" />, active: false, label: "Riesgos", short: "Riesgo", title: "Abrir eventos para auditar replay, tamper, GPS bajo y dispositivos.", action: () => { window.location.href = "/events?filter=risk"; } }] : []),
    { icon: <BarChart3 className="h-5 w-5" />, active: false, label: "Exportar actividad", short: "CSV", title: "Exportar sólo interacciones con señal comercial; no exporta audiencia ni destinatarios.", action: handleExport, disabled: commercialActivityEvents.length === 0, disabledReason: exportDisabledReason },
    { icon: <Settings className="h-5 w-5" />, active: false, label: "Limpiar filtros", short: "Reset", title: "Restablecer tenant, densidad, zoom y capa base.", action: () => { setSelectedTenant(tenantSession ? lockedTenantScope : "all"); setMapView("heat"); setMapZoom(1); setBaseMap(preferredDashboardBaseMap()); } },
  ];

  return (
    <div className="nexid-crm-shell fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-[#030a16] text-slate-100 lg:overflow-hidden">
      <div className="nexid-crm-backdrop pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(14,165,233,.16),transparent_32%),linear-gradient(180deg,#05101f,#030713_55%,#030713)]" />
      <header data-testid="crm-responsive-header" className="relative z-[640] flex min-h-[70px] flex-wrap items-center gap-3 border-b border-cyan-200/10 bg-[#06101d]/90 px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,.04)] lg:h-[144px] lg:min-h-[144px] lg:px-4 lg:py-3 2xl:h-[70px] 2xl:min-h-[70px] 2xl:flex-nowrap 2xl:py-0">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-4 lg:gap-5 2xl:order-none 2xl:w-[440px] 2xl:flex-none">
          <div className="pr-4 text-[24px] font-black tracking-[-0.04em] text-white lg:pr-6 lg:text-[28px]">
            nex<span className="text-cyan-300">ID</span>
          </div>
          <div className="border-l border-white/10 pl-4 lg:pl-5">
            <p className="text-xs text-slate-400">Admin enterprise</p>
            <h1 className="text-[1.4rem] font-black leading-tight tracking-[-0.035em] text-white lg:text-[1.65rem]">CRM Semántica Operativa</h1>
          </div>
        </div>

        <nav className="order-3 grid min-h-12 w-full grid-cols-2 overflow-hidden rounded-2xl border border-white/8 bg-slate-950/45 text-xs font-bold text-slate-300 sm:grid-cols-4 sm:text-sm 2xl:order-none 2xl:mx-auto 2xl:w-[590px]">
          <button type="button" aria-label="Volver al mapa y CRM" title="Volver a métricas, mapa y funnel del CRM en vivo" onClick={() => selectActiveView("overview")} className={`flex min-h-12 items-center justify-center gap-2 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300 ${activeView === "overview" ? "border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200" : "hover:bg-white/5"}`}>
            <Activity className="h-4 w-4" /> CRM en vivo
          </button>
          <button type="button" aria-label="Abrir TAP físicos" title="Abrir evidencia NFC física, estados reportados, mapa e inbox del tenant" onClick={() => selectActiveView("physical-taps")} className={`flex min-h-12 items-center justify-center gap-2 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300 ${activeView === "physical-taps" ? "border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200" : "hover:bg-white/5"}`}>
            <ScanLine className="h-4 w-4" /> TAP físicos
          </button>
          <button type="button" title="Abrir operación NFC: lotes, tags, QA, anclaje y publicación" onClick={() => onSectionChange?.("infra")} className="flex min-h-12 items-center justify-center gap-2 px-2 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300">
            <Truck className="h-4 w-4" /> Operación NFC
          </button>
          <button type="button" title="Abrir segmentos, beneficios y campañas post-tap" onClick={() => onSectionChange?.("loyalty")} className="flex min-h-12 items-center justify-center gap-2 px-2 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300">
            <Users className="h-4 w-4" /> Clientes & campañas
          </button>
        </nav>

        <div className="order-2 ml-auto flex w-auto flex-wrap items-center justify-end gap-3 text-xs text-slate-300 lg:flex-nowrap 2xl:order-none 2xl:justify-start 2xl:gap-5">
          <span className="flex items-center gap-2" title={streamHealth.detail}><i className={`h-2 w-2 rounded-full ${streamHealth.dot}`} /> Stream: {streamHealth.label}</span>
          <span data-testid="crm-source-badge" className={`rounded-full border px-2.5 py-1 font-semibold ${sourcePresentation.badge}`} title={sourcePresentation.detail}>Fuente: {sourcePresentation.label}</span>
          <span className="hidden items-center gap-2 2xl:flex" title={`Horario operativo del tenant: ${consoleTimezone}`}><Clock className="h-4 w-4 text-slate-500" /> {clock}<span className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{consoleTimezoneLabel}</span></span>
          <span className="hidden items-center gap-2 2xl:flex"><CalendarDays className="h-4 w-4 text-slate-500" /> {todayLabel}</span>
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

      <aside className="absolute bottom-0 left-0 top-[70px] z-10 hidden w-24 flex-col items-center border-r border-cyan-200/10 bg-[#07111e]/92 py-4 lg:top-[144px] lg:flex 2xl:top-[70px]">
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
              <span className="pointer-events-none absolute left-14 top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-100 opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">
                {item.label}
              </span>
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
        <main data-testid="crm-physical-taps-view" className="relative z-10 min-h-[calc(100vh-70px)] overflow-visible px-3 py-3 pb-14 lg:ml-24 lg:h-[calc(100vh-176px)] lg:min-h-0 lg:overflow-y-auto lg:p-4 2xl:h-[calc(100vh-102px)] 2xl:p-5">
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
      <main className="relative z-10 flex min-h-[calc(100vh-70px)] flex-col gap-3 overflow-visible px-3 py-3 pb-14 lg:ml-24 lg:h-[calc(100vh-176px)] lg:flex-row lg:gap-3 lg:overflow-hidden lg:p-3 2xl:h-[calc(100vh-102px)] 2xl:gap-4 2xl:p-4">
        <section className="nexid-crm-kpi-column order-2 min-h-0 space-y-2 overflow-hidden lg:order-1 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 xl:w-96">
          <div className="flex items-start justify-between gap-3">
            <span>
              <h2 className="text-xl font-extrabold tracking-[-0.025em] text-white">Lectura operativa</h2>
              <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">Qué pasó, qué es confiable y qué se puede activar ahora.</p>
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-400" title={streamHealth.detail}><i className={`h-2 w-2 rounded-full ${streamHealth.dot}`} /> {streamHealth.label}</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricCard icon={<Radio className="h-5 w-5" />} label="Actividad total" value={formatNumber(metrics.total)} delta="stream" help="Todas las interacciones persistidas para el tenant y la ventana activos." tone="cyan" data={velocitySeries} />
            <MetricCard icon={<BadgeCheck className="h-5 w-5" />} label="Producto reconocido" value={formatPercent(metrics.productRecognizedRate)} delta={`${metrics.productRecognized} interacciones`} help="Producto, lote o unidad resuelto contra registros NexID. No identifica a una persona ni equivale a autenticación física." tone="blue" data={velocitySeries} dataKey="productRecognized" />
            <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Autenticación verificada" value={formatPercent(metrics.authenticationRate)} delta={`${metrics.authenticated} eventos`} help="Sólo mensajes SUN con verdict válido, CMAC correcto y UID allowlisted." tone="green" data={velocitySeries} dataKey="authenticated" />
            <MetricCard icon={<Users className="h-5 w-5" />} label="Actor conocido" value={formatPercent(metrics.knownActorRate)} delta={`${metrics.knownActors} interacciones`} help="Interacciones vinculadas a un consumer/member pseudónimo persistido. No cuenta UIDs como personas ni expone el identificador del actor." tone="blue" data={velocitySeries} dataKey="knownActors" />
            <MetricCard icon={<Megaphone className="h-5 w-5" />} label="Consentimiento por canal" value={formatPercent(metrics.channelConsentRate)} delta={`${metrics.channelConsented} interacciones`} help="Actor conocido con consentimiento vigente para WhatsApp, teléfono o email. Consentimientos genéricos no habilitan contacto." tone="green" data={velocitySeries} dataKey="consented" />
            <MetricCard icon={<Target className="h-5 w-5" />} label="Señales comerciales" value={formatNumber(metrics.commercialSignals)} delta={`${metrics.geoCommercialSignals} con zona útil`} help="Actividad event-level: producto reconocido, actor asociado, tipo elegible y canal consentido. No representa audiencia, contactos ni destinatarios; éstos se resuelven server-side con permisos." tone="blue" data={velocitySeries} dataKey="consented" />
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
                <p className="text-[11px] text-slate-500">De actividad registrada a acción comercial consentida.</p>
              </span>
              <span className="text-xs text-slate-500">{metrics.commercialSignals ? `${metrics.commercialSignals} señales de actividad` : "sin señales listas aún"}</span>
            </div>
            <div className="mt-3 flex items-start gap-1 overflow-x-auto pb-1">
              <FunnelNode icon={<MousePointerClick className="h-5 w-5" />} label="Actividad" value={metrics.total} pct={100} tone="#22d3ee" detail="eventos persistidos" pctLabel="base" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<BadgeCheck className="h-5 w-5" />} label="Producto" value={metrics.productRecognized} pct={metrics.productRecognizedRate} tone="#38bdf8" detail="lote o unidad resuelto" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Users className="h-5 w-5" />} label="Actor" value={metrics.knownActors} pct={metrics.knownActorRate} tone="#22c55e" detail="pseudónimo persistido" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Megaphone className="h-5 w-5" />} label="Señal comercial" value={metrics.commercialSignals} pct={metrics.commercialSignalRate} tone="#a855f7" detail="actividad, no audiencia" />
              <span className="mt-4 text-xl text-slate-600">-&gt;</span>
              <FunnelNode icon={<Tags className="h-5 w-5" />} label="Campaña" value={metrics.offerReady} pct={metrics.offerReady ? 100 : 0} tone="#38bdf8" detail="zonas con señal" pctLabel={metrics.offerReady ? "zonas listas" : "sin zona"} />
            </div>
          </div>
        </section>

        <section className="nexid-crm-workspace order-1 flex min-h-0 flex-col gap-4 lg:order-2 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <div className="nexid-crm-map-stack flex min-h-0 shrink-0 flex-col">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold tracking-[-0.025em] text-white">Mapa de eventos por capas</h2>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${streamHealth.badge}`} title={streamHealth.detail}>{streamHealth.label}</span>
              </div>
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <select size={1} aria-label="Filtrar lecturas por tenant" title={tenantSession ? "Alcance fijado por la sesión tenant" : "Filtrar lecturas por tenant"} value={effectiveSelectedTenant} disabled={tenantSession} onChange={(event) => setSelectedTenant(event.target.value)} className="col-span-2 h-12 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold text-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:text-slate-400 sm:col-span-1 sm:w-auto sm:min-w-[160px]">
                  {tenantSession ? (
                    <option value={lockedTenantScope}>{lockedTenantScope ? tenantDisplayName(lockedTenantScope) : "Tenant no disponible"}</option>
                  ) : (
                    <>
                      <option value="all">Todos los tenants</option>
                      {tenantOptions.map((tenant) => <option key={tenant} value={tenant}>{tenantDisplayName(tenant)}</option>)}
                    </>
                  )}
                </select>
                <select size={1} aria-label="Cambiar ventana temporal del mapa y KPIs" title="Cambiar ventana temporal del mapa y KPIs" value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRange)} className="h-12 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold text-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20">
                  {TIME_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select size={1} aria-label="Cambiar capa base del mapa" title="Cambiar capa base del mapa" value={baseMap} onChange={(event) => setBaseMap(event.target.value as BaseMapLayer)} className="h-12 min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-sm font-semibold text-white focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 2xl:hidden">
                  {BASEMAP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" title={commercialActivityEvents.length === 0 ? exportDisabledReason : "Exportar actividad con señal comercial a CSV"} onClick={handleExport} disabled={commercialActivityEvents.length === 0} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-4 text-sm font-bold text-white transition hover:border-cyan-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"><Download className="h-4 w-4" /> {commercialActivityEvents.length === 0 ? "Sin señales" : "Exportar"}</button>
              </div>
            </div>

            {(streamDataUnconfirmed || !visibleEvents.length) ? (
              <div className="mb-3">
                <EnterpriseOpsState
                  compact
                  variant={streamDataUnconfirmed ? "warning" : "empty"}
                  title={streamDataUnconfirmed ? "Actividad todavía no confirmada" : "Sin eventos en los filtros activos"}
                  description={streamDataUnconfirmed
                    ? `${streamHealth.detail} Los indicadores visibles pueden provenir del último snapshot confirmado y no representan un cero operativo.`
                    : "El stream respondió correctamente, pero no hay lecturas para este tenant y esta ventana temporal."}
                  checklist={streamDataUnconfirmed ? ["Esperar reconexión o revisar la fuente antes de decidir", `Última actualización: ${timeAgo(lastUpdateAt)}`] : ["Ampliar el rango temporal", "Cambiar tenant o realizar un tap NFC de control"]}
                  testId="crm-realtime-data-state"
                />
              </div>
            ) : null}

            <div id="live-tap-map" ref={mapPanelRef} data-map-fullscreen={isMapFullscreen ? "true" : "false"} className={`nexid-crm-map-panel relative shrink-0 overflow-hidden border border-cyan-100/10 bg-[#061426] shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ${isMapFullscreen ? "fixed inset-0 z-[260] h-screen min-h-screen rounded-none border-cyan-300/25 bg-[#020713] p-2" : "rounded-2xl"}`}>
              <div role="group" aria-label="Acciones del mapa" className="nexid-crm-map-actions absolute left-3 top-3 z-30 grid gap-2 sm:left-4 sm:top-4">
                <button type="button" title="Acercar mapa sin agrandar artificialmente los eventos" onClick={() => setMapZoom((value) => Math.min(1.22, Number((value + 0.08).toFixed(2))))} className="nexid-crm-map-control grid h-12 w-12 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-xl font-bold text-white shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Acercar mapa">+</button>
                <button type="button" title="Alejar mapa para ver más territorio" onClick={() => setMapZoom((value) => Math.max(0.9, Number((value - 0.08).toFixed(2))))} className="nexid-crm-map-control grid h-12 w-12 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-xl font-bold text-white shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Alejar mapa">−</button>
                <button type="button" title="Restablecer densidad, zoom y capa base según el tema activo" onClick={() => { setMapView("heat"); setMapZoom(1); setBaseMap(preferredDashboardBaseMap()); }} className="nexid-crm-map-control grid h-12 w-12 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-slate-200 shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label="Restablecer mapa"><RotateCcw className="h-5 w-5" /></button>
                <button type="button" title={isMapFullscreen ? "Salir de pantalla completa" : "Pantalla completa real para monitor de control"} onClick={() => void toggleMapFullscreen()} className="nexid-crm-map-control grid h-12 w-12 place-items-center rounded-xl border border-white/12 bg-slate-950/78 text-slate-200 shadow-lg transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" aria-label={isMapFullscreen ? "Salir de pantalla completa" : "Abrir pantalla completa"}><Expand className="h-5 w-5" /></button>
              </div>

              <div className="nexid-crm-map-toolbar absolute left-[4.5rem] right-3 top-3 z-30 flex min-w-0 items-start justify-end gap-2 sm:left-[5rem] sm:top-4 lg:left-auto lg:right-5">
                <div role="group" aria-label="Visualización de eventos" className="nexid-crm-map-view-controls flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto pb-1 lg:flex-none lg:overflow-visible lg:pb-0">
                  {MAP_VIEW_OPTIONS.map((option) => (
                    <button key={option.value} type="button" aria-pressed={mapView === option.value} title={option.title} onClick={() => setMapView(option.value)} className={`nexid-crm-map-view-button flex h-12 min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold shadow-lg transition sm:min-w-0 sm:flex-none sm:gap-2 sm:px-3 sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${mapView === option.value ? "border-cyan-300 bg-cyan-400/16 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,.2)]" : "border-white/10 bg-slate-950/72 text-slate-300 hover:border-cyan-300/35 hover:text-white"}`}>
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
                      onClick={() => setBaseMap(option.value)}
                      className={`min-h-11 rounded-lg px-3 text-[11px] font-black uppercase tracking-[0.06em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${baseMap === option.value ? "bg-cyan-300 text-slate-950 shadow-[0_6px_18px_rgba(34,211,238,.2)]" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" title={streetViewTarget ? "Abrir Google Maps Street View en una coordenada reportada de la ventana actual" : streetViewDisabledReason} onClick={openStreetView} disabled={!streetViewTarget} className="nexid-crm-map-street hidden h-12 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/72 px-3 text-sm font-bold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-600 2xl:flex"><Globe className="h-4 w-4" /> {streetViewTarget ? "Street" : "Sin GPS"}</button>
              </div>

              <div className="nexid-crm-map-legend absolute bottom-[264px] left-3 z-20 rounded-xl border border-white/10 bg-slate-950/82 p-3.5 text-xs text-slate-200 shadow-xl backdrop-blur sm:left-4 2xl:bottom-20">
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-100">Capa {MAP_VIEW_OPTIONS.find((option) => option.value === mapView)?.label}</p>
                <p className="mb-2 max-w-[15rem] text-xs font-medium leading-[1.15rem] text-slate-400">{MAP_VIEW_OPTIONS.find((option) => option.value === mapView)?.description}</p>
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
              </div>

              <div className={`nexid-crm-map-canvas-region ${isMapFullscreen ? "h-full" : "h-[460px] sm:h-[520px] 2xl:h-[560px]"} w-full p-3 pt-[76px] 2xl:pr-[300px]`}>
                <RealtimeMapLibreMap hotspots={hotspots} events={visibleEvents} mapView={mapView} mode={mode} zoom={mapZoom} baseMap={baseMap} />
              </div>

              <div className="nexid-crm-events-rail relative z-20 m-3 mt-0 max-h-[250px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/78 p-3.5 shadow-2xl backdrop-blur 2xl:absolute 2xl:bottom-4 2xl:right-4 2xl:top-[76px] 2xl:m-0 2xl:w-[282px] 2xl:max-h-none">
                <p className="text-base font-extrabold tracking-[-0.015em] text-white">Últimos eventos visibles</p>
                <div className="mt-3 space-y-2">
                  {visibleEvents.slice(0, 4).map((event) => {
                    const authenticated = event.authenticationVerified === true;
                    const recognized = event.productIdentityRecognized === true;
                    const risk = isRealtimeRisk(event.verdict, event.reason);
                    const linkedIncident = incidentsByEventId[String(event.eventId)] || null;
                    return (
                      <button type="button" onClick={() => setSelectedEvent(event)} key={String(event.eventId || `${event.uidMasked}-${event.occurredAt}`)} className="min-h-[5.25rem] w-full rounded-xl border border-white/8 bg-slate-900/70 p-3 text-left transition hover:border-cyan-300/35 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" data-testid="open-event-incident-drawer">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500">{formatTimeInZone(event.occurredAt || Date.now(), consoleTimezone)}</p>
                          <span className={`rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold ${linkedIncident ? "bg-cyan-400/10 text-cyan-200" : authenticated ? "bg-emerald-400/10 text-emerald-300" : risk ? "bg-rose-400/10 text-rose-300" : "bg-sky-400/10 text-sky-300"}`}>{linkedIncident ? `Incidente · ${linkedIncident.status}` : authenticated ? "Autenticación verificada" : recognized ? "Producto reconocido" : risk ? "Riesgo" : "Actividad"}</span>
                        </div>
                        <p className="mt-1.5 text-[15px] font-black tracking-[-0.015em] text-white">UID: {event.uidMasked}</p>
                        <p className="text-xs text-slate-400">{deviceSummary(event)}</p>
                        <p className="mt-1.5 text-[11px] font-bold text-cyan-300">Abrir evidencia y expediente →</p>
                      </button>
                    );
                  })}
                </div>
                {canReadSensitiveEvents ? (
                  <button type="button" title="Abrir la auditoría completa de eventos" onClick={() => { window.location.href = "/events"; }} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 text-sm font-bold text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Ver todos los eventos</button>
                ) : (
                  <span aria-disabled="true" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/45 px-3 text-center text-sm font-semibold text-slate-500" data-testid="events-audit-unavailable">Auditoría de eventos no habilitada</span>
                )}
              </div>
            </div>
          </div>

          <div className="nexid-crm-insight-grid grid min-h-0 shrink-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div id="commercial-ai-panel" className="nexid-crm-commercial-panel rounded-xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_36%),linear-gradient(180deg,rgba(10,24,43,.98),rgba(4,10,20,.95))] p-3 2xl:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-white">
                  <Megaphone className="h-4 w-4 text-cyan-300" />
                  <span className="truncate">{commercialContext.panelTitle}</span>
                  <span className="hidden text-sm font-normal text-slate-400 sm:inline">({commercialContext.panelSubtitle})</span>
                </p>
                {canOpenCampaigns ? (
                  <button type="button" title="Abrir Clientes & campañas con estas señales" onClick={() => { window.location.href = "/loyalty/campaigns"; }} className="shrink-0 text-sm font-semibold text-cyan-300">Abrir campañas</button>
                ) : (
                  <span aria-disabled="true" className="shrink-0 text-sm font-semibold text-slate-500" data-testid="campaigns-unavailable">Campañas no habilitadas</span>
                )}
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
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2" title="Prioridad heurística calculada con autenticación, consentimiento, GPS, volumen y riesgo."><b className="block text-base text-white">{topOpportunity.score}</b> prioridad</span>
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2" title="Actividad geográfica agregada; no es audiencia ni lista de destinatarios."><b className="block text-base text-white">{topOpportunity.geoCommercialSignals}</b> señales geográficas</span>
                    <span className="rounded-lg border border-white/8 bg-slate-950/55 p-2"><b className="block text-base text-white">{formatPercent(topOpportunity.authenticationRate)}</b> autenticado</span>
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
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1" title="Actividad agregada; la audiencia debe resolverse server-side con permisos."><b className="block text-sm text-white">{opportunity.geoCommercialSignals}</b> señales geográficas</span>
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block truncate text-sm text-white">{opportunity.channel}</b> canal</span>
                      <span className="rounded-md border border-white/8 bg-slate-900/70 px-2 py-1"><b className="block truncate text-sm text-emerald-200">{opportunity.offer}</b> beneficio</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" title={`Exportar actividad geográfica de ${opportunity.city} con canal consentido y beneficio sugerido`} onClick={() => handleCampaignExport(opportunity)} className="rounded-md border border-white/10 bg-slate-950/60 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:border-cyan-300/50">
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
            <div className="nexid-crm-alerts-panel rounded-xl border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
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
      )}

      {selectedEvent ? (
        <IncidentEventDrawer
          key={`${selectedEvent.tenantSlug || "global"}:${selectedEvent.eventId}`}
          event={selectedEvent}
          incident={incidentsByEventId[String(selectedEvent.eventId)] || null}
          incidentAvailability={incidentAvailability}
          canRead={canReadIncidents}
          canWrite={canWriteIncidents}
          onClose={() => setSelectedEvent(null)}
          onIncident={handleIncident}
        />
      ) : null}

      <footer className="fixed bottom-0 left-0 right-0 z-20 flex h-9 items-center justify-between gap-3 border-t border-white/8 bg-[#06101d]/95 px-3 text-[11px] text-slate-400 lg:absolute lg:h-8 lg:px-8 lg:text-xs">
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
