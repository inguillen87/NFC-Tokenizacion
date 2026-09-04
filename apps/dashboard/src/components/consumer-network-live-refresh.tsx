"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, RefreshCw } from "lucide-react";

const RECONCILE_INTERVAL_MS = 10_000;
const EVENT_REFRESH_DEBOUNCE_MS = 350;

type SyncMode = "connecting" | "live" | "polling";

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
  const [mode, setMode] = useState<SyncMode>(streamEnabled ? "connecting" : "polling");
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const refreshTimer = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const trailingRefreshRef = useRef(false);

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
    if (!refreshEnabled) return;

    let disposed = false;
    let streamHealthy = false;
    let refreshOnVisible = false;
    let reconcileTimer: number | null = null;
    const stopPolling = () => {
      if (reconcileTimer === null) return;
      window.clearInterval(reconcileTimer);
      reconcileTimer = null;
    };
    const poll = () => {
      if (!disposed && document.visibilityState === "visible") queueRefresh();
    };
    const startPolling = () => {
      if (disposed || reconcileTimer !== null || document.visibilityState !== "visible") return;
      reconcileTimer = window.setInterval(poll, RECONCILE_INTERVAL_MS);
    };
    const enterPollingMode = () => {
      if (disposed) return;
      streamHealthy = false;
      setMode("polling");
      startPolling();
    };
    const refreshFromStream = () => {
      if (document.visibilityState === "visible") {
        queueRefresh();
      } else {
        refreshOnVisible = true;
      }
    };

    let source: EventSource | null = null;
    let onSnapshot: ((event: MessageEvent<string>) => void) | null = null;
    let onEvent: (() => void) | null = null;
    let onWarning: (() => void) | null = null;

    if (streamEnabled) {
      setMode("connecting");
      startPolling();
      const streamUrl = new URL("/api/admin/events/stream", window.location.origin);
      streamUrl.searchParams.set("limit", "12");
      streamUrl.searchParams.set("window", "24h");
      streamUrl.searchParams.set("source", "production");
      if (tenantSlug) streamUrl.searchParams.set("tenant", tenantSlug);

      source = new EventSource(streamUrl.toString());
      source.onopen = () => {
        if (!disposed && !streamHealthy) setMode("connecting");
      };
      source.onerror = enterPollingMode;
      onSnapshot = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { rows?: unknown[]; availability?: string };
          if (!Array.isArray(payload.rows) || payload.availability !== "ready") {
            enterPollingMode();
            return;
          }
          streamHealthy = true;
          stopPolling();
          setMode("live");
          refreshFromStream();
        } catch {
          enterPollingMode();
        }
      };
      onEvent = () => {
        streamHealthy = true;
        stopPolling();
        setMode("live");
        refreshFromStream();
      };
      onWarning = enterPollingMode;
      source.addEventListener("snapshot", onSnapshot as EventListener);
      source.addEventListener("event", onEvent as EventListener);
      source.addEventListener("warning", onWarning as EventListener);
    } else {
      enterPollingMode();
    }

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        stopPolling();
        return;
      }
      if (refreshOnVisible) {
        refreshOnVisible = false;
        queueRefresh();
      }
      if (!streamHealthy) {
        refresh();
        startPolling();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (source && onSnapshot) source.removeEventListener("snapshot", onSnapshot as EventListener);
      if (source && onEvent) source.removeEventListener("event", onEvent as EventListener);
      if (source && onWarning) source.removeEventListener("warning", onWarning as EventListener);
      source?.close();
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    };
  }, [queueRefresh, refresh, refreshEnabled, streamEnabled, tenantSlug]);

  if (!refreshEnabled) return null;

  const live = mode === "live";
  const label = live
    ? "Sincronización en vivo"
    : mode === "polling"
      ? streamEnabled
        ? "Canal en vivo interrumpido · reconciliando"
        : "Actualización periódica segura"
      : "Conectando actividad en vivo";
  const description = live
    ? "Los nuevos taps actualizan esta vista por SSE; PostgreSQL sigue siendo la fuente durable."
    : streamEnabled
      ? mode === "polling"
        ? "El canal inmediato está interrumpido; se consulta la fuente durable cada 10 segundos mientras esta pestaña está visible."
        : "Esperando el primer snapshot autorizado; hasta entonces se mantiene una reconciliación acotada."
      : "Tu rol puede consultar el CRM, pero no el stream de eventos sensibles; la vista se actualiza desde la fuente durable cada 10 segundos mientras está visible.";

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
