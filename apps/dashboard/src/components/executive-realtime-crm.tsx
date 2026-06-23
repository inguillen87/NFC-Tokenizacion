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
  Globe,
  Layers,
  LogOut,
  MapPin,
  MousePointerClick,
  Radio,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Target,
  Truck,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { exportToCsv } from "../lib/export-utils";
import { mergeRealtimeEvents, sortRealtimeEvents, type TenantTapRealtimeEvent } from "../lib/realtime-feed";

type MapMode = "tenant" | "global";
type CrmSection = "summary" | "infra" | "loyalty";
type MapView = "heat" | "points" | "nearby";

const CITY_HEAT_POSITIONS: Array<{ match: RegExp; country: string; x: number; y: number }> = [
  { match: /mendoza|valle\s+de\s+uco|tunuyan|tupungato|lujan/i, country: "AR", x: 25, y: 42 },
  { match: /cordoba/i, country: "AR", x: 42, y: 29 },
  { match: /rosario/i, country: "AR", x: 54, y: 37 },
  { match: /buenos\s*aires|caba|san\s*martin/i, country: "AR", x: 59, y: 50 },
  { match: /mar\s*del\s*plata/i, country: "AR", x: 64, y: 58 },
  { match: /neuquen/i, country: "AR", x: 32, y: 66 },
];

const tooltipStyle = {
  backgroundColor: "rgba(5, 12, 25, 0.96)",
  border: "1px solid rgba(34, 211, 238, 0.2)",
  borderRadius: "10px",
  color: "#f8fafc",
  fontSize: "12px",
};

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

function cityHeatPosition(city: string, country: string, index: number) {
  const normalizedCountry = country.toUpperCase();
  const match = CITY_HEAT_POSITIONS.find((item) => item.country === normalizedCountry && item.match.test(city));
  if (match) return { x: match.x, y: match.y };
  return {
    x: 38 + ((index * 11) % 34),
    y: 28 + ((index * 17) % 42),
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function jitteredPosition(city: string, country: string, seed: string, index: number) {
  const base = cityHeatPosition(city, country, index);
  const hash = hashString(seed || `${city}-${country}-${index}`);
  const spread = 3.2;
  return {
    x: Math.max(9, Math.min(88, base.x + (((hash % 100) / 100) - 0.5) * spread)),
    y: Math.max(12, Math.min(86, base.y + ((((hash >> 8) % 100) / 100) - 0.5) * spread)),
  };
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

function TapMapCanvas({
  hotspots,
  events,
  mapView,
  mode,
  zoom,
}: {
  hotspots: ReturnType<typeof buildHotspots>;
  events: TenantTapRealtimeEvent[];
  mapView: MapView;
  mode: MapMode;
  zoom: number;
}) {
  const maxTaps = Math.max(1, ...hotspots.map((item) => item.taps));
  const hotspotNodes = hotspots.map((hotspot, index) => {
    const pos = cityHeatPosition(hotspot.city, hotspot.country, index);
    const intensity = hotspot.taps / maxTaps;
    const riskRatio = hotspot.taps ? hotspot.risk / hotspot.taps : 0;
    return {
      ...hotspot,
      ...pos,
      pointSize: Math.min(10, 4 + Math.sqrt(hotspot.taps) * 1.15),
      heatSize: Math.min(92, 38 + intensity * 36 + Math.log1p(hotspot.taps) * 8),
      ringSize: Math.min(76, 38 + intensity * 28),
      riskRatio,
    };
  });

  const tapNodes = events.slice(0, 90).map((event, index) => {
    const city = String(event.city || "Unknown");
    const country = String(event.country || "--");
    const pos = jitteredPosition(city, country, String(event.eventId || event.uidMasked || event.occurredAt), index);
    const risk = String(event.verdict || "").toLowerCase() !== "valid";
    return { ...pos, risk, id: String(event.eventId || `${event.uidMasked}-${event.occurredAt}-${index}`), fresh: index < 8 };
  });

  const routeNodes = hotspotNodes.slice(0, 4).flatMap((node, index, rows) => {
    const next = rows[index + 1];
    return next ? [{ id: `${node.key}-${next.key}`, from: node, to: next }] : [];
  });

  return (
    <div className="relative h-full min-h-[300px] overflow-hidden rounded-xl border border-white/8 bg-[#061322] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.045)_1px,transparent_1px),radial-gradient(circle_at_42%_30%,rgba(34,211,238,.13),transparent_22%),radial-gradient(circle_at_58%_52%,rgba(20,184,166,.12),transparent_26%)] bg-[length:64px_64px,64px_64px,auto,auto]" />
      <div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `scale(${zoom})`, transformOrigin: "52% 48%" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-90" aria-hidden="true">
        <defs>
          <linearGradient id="execLand" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(23,37,84,.58)" />
            <stop offset="100%" stopColor="rgba(15,23,42,.24)" />
          </linearGradient>
          <filter id="execMapGlow">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <rect width="100" height="100" fill="rgba(2,6,23,.28)" />
        <path d="M17 0H100V100H20C23 89 29 79 30 68C31 55 22 45 25 34C28 23 38 16 41 4L17 0Z" fill="url(#execLand)" stroke="rgba(148,163,184,.16)" strokeWidth="0.25" />
        <path d="M29 2C31 15 28 25 29 37C30 51 38 61 36 76C35 86 30 94 27 100" fill="none" stroke="rgba(125,211,252,.14)" strokeWidth="0.8" />
        <path d="M55 20C62 25 69 31 76 34M58 50C67 49 76 50 84 55M47 64C54 70 61 75 68 82" fill="none" stroke="rgba(148,163,184,.1)" strokeWidth="0.35" strokeDasharray="1.4 1.4" />
        {routeNodes.map((route) => (
          <path
            key={route.id}
            d={`M ${route.from.x} ${route.from.y} Q ${(route.from.x + route.to.x) / 2} ${Math.min(route.from.y, route.to.y) - 8} ${route.to.x} ${route.to.y}`}
            fill="none"
            stroke={route.from.riskRatio > 0.1 || route.to.riskRatio > 0.1 ? "rgba(251,191,36,.72)" : "rgba(34,211,238,.56)"}
            strokeDasharray="1.6 1.4"
            strokeWidth="0.55"
          />
        ))}
      </svg>

      <div className="absolute left-[18%] top-[18%] text-[11px] text-slate-400">Mendoza</div>
      <div className="absolute left-[39%] top-[23%] text-[11px] text-slate-300">Córdoba</div>
      <div className="absolute left-[52%] top-[31%] text-[11px] text-slate-300">Rosario</div>
      <div className="absolute left-[58%] top-[47%] text-[11px] text-slate-300">Buenos Aires</div>
      <div className="absolute left-[66%] top-[57%] text-[10px] text-slate-500">Mar del Plata</div>

      {mapView === "heat" && hotspotNodes.map((spot) => {
        const core = spot.riskRatio > 0.18 ? "rgba(239,68,68,.72)" : spot.taps >= maxTaps ? "rgba(250,204,21,.76)" : "rgba(34,197,94,.58)";
        const mid = spot.riskRatio > 0.18 ? "rgba(250,204,21,.48)" : "rgba(34,211,238,.32)";
        return (
          <div
            key={`heat-${spot.key}`}
            className="pointer-events-none absolute rounded-full mix-blend-screen"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.heatSize}px`,
              height: `${spot.heatSize}px`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${core} 0%, ${core} 12%, ${mid} 42%, rgba(34,211,238,0) 72%)`,
              opacity: 0.78,
            }}
          />
        );
      })}

      {mapView === "nearby" && hotspotNodes.map((spot) => (
        <div
          key={`nearby-${spot.key}`}
          className="pointer-events-none absolute rounded-full border border-cyan-200/55 bg-cyan-300/5 shadow-[0_0_24px_rgba(34,211,238,.18)]"
          style={{
            left: `${spot.x}%`,
            top: `${spot.y}%`,
            width: `${spot.ringSize}px`,
            height: `${spot.ringSize}px`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {tapNodes.map((tap) => (
        <span
          key={tap.id}
          className={`absolute rounded-full ${tap.risk ? "bg-rose-300 shadow-[0_0_10px_rgba(251,113,133,.65)]" : "bg-cyan-200 shadow-[0_0_8px_rgba(34,211,238,.55)]"} ${tap.fresh ? "ring-2 ring-white/20" : ""}`}
          style={{
            left: `${tap.x}%`,
            top: `${tap.y}%`,
            width: tap.fresh ? 5 : 3,
            height: tap.fresh ? 5 : 3,
            transform: "translate(-50%, -50%)",
            opacity: tap.fresh ? 0.95 : 0.62,
          }}
        />
      ))}

      {hotspotNodes.map((spot) => (
        <div key={`point-${spot.key}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
          <span
            className={`grid place-items-center rounded-full border-2 ${spot.riskRatio > 0.18 ? "border-rose-200 bg-rose-400" : "border-white/80 bg-cyan-300"} shadow-[0_0_16px_rgba(34,211,238,.45)]`}
            style={{ width: `${spot.pointSize + 7}px`, height: `${spot.pointSize + 7}px` }}
          >
            <i className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <div className="mt-1 rounded-md border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
            {spot.city} · {spot.taps}
          </div>
        </div>
      ))}
      </div>

      <div className="absolute bottom-3 left-3 rounded-lg border border-white/8 bg-slate-950/72 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <b className="text-cyan-200">{events.length}</b> taps visibles · {hotspots.length} hotspots · zoom {Math.round(zoom * 100)}% · {mode === "tenant" ? "scope tenant" : "scope global"}
      </div>
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
  const [mapZoom, setMapZoom] = useState(1);
  const [clock, setClock] = useState("");
  const lastEventIdRef = useRef("");

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString("es-AR")), 1000);
    setClock(new Date().toLocaleTimeString("es-AR"));
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const streamUrl = new URL("/api/admin/events/stream", window.location.origin);
    streamUrl.searchParams.set("limit", "50");
    streamUrl.searchParams.set("range", "24h");
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
  }, [tenantScope]);

  const tenantOptions = useMemo(
    () => [...new Set(events.map((event) => String(event.tenantSlug || "unknown").toLowerCase()))].filter(Boolean).sort(),
    [events],
  );

  const visibleEvents = useMemo(
    () => selectedTenant === "all" ? events : events.filter((event) => String(event.tenantSlug || "unknown").toLowerCase() === selectedTenant),
    [events, selectedTenant],
  );

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
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#030a16] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_10%,rgba(14,165,233,.16),transparent_32%),linear-gradient(180deg,#05101f,#030713_55%,#030713)]" />
      <header className="relative z-10 flex h-[70px] items-center border-b border-cyan-200/10 bg-[#06101d]/90 px-4 shadow-[0_1px_0_rgba(255,255,255,.04)]">
        <div className="flex w-[510px] items-center gap-5">
          <div className="pr-6 text-[28px] font-black tracking-[-0.04em] text-white">
            nex<span className="text-cyan-300">ID</span>
          </div>
          <div className="border-l border-white/10 pl-5">
            <p className="text-xs text-slate-400">Centro de Control</p>
            <h1 className="text-2xl font-black tracking-[-0.03em] text-white">CRM realtime</h1>
          </div>
        </div>

        <nav className="mx-auto grid h-12 w-[470px] grid-cols-3 overflow-hidden rounded-xl border border-white/8 bg-slate-950/45 text-sm font-semibold text-slate-300">
          <button type="button" onClick={() => onSectionChange?.("summary")} className="flex items-center justify-center gap-2 border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200">
            <Activity className="h-4 w-4" /> Realtime CRM
          </button>
          <button type="button" onClick={() => onSectionChange?.("infra")} className="flex items-center justify-center gap-2 hover:bg-white/5">
            <Truck className="h-4 w-4" /> Rollout
          </button>
          <button type="button" onClick={() => onSectionChange?.("loyalty")} className="flex items-center justify-center gap-2 hover:bg-white/5">
            <Users className="h-4 w-4" /> Customers
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-5 text-xs text-slate-300">
          <span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> Sistema operativo</span>
          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-500" /> {clock}</span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-500" /> {todayLabel}</span>
          <button type="button" className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-950/55 px-3 py-2 text-left" onClick={() => setSelectedTenant(tenantScope || "all")}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">TA</span>
            <span><b className="block text-white">Tenant Admin</b>{selectedTenant === "all" ? tenantScope || "demo.bodega" : selectedTenant}</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>

      <aside className="absolute bottom-0 left-0 top-[70px] z-10 flex w-20 flex-col items-center border-r border-cyan-200/10 bg-[#07111e]/92 py-4">
        <div className="space-y-4">
          {railItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              onClick={item.action}
              className={`grid h-12 w-12 place-items-center rounded-xl transition ${item.active ? "bg-cyan-400/16 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,.18)]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { window.location.href = "/logout"; }} className="mt-auto grid h-10 w-10 place-items-center rounded-lg border border-white/8 text-slate-500 hover:text-white" aria-label="Salir">
          <LogOut className="h-5 w-5" />
        </button>
      </aside>

      <main className="relative z-10 ml-20 grid h-[calc(100vh-102px)] grid-cols-[440px_minmax(0,1fr)] gap-5 overflow-hidden p-5">
        <section className="min-h-0 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Visión ejecutiva en vivo</h2>
            <span className="flex items-center gap-2 text-xs text-slate-400"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> {connected ? "En vivo" : "Sincronizando"}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <button type="button" onClick={() => setMapView("heat")} className="rounded-lg border border-white/8 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">Últimas 24h</button>
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

        <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_260px] gap-4">
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Mapa vivo de taps</h2>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">● En vivo</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={selectedTenant} onChange={(event) => setSelectedTenant(event.target.value)} className="h-9 rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-white">
                  <option value="all">Todos los tenants</option>
                  {tenantOptions.map((tenant) => <option key={tenant} value={tenant}>{tenant}</option>)}
                </select>
                <button type="button" onClick={() => setMapView("heat")} className="h-9 rounded-lg border border-slate-700 bg-slate-950/80 px-4 text-sm text-white">Últimas 24h</button>
                <button type="button" onClick={handleExport} className="flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-4 text-sm text-white hover:border-cyan-300/50"><Download className="h-4 w-4" /> Exportar</button>
              </div>
            </div>

            <div className="relative min-h-0 overflow-hidden rounded-xl border border-cyan-100/10 bg-[#061426] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
              <div className="absolute left-4 top-4 z-20 grid gap-2">
                <button type="button" onClick={() => setMapZoom((value) => Math.min(1.22, Number((value + 0.08).toFixed(2))))} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-white" aria-label="Acercar mapa">+</button>
                <button type="button" onClick={() => setMapZoom((value) => Math.max(0.9, Number((value - 0.08).toFixed(2))))} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-white" aria-label="Alejar mapa">−</button>
                <button type="button" onClick={() => setMapView("nearby")} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-cyan-200"><Crosshair className="h-4 w-4" /></button>
                <button type="button" onClick={() => setMapView("points")} className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-slate-950/70 text-cyan-200"><Layers className="h-4 w-4" /></button>
              </div>

              <div className="absolute right-5 top-4 z-30 flex items-center gap-2">
                {[
                  ["heat", <Activity key="heat" className="h-4 w-4" />, "Calor"],
                  ["points", <MapPin key="points" className="h-4 w-4" />, "Puntos"],
                  ["nearby", <Crosshair key="nearby" className="h-4 w-4" />, "Cercanías"],
                ].map(([key, icon, label]) => (
                  <button key={String(key)} type="button" onClick={() => setMapView(key as MapView)} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${mapView === key ? "border-cyan-300 bg-cyan-400/12 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.22)]" : "border-white/10 bg-slate-950/65 text-slate-300"}`}>
                    {icon}{label}
                  </button>
                ))}
                <button type="button" onClick={() => { setMapView("heat"); setMapZoom(1); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/65 text-slate-300" aria-label="Restablecer mapa"><Settings className="h-4 w-4" /></button>
                <button type="button" onClick={() => setMapZoom((value) => value < 1.12 ? 1.12 : 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/65 text-slate-300" aria-label="Alternar ampliación del mapa"><Expand className="h-4 w-4" /></button>
              </div>

              <div className="absolute bottom-20 left-4 z-20 rounded-lg border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-200 shadow-xl">
                {[
                  ["Muy alto", "bg-red-500"],
                  ["Alto", "bg-amber-400"],
                  ["Medio", "bg-lime-400"],
                  ["Bajo", "bg-sky-400"],
                ].map(([label, color]) => (
                  <p key={label} className="mt-1 flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}</p>
                ))}
              </div>

              <div className="h-full w-full p-3 pr-[300px]">
                <TapMapCanvas hotspots={hotspots} events={visibleEvents} mapView={mapView} mode={mode} zoom={mapZoom} />
              </div>

              <div className="absolute bottom-4 right-4 top-[76px] z-20 w-[270px] rounded-xl border border-white/10 bg-slate-950/72 p-3 shadow-2xl backdrop-blur">
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
                <button type="button" onClick={() => { window.location.href = "/events"; }} className="mt-3 text-sm font-semibold text-cyan-300">Ver todos los eventos</button>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_392px] gap-4">
            <div className="rounded-xl border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-white">Hotspots accionables <span className="text-sm font-normal text-slate-400">(top ciudades)</span></p>
                <button type="button" onClick={() => { window.location.href = "/analytics"; }} className="text-sm font-semibold text-cyan-300">Ver todas las ciudades</button>
              </div>
              <div className="overflow-hidden rounded-lg border border-white/8">
                <div className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr_.7fr_.9fr] bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400">
                  <span>Ciudad</span><span>Taps (24h)</span><span>Tasa válida</span><span>Último UID</span><span>Riesgo</span><span>Acción</span>
                </div>
                {hotspots.map((hotspot) => {
                  const validRate = hotspot.taps ? (hotspot.valid / hotspot.taps) * 100 : 0;
                  const riskRate = hotspot.taps ? (hotspot.risk / hotspot.taps) * 100 : 0;
                  const action = riskRate > 10 || validRate < 70 ? "Revisar riesgo" : "Impulsar oferta";
                  return (
                    <div key={hotspot.key} className="grid grid-cols-[1.2fr_.7fr_.7fr_.8fr_.7fr_.9fr] border-t border-white/8 px-3 py-2 text-sm">
                      <b className="truncate text-white">{hotspot.city}, {hotspot.country}</b>
                      <span>{hotspot.taps}</span>
                      <span className="font-semibold text-emerald-300">{formatPercent(validRate)}</span>
                      <span className="truncate text-slate-300">{hotspot.lastUid}</span>
                      <span className="font-semibold text-amber-300">{formatPercent(riskRate)}</span>
                      <span className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${action.includes("Revisar") ? "bg-amber-400/12 text-amber-300" : "bg-emerald-400/12 text-emerald-300"}`}>{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/75 bg-[linear-gradient(180deg,rgba(10,22,41,.94),rgba(4,10,20,.94))] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-white">Alertas y excepciones <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs">{alerts.length}</span></p>
                <button type="button" onClick={() => { window.location.href = "/events"; }} className="text-sm font-semibold text-cyan-300">Ver todas</button>
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

      <footer className="absolute bottom-0 left-0 right-0 z-20 flex h-8 items-center justify-between border-t border-white/8 bg-[#06101d]/90 px-8 text-xs text-slate-400">
        <span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} /> {connected ? "Conectado al stream en tiempo real" : "Reconectando stream"}</span>
        <span>Actualizado: {timeAgo(lastUpdateAt)}</span>
        <span>Fuente: nexID Core · Precisión de ubicación: {latestEvent?.locationAccuracyM ? `±${Math.round(Number(latestEvent.locationAccuracyM))} m` : "según evento"}</span>
      </footer>
    </div>
  );
}
