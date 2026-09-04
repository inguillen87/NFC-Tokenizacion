"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardRealtime } from "./dashboard-realtime-provider";
import { dashboardRealtimeConsumerFellBehind, unreadDashboardRealtimeFrames } from "../lib/dashboard-realtime-buffer";

type NotificationSummary = {
  unreadCount?: number;
  counts?: {
    new_leads?: number;
    open_tickets?: number;
    new_orders?: number;
  };
};

const NOTIFICATION_EVENT_TYPES = new Set([
  "lead.created",
  "ticket.created",
  "order.created",
  "order_request.created",
  "marketplace.order_requested",
  "supplier_order.created",
]);

function notificationMayHaveChanged(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as { event_type?: unknown; eventType?: unknown };
  const eventType = String(payload.event_type || payload.eventType || "").trim().toLowerCase();
  return NOTIFICATION_EVENT_TYPES.has(eventType);
}

export function AdminNotificationBell({ canReadSensitiveEvents = false }: { canReadSensitiveEvents?: boolean }) {
  const [summary, setSummary] = useState<NotificationSummary>({});
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState("");
  const realtime = useDashboardRealtime();
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const trailingLoadRef = useRef(false);
  const consumedEventSequenceRef = useRef(0);

  const load = useCallback(async () => {
    if (loadingRef.current) {
      trailingLoadRef.current = true;
      return;
    }
    loadingRef.current = true;
    const response = await fetch("/api/admin/notifications", { cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      const data = await response.json().catch(() => null) as NotificationSummary | null;
      if (mountedRef.current && data) setSummary(data);
    }
    loadingRef.current = false;
    if (mountedRef.current && trailingLoadRef.current) {
      trailingLoadRef.current = false;
      void load();
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    setLiveConnected(canReadSensitiveEvents && realtime.status === "connected");
  }, [canReadSensitiveEvents, realtime.status]);

  useEffect(() => {
    if (!canReadSensitiveEvents || !realtime.snapshot) return;
    setLastPulseAt(realtime.snapshot.receivedAt);
    void load();
  }, [canReadSensitiveEvents, load, realtime.snapshot]);

  useEffect(() => {
    if (!canReadSensitiveEvents) return;
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
    if (frames.length) setLastPulseAt(frames[frames.length - 1].receivedAt);
    if (fellBehind || frames.some((frame) => notificationMayHaveChanged(frame.data))) void load();
  }, [canReadSensitiveEvents, load, realtime.activeScopeKey, realtime.droppedThroughSequence, realtime.events]);

  useEffect(() => {
    if (!canReadSensitiveEvents || !realtime.heartbeat) return;
    setLastPulseAt(realtime.heartbeat.receivedAt);
  }, [canReadSensitiveEvents, realtime.heartbeat]);

  const unread = Number(summary.unreadCount || 0);
  const counts = summary.counts || {};

  return (
    <Link
      href="/leads-tickets"
      className="admin-notification-bell relative inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-500/10"
      title={`Leads ${counts.new_leads || 0} / tickets ${counts.open_tickets || 0} / orders ${counts.new_orders || 0}`}
    >
      <span className="admin-notification-bell__icon" aria-hidden />
      <span className="hidden xl:inline">Inbox</span>
      <span className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] md:inline ${liveConnected ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
        {liveConnected ? "Live" : "Sync"}
      </span>
      {lastPulseAt ? <span className="sr-only">Last realtime pulse {lastPulseAt}</span> : null}
      {unread > 0 ? (
        <span className="admin-notification-bell__badge" aria-label={`${unread} unread notifications`}>
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
