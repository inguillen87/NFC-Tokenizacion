"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardRealtime } from "./dashboard-realtime-provider";
import { dashboardRealtimeConsumerFellBehind, unreadDashboardRealtimeFrames } from "../lib/dashboard-realtime-buffer";

import { parseAdminNotificationSummary, type AdminNotificationSummary } from "../lib/admin-notification-access";

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

export function AdminNotificationBell({ canReadSensitiveEvents = false, canReadNotifications = false, scopeKey = '' }: { canReadSensitiveEvents?: boolean; canReadNotifications?: boolean; scopeKey?: string }) {
  if (!canReadNotifications) return null;
  return <ScopedNotificationBell key={scopeKey} canReadSensitiveEvents={canReadSensitiveEvents}/>;
}
function ScopedNotificationBell({canReadSensitiveEvents}:{canReadSensitiveEvents:boolean}) {
  const [summary, setSummary] = useState<AdminNotificationSummary | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastPulseAt, setLastPulseAt] = useState("");
  const realtime = useDashboardRealtime();
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const trailingLoadRef = useRef(false);
  const consumedEventSequenceRef = useRef(0);
  const activeRef = useRef<AbortController | null>(null);
  const deniedRef = useRef(false);
  const [denied,setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!mountedRef.current || deniedRef.current) return;
    if (loadingRef.current) { trailingLoadRef.current = true; return; }
    loadingRef.current = true;
    const controller = new AbortController();activeRef.current=controller;
    const timeout=setTimeout(()=>controller.abort(),15_000);
    setSummary(null);
    try {
      const response = await fetch("/api/admin/notifications", {cache:"no-store",credentials:"same-origin",redirect:"error",signal:controller.signal});
      if (!mountedRef.current || activeRef.current!==controller || controller.signal.aborted) return;
      if (response.status===401 || response.status===403) {
        deniedRef.current=true;trailingLoadRef.current=false;setSummary(null);setDenied(true);
        await response.body?.cancel().catch(()=>{});return;
      }
      if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')) { await response.body?.cancel().catch(()=>{});return; }
      const reader=response.body?.getReader();if(!reader)return;
      let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
      try { while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>64*1024)throw Error('notification_response_too_large');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode(); }
      catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
      const data=parseAdminNotificationSummary(JSON.parse(text));
      if (mountedRef.current && activeRef.current===controller && !controller.signal.aborted && !deniedRef.current) setSummary(data);
    } catch { if(mountedRef.current && activeRef.current===controller)setSummary(null); }
    finally {
      clearTimeout(timeout);
      if(activeRef.current===controller){activeRef.current=null;loadingRef.current=false;}
      if (mountedRef.current && !deniedRef.current && trailingLoadRef.current) {
        trailingLoadRef.current=false;void load();
      }
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
      const previous=activeRef.current;activeRef.current=null;previous?.abort();loadingRef.current=false;trailingLoadRef.current=false;
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

  if (denied) return null;
  const unread = summary?.unreadCount || 0;
  const counts = summary?.counts;

  return (
    <Link
      href="/leads-tickets"
      className="admin-notification-bell relative inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-500/10"
      title={counts ? `Leads ${counts.new_leads} / tickets ${counts.open_tickets} / orders ${counts.new_orders}` : "Resumen de notificaciones sin confirmar"}
      data-testid="global-notification-bell"
    >
      <span className="admin-notification-bell__icon" aria-hidden />
      <span className="hidden xl:inline">Inbox</span>
      <span className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] md:inline ${liveConnected && summary ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
        {liveConnected && summary ? "Live" : summary ? "Sync" : "Sin confirmar"}
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
