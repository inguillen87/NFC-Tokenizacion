"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  appendDashboardRealtimeBuffer,
  dashboardRealtimeControlConfirmsReady,
  dashboardRealtimeSnapshotConfirmsReady,
  DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT,
  type DashboardRealtimeEventBuffer,
} from "../lib/dashboard-realtime-buffer";
import { createRealtimeTapArrivalGate } from "../lib/realtime-tap-arrival";

export type DashboardRealtimeWindow = "5m" | "1h" | "24h" | "7d" | "30d" | "all";
export type DashboardRealtimeSource = "production" | "demo" | "all";
export type DashboardRealtimeStatus = "disabled" | "connecting" | "connected" | "reconnecting";

export type DashboardRealtimeScope = {
  tenant: string;
  window: DashboardRealtimeWindow;
  source: DashboardRealtimeSource;
  limit: number;
};

export type DashboardRealtimeFrame = {
  data: unknown;
  eventId: string;
  receivedAt: string;
  scopeKey: string;
  sequence: number;
  newPhysicalTapArrival?: boolean;
};

type DashboardRealtimeContextValue = {
  activeScope: DashboardRealtimeScope;
  activeScopeKey: string;
  status: DashboardRealtimeStatus;
  snapshot: DashboardRealtimeFrame | null;
  events: readonly DashboardRealtimeFrame[];
  droppedThroughSequence: number;
  heartbeat: DashboardRealtimeFrame | null;
  warning: DashboardRealtimeFrame | null;
};

const DashboardRealtimeContext = createContext<DashboardRealtimeContextValue | null>(null);

function normalizedTenant(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

export function normalizeDashboardRealtimeScope(scope: Partial<DashboardRealtimeScope>): DashboardRealtimeScope {
  const window = ["5m", "1h", "24h", "7d", "30d", "all"].includes(String(scope.window))
    ? scope.window as DashboardRealtimeWindow
    : "24h";
  const source = scope.source === "demo" || scope.source === "all" ? scope.source : "production";
  return {
    tenant: normalizedTenant(scope.tenant),
    window,
    source,
    limit: boundedLimit(scope.limit),
  };
}

export function dashboardRealtimeScopeKey(scope: Partial<DashboardRealtimeScope>) {
  const normalized = normalizeDashboardRealtimeScope(scope);
  return [normalized.tenant || "global", normalized.window, normalized.source, normalized.limit].join("|");
}

function parseFrameData(event: MessageEvent<string>) {
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
}

export function DashboardRealtimeProvider({
  children,
  enabled,
  tenantSlug,
  source,
}: {
  children: ReactNode;
  enabled: boolean;
  tenantSlug?: string | null;
  source: DashboardRealtimeSource;
}) {
  const baseScope = useMemo(() => normalizeDashboardRealtimeScope({
    tenant: tenantSlug || "",
    // One stable superset stream per authenticated browser tab. Consumers
    // apply their own time/BID/view filters without reopening transport.
    window: "all",
    source,
    limit: 50,
  }), [source, tenantSlug]);
  const sequenceRef = useRef(0);
  const [status, setStatus] = useState<DashboardRealtimeStatus>(enabled ? "connecting" : "disabled");
  const [snapshot, setSnapshot] = useState<DashboardRealtimeFrame | null>(null);
  const [eventBuffer, setEventBuffer] = useState<DashboardRealtimeEventBuffer<DashboardRealtimeFrame>>({
    frames: [],
    droppedThroughSequence: 0,
  });
  const [heartbeat, setHeartbeat] = useState<DashboardRealtimeFrame | null>(null);
  const [warning, setWarning] = useState<DashboardRealtimeFrame | null>(null);

  const activeScope = baseScope;
  const activeScopeKey = useMemo(() => dashboardRealtimeScopeKey(activeScope), [activeScope]);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") {
      setStatus("disabled");
      setSnapshot(null);
      setEventBuffer({ frames: [], droppedThroughSequence: 0 });
      setHeartbeat(null);
      setWarning(null);
      return;
    }

    let disposed = false;
    setStatus("connecting");
    setSnapshot(null);
    setEventBuffer({ frames: [], droppedThroughSequence: 0 });
    setHeartbeat(null);
    setWarning(null);

    const streamUrl = new URL("/api/admin/events/stream", window.location.origin);
    streamUrl.searchParams.set("limit", String(activeScope.limit));
    streamUrl.searchParams.set("window", activeScope.window);
    streamUrl.searchParams.set("source", activeScope.source);
    if (activeScope.tenant) streamUrl.searchParams.set("tenant", activeScope.tenant);
    const stream = new EventSource(streamUrl.toString());
    const arrivalGate = createRealtimeTapArrivalGate(activeScope);

    const frame = (message: MessageEvent<string>): DashboardRealtimeFrame => ({
      data: parseFrameData(message),
      eventId: String(message.lastEventId || ""),
      receivedAt: new Date().toISOString(),
      scopeKey: activeScopeKey,
      sequence: ++sequenceRef.current,
    });
    const onSnapshot = (message: MessageEvent<string>) => {
      if (disposed) return;
      const next = frame(message);
      arrivalGate.snapshot(next.data);
      setSnapshot(next);
      setStatus(dashboardRealtimeSnapshotConfirmsReady(next.data, activeScope) ? "connected" : "reconnecting");
    };
    const onEvent = (message: MessageEvent<string>) => {
      if (disposed) return;
      const next = frame(message);
      next.newPhysicalTapArrival = arrivalGate.accept(next.data);
      // React may batch a burst into one render. The ordered, bounded buffer
      // lets every consumer drain every frame instead of seeing only the last
      // state assignment.
      setEventBuffer((current) => appendDashboardRealtimeBuffer(
        current,
        next,
        DASHBOARD_REALTIME_EVENT_BUFFER_LIMIT,
      ));
    };
    const onHeartbeat = (message: MessageEvent<string>) => {
      if (!disposed) setHeartbeat(frame(message));
    };
    const onWarning = (message: MessageEvent<string>) => {
      if (disposed) return;
      arrivalGate.pause();
      setWarning(frame(message));
      setStatus("reconnecting");
    };
    const onConnected = (message: MessageEvent<string>) => {
      if (disposed) return;
      const next = frame(message);
      arrivalGate.connect(next.data);
      setStatus(dashboardRealtimeControlConfirmsReady(next.data) ? "connected" : "reconnecting");
    };

    stream.onopen = () => {
      arrivalGate.pause();
      if (!disposed) setStatus("connecting");
    };
    stream.onerror = () => {
      arrivalGate.pause();
      if (!disposed) setStatus("reconnecting");
    };
    stream.addEventListener("snapshot", onSnapshot as EventListener);
    stream.addEventListener("event", onEvent as EventListener);
    stream.addEventListener("heartbeat", onHeartbeat as EventListener);
    stream.addEventListener("warning", onWarning as EventListener);
    stream.addEventListener("connected", onConnected as EventListener);

    return () => {
      disposed = true;
      stream.removeEventListener("snapshot", onSnapshot as EventListener);
      stream.removeEventListener("event", onEvent as EventListener);
      stream.removeEventListener("heartbeat", onHeartbeat as EventListener);
      stream.removeEventListener("warning", onWarning as EventListener);
      stream.removeEventListener("connected", onConnected as EventListener);
      stream.close();
    };
  }, [activeScope, activeScopeKey, enabled]);

  const value = useMemo<DashboardRealtimeContextValue>(() => ({
    activeScope,
    activeScopeKey,
    status,
    snapshot,
    events: eventBuffer.frames,
    droppedThroughSequence: eventBuffer.droppedThroughSequence,
    heartbeat,
    warning,
  }), [activeScope, activeScopeKey, eventBuffer, heartbeat, snapshot, status, warning]);

  return <DashboardRealtimeContext.Provider value={value}>{children}</DashboardRealtimeContext.Provider>;
}

export function useDashboardRealtime() {
  const context = useContext(DashboardRealtimeContext);
  if (!context) throw new Error("useDashboardRealtime must be used inside DashboardRealtimeProvider");
  return context;
}
