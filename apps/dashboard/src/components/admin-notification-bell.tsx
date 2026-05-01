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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => null) as NotificationSummary | null;
      if (!cancelled && data) setSummary(data);
    }

    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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
      {unread > 0 ? (
        <span className="admin-notification-bell__badge" aria-label={`${unread} unread notifications`}>
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
