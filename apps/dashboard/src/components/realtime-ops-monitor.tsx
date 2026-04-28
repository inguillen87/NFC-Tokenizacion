"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";
import Link from "next/link";
import { DemoOpsMap } from "./demo-ops-map";
import { mergeRealtimeEvents, type TenantTapRealtimeEvent } from "../lib/realtime-feed";

type MapMode = "tenant" | "global";

type Labels = {
  liveFeed: string;
  mission: string;
  mapTitle: string;
  mapSubtitle: string;
};

function toMapPoint(row: TenantTapRealtimeEvent) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const city = String(row.city || "Unknown");
  const country = String(row.country || "--");
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
  };
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
  const [connected, setConnected] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<string>(new Date().toISOString());
  const [latestEventId, setLatestEventId] = useState<string>("");
  const [selectedTenant, setSelectedTenant] = useState<string>("all");

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
  }, [visibleEvents]);
  const minuteBars = useMemo(() => {
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
  }, [visibleEvents]);

  function timeAgo(value: unknown) {
    const d = new Date(String(value || ""));
    if (Number.isNaN(d.getTime())) return "justo ahora";
    const sec = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `hace ${sec}s`;
    if (sec < 3600) return `hace ${Math.round(sec / 60)}m`;
    return `hace ${Math.round(sec / 3600)}h`;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.liveFeed}</h2>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="tenant-live-filter">Filtrar tenant</label>
            <select
              id="tenant-live-filter"
              value={selectedTenant}
              onChange={(event) => setSelectedTenant(event.target.value)}
              className="rounded border border-white/20 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
            >
              <option value="all">Todos los tenants</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant} value={tenant}>
                  {tenant}
                </option>
              ))}
            </select>
            <Badge tone="cyan">{labels.mission}</Badge>
            <Badge tone={connected ? "green" : "amber"}>{connected ? "Live stream" : "Reconnecting..."}</Badge>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Última actualización: {new Date(lastUpdateAt).toLocaleTimeString("es-AR")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            <p className="uppercase tracking-[0.12em] text-emerald-200/80">Taps válidos</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.valid}</p>
          </div>
          <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-xs text-rose-100">
            <p className="uppercase tracking-[0.12em] text-rose-200/80">Taps con riesgo</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.risk}</p>
          </div>
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            <p className="uppercase tracking-[0.12em] text-cyan-200/80">UIDs activas</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.uniqueTags}</p>
          </div>
          <div className="rounded-xl border border-indigo-300/25 bg-indigo-500/10 p-3 text-xs text-indigo-100">
            <p className="uppercase tracking-[0.12em] text-indigo-200/80">Ciudades activas</p>
            <p className="mt-1 text-xl font-semibold">{liveMetrics.uniqueCities}</p>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100">
            <p className="uppercase tracking-[0.12em] text-fuchsia-200/80">Taps últimos 5m</p>
            <p className="mt-1 text-xl font-semibold">{realtimePulse.recentCount}</p>
          </div>
          <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 p-3 text-xs text-sky-100">
            <p className="uppercase tracking-[0.12em] text-sky-200/80">Velocidad (TPM)</p>
            <p className="mt-1 text-xl font-semibold">{realtimePulse.tapsPerMinute}</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
          <p className="font-semibold uppercase tracking-[0.12em] text-slate-200">Tenants activos (últimos 5m)</p>
          <div className="mt-2 space-y-1.5">
            {realtimePulse.topTenants.map((tenant) => (
              <div key={tenant.tenant} className="flex items-center justify-between rounded border border-white/10 bg-slate-950/50 px-2 py-1">
                <p className="font-mono text-[11px] text-slate-200">{tenant.tenant}</p>
                <p className="text-[11px] text-slate-300">
                  taps <span className="font-semibold text-cyan-200">{tenant.taps}</span> · riesgo{" "}
                  <span className={tenant.risk ? "font-semibold text-rose-300" : "font-semibold text-emerald-300"}>{tenant.risk}</span>
                </p>
              </div>
            ))}
            {!realtimePulse.topTenants.length ? <p className="text-slate-400">Sin actividad reciente por tenant.</p> : null}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Scope activo: <span className="font-mono text-slate-200">{selectedTenant === "all" ? "todos los tenants" : selectedTenant}</span>
        </p>
        {selectedTenant !== "all" ? (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Link href={`/tenants/${encodeURIComponent(selectedTenant)}`} className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100 hover:bg-cyan-500/20">
              Ver tenant
            </Link>
            <Link href={`/events?tenant=${encodeURIComponent(selectedTenant)}`} className="rounded border border-indigo-300/30 bg-indigo-500/10 px-2 py-1 text-indigo-100 hover:bg-indigo-500/20">
              Abrir eventos filtrados
            </Link>
            <Link href={`/tags?tenant=${encodeURIComponent(selectedTenant)}`} className="rounded border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100 hover:bg-emerald-500/20">
              Ver tags del tenant
            </Link>
          </div>
        ) : null}
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-semibold uppercase tracking-[0.12em] text-slate-200">Momentum taps (10m)</p>
            <p className="text-[11px] text-slate-400">barras por minuto</p>
          </div>
          <div className="mt-2 flex items-end gap-1">
            {minuteBars.map((bar) => (
              <div key={bar.key} className="group flex-1">
                <div
                  style={{ height: `${bar.height}px` }}
                  className={`w-full rounded-t bg-gradient-to-t transition-all duration-500 ${bar.count ? "from-cyan-500/30 to-cyan-300/80" : "from-slate-700/40 to-slate-600/40"}`}
                  title={`${bar.label} · ${bar.count} taps`}
                />
                <p className="mt-1 truncate text-center text-[9px] text-slate-500">{bar.label}</p>
              </div>
            ))}
          </div>
        </div>
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
                <p className="mt-1 text-slate-300">
                  {String(event.tenantSlug || "-")} · {String(event.batchId || "-")} · {String(event.uidMasked || "-")}
                </p>
              </div>
            );
          })}
          {!visibleEvents.length ? <p className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-300">Sin eventos aún en el stream activo para este tenant.</p> : null}
        </div>
      </Card>

      <div>
        <p className="mb-2 text-xs text-slate-400">{labels.mapTitle} · {labels.mapSubtitle}</p>
        <DemoOpsMap points={mapPoints} mode={mode} />
      </div>
    </div>
  );
}
