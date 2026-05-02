"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NotificationSummary = {
  unreadCount?: number;
  counts?: {
    new_leads?: number;
    open_tickets?: number;
    new_orders?: number;
  };
};

export function AdminNotificationBell() {
  const [summary, setSummary] = useState<NotificationSummary>({});
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState("");

  useEffect(() => {
    let cancelled = false;
    let stream: EventSource | null = null;

    async function load() {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => null) as NotificationSummary | null;
      if (!cancelled && data) setSummary(data);
    }

    function refreshFromRealtime() {
      if (cancelled) return;
      setLastPulseAt(new Date().toISOString());
      void load();
    }

    void load();
    const timer = window.setInterval(load, 5000);

    if (typeof EventSource !== "undefined") {
      const url = new URL("/api/admin/events/stream", window.location.origin);
      url.searchParams.set("limit", "8");
      url.searchParams.set("range", "24h");
      url.searchParams.set("source", "all");
      stream = new EventSource(url.toString());
      stream.onopen = () => {
        if (!cancelled) setLiveConnected(true);
      };
      stream.onerror = () => {
        if (!cancelled) setLiveConnected(false);
      };
      stream.addEventListener("snapshot", refreshFromRealtime as EventListener);
      stream.addEventListener("event", refreshFromRealtime as EventListener);
      stream.addEventListener("heartbeat", refreshFromRealtime as EventListener);
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stream?.removeEventListener("snapshot", refreshFromRealtime as EventListener);
      stream?.removeEventListener("event", refreshFromRealtime as EventListener);
      stream?.removeEventListener("heartbeat", refreshFromRealtime as EventListener);
      stream?.close();
    };
  }, []);

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
