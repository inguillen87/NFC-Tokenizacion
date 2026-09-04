"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, RefreshCw } from "lucide-react";
import { useDashboardRealtime } from "./dashboard-realtime-provider";
import { dashboardRealtimeConsumerFellBehind, unreadDashboardRealtimeFrames } from "../lib/dashboard-realtime-buffer";

const EVENT_REFRESH_DEBOUNCE_MS = 5_000;

type SyncMode = "connecting" | "live" | "reconnecting" | "manual";

export function ConsumerNetworkLiveRefresh({
  refreshEnabled,
  streamEnabled,
  tenantSlug,
}: {
  refreshEnabled: boolean;
  streamEnabled: boolean;
  tenantSlug?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<SyncMode>(streamEnabled ? "connecting" : "manual");
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const refreshTimer = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const trailingRefreshRef = useRef(false);
  const refreshOnVisibleRef = useRef(false);
  const consumedEventSequenceRef = useRef(0);
  const realtime = useDashboardRealtime();

  const refresh = useCallback(() => {
    if (pendingRef.current) {
      trailingRefreshRef.current = true;
      return;
    }
    setLastAttemptAt(new Date().toISOString());
    startTransition(() => router.refresh());
  }, [router]);

  const queueRefresh = useCallback(() => {
    if (refreshTimer.current !== null) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      refresh();
    }, EVENT_REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    pendingRef.current = isPending;
    if (!isPending && trailingRefreshRef.current) {
      trailingRefreshRef.current = false;
      queueRefresh();
    }
  }, [isPending, queueRefresh]);

  useEffect(() => {
    if (!refreshEnabled || !streamEnabled) {
      setMode("manual");
      return;
    }
    setMode(realtime.status === "connected"
      ? "live"
      : realtime.status === "reconnecting" ? "reconnecting" : "connecting");
  }, [realtime.status, refreshEnabled, streamEnabled]);

  useEffect(() => {
    if (!refreshEnabled || !streamEnabled) return;
    const frame = realtime.snapshot;
    if (!frame || frame.scopeKey !== realtime.activeScopeKey) return;
    const payload = frame.data as { rows?: unknown[]; availability?: string } | null;
    if (!payload || !Array.isArray(payload.rows) || String(payload.availability) !== "ready") {
      setMode("reconnecting");
      return;
    }
    setMode("live");
  }, [realtime.activeScopeKey, realtime.snapshot, refreshEnabled, streamEnabled]);

  useEffect(() => {
    if (!refreshEnabled || !streamEnabled) return;
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
    const matchingFrames = tenantSlug
      ? frames.filter((frame) => {
        const event = frame.data && typeof frame.data === "object" && !Array.isArray(frame.data)
          ? frame.data as { tenantSlug?: unknown; tenant_slug?: unknown }
          : null;
        const eventTenant = String(event?.tenantSlug || event?.tenant_slug || "").trim().toLowerCase();
        return eventTenant === tenantSlug.trim().toLowerCase();
      })
      : frames;
    if (!matchingFrames.length && !fellBehind) return;
    setMode(realtime.status === "connected" ? "live" : "reconnecting");
    if (document.visibilityState === "visible") queueRefresh();
    else refreshOnVisibleRef.current = true;
  }, [queueRefresh, realtime.activeScopeKey, realtime.droppedThroughSequence, realtime.events, realtime.status, refreshEnabled, streamEnabled, tenantSlug]);

  useEffect(() => {
    if (!refreshEnabled) return;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (refreshOnVisibleRef.current) {
        refreshOnVisibleRef.current = false;
        queueRefresh();
      } else if (!streamEnabled || realtime.status !== "connected") {
        // One reconciliation when the operator returns; never a periodic loop.
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    };
  }, [queueRefresh, realtime.status, refresh, refreshEnabled, streamEnabled]);

  if (!refreshEnabled) return null;

  const live = mode === "live";
  const label = live
    ? "Sincronización en vivo"
    : mode === "reconnecting"
      ? "Canal en vivo reconectando"
      : mode === "manual"
        ? "Actualización bajo demanda"
      : "Conectando actividad en vivo";
  const description = live
    ? "Los nuevos taps actualizan esta vista por SSE; PostgreSQL sigue siendo la fuente durable."
    : streamEnabled
      ? mode === "reconnecting"
        ? "EventSource intenta restablecer el canal automáticamente. Conservamos el último snapshot y no abrimos un ciclo de consultas periódicas."
        : "Esperando el primer snapshot autorizado del canal tenant."
      : "Tu rol puede consultar el CRM, pero no el stream de eventos sensibles. Actualizá manualmente o volvé a la pestaña para consultar la fuente durable una vez.";

  return (
    <aside
      data-testid="consumer-network-live-refresh"
      data-sync-mode={mode}
      data-stream-enabled={streamEnabled ? "true" : "false"}
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        live
          ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-50"
          : "border-cyan-300/20 bg-cyan-400/10 text-cyan-50"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${live ? "border-emerald-300/30 bg-emerald-300/10" : "border-cyan-300/25 bg-cyan-300/10"}`}>
          <Radio className={`h-4 w-4 ${live ? "text-emerald-200" : "text-cyan-200"}`} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black">{label}</p>
          <p className="mt-1 text-xs leading-5 opacity-75">
            {description}
            {lastAttemptAt ? ` Último intento de actualización: ${new Date(lastAttemptAt).toLocaleTimeString("es-AR")}.` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-950/50 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
        {isPending ? "Actualizando…" : "Actualizar ahora"}
      </button>
    </aside>
  );
}
