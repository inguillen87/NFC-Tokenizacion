"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";

type EventRow = Record<string, unknown>;
type MapMode = "tenant" | "global";

type Labels = {
  liveFeed: string;
  mission: string;
  mapTitle: string;
  mapSubtitle: string;
};

function toMapPoint(row: EventRow) {
  const lat = Number(row.lat ?? (row.location as { lat?: number } | undefined)?.lat);
  const lng = Number(row.lng ?? (row.location as { lng?: number } | undefined)?.lng);
  const city = String(row.city || (row.location as { city?: string } | undefined)?.city || row.reason || "Unknown");
  const country = String(row.country_code || (row.location as { country?: string } | undefined)?.country || "--");
  const result = String(row.result || "VALID").toUpperCase();
  return {
    city,
    country,
    lat,
    lng,
    scans: 1,
    risk: result === "VALID" ? 0 : 1,
    status: result,
    source: String(row.source || "real"),
    lastSeen: String(row.created_at || row.createdAt || new Date().toISOString()),
  };
}

export function RealtimeOpsMonitor({
  initialEvents,
  tenantScope,
  mode,
  labels,
}: {
  initialEvents: EventRow[];
  tenantScope: string;
  mode: MapMode;
  labels: Labels;
}) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [connected, setConnected] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<string>(new Date().toISOString());

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
        const payload = JSON.parse(event.data) as { rows?: EventRow[] };
        if (Array.isArray(payload.rows)) {
          setEvents(payload.rows);
          setLastUpdateAt(new Date().toISOString());
        }
      } catch {
        // ignore malformed chunk and keep previous state
      }
    };
    source.addEventListener("snapshot", onSnapshot as EventListener);

    return () => {
      source.removeEventListener("snapshot", onSnapshot as EventListener);
      source.close();
    };
  }, [tenantScope]);

  const mapPoints = useMemo(
    () => events.map(toMapPoint).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).slice(0, 40),
    [events]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{labels.liveFeed}</h2>
          <div className="flex items-center gap-2">
            <Badge tone="cyan">{labels.mission}</Badge>
            <Badge tone={connected ? "green" : "amber"}>{connected ? "Live stream" : "Reconnecting..."}</Badge>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Última actualización: {new Date(lastUpdateAt).toLocaleTimeString("es-AR")}</p>
        <div className="mt-4 space-y-2">
          {events.slice(0, 10).map((event) => {
            const result = String(event.result || "VALID");
            const tone = result === "VALID" ? "text-emerald-300" : "text-rose-300";
            return (
              <div key={String(event.id)} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm">
                <p className={`font-semibold ${tone}`}>{result}</p>
                <p className="mt-1 text-slate-300">
                  {String(event.tenant_slug || event.tenantSlug || "-")} · {String(event.bid || "-")} · {String(event.uid_hex || event.uidHex || "-")}
                </p>
              </div>
            );
          })}
          {!events.length ? <p className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-300">Sin eventos aún en el stream activo.</p> : null}
        </div>
      </Card>

      <div>
        <p className="mb-2 text-xs text-slate-400">{labels.mapTitle} · {labels.mapSubtitle}</p>
        <DemoOpsMap points={mapPoints} mode={mode} />
      </div>
    </div>
  );
}
