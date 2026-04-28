"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OpsPanel, StatusChip, WorldMapRealtime } from "@product/ui";
import { VerticalAsset } from "./multirubro-assets";
import { motion } from "framer-motion";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";
import { readDemoDataMetaFromResponse } from "../lib/demo-data-mode";

type AnalyticsPayload = {
  ok?: boolean;
  reason?: string;
  kpis?: { scans?: number; validRate?: number };
  geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }> ;
  trend?: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
};

type SecurityPayload = {
  ok?: boolean;
  reason?: string;
  summary?: { repeatedInvalidUid?: number; geoVelocityAlerts?: number };
  repeatedInvalidUid?: Array<{ uidHex: string; count: number; severity: string }>;
  geoVelocityAlerts?: Array<{ uidHex: string; fromCountry: string; toCountry: string; severity: string }>;
};

type AlertItem = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "acknowledged" | string;
  tenant_slug?: string;
  title?: string;
  created_at?: string;
};

type AlertsPayload = {
  ok?: boolean;
  reason?: string;
  items?: AlertItem[];
};

type TokenizationPayload = {
  ok?: boolean;
  reason?: string;
  rows?: Array<{ id: string; bid: string; uid_hex: string; status: string; network?: string; tx_hash?: string | null; token_id?: string | null }>;
};

type WalletPayload = { ok?: boolean; reason?: string; balancePol?: number; mode?: string; warning?: string };
type DiagnosticsPayload = {
  ok?: boolean;
  scope?: { tenant?: string };
  counters?: { eventsTotal?: number; replayEvents?: number; riskEvents?: number; unassignedAttempts?: number };
  freshness?: { latestAt?: string | null; ageMs?: number | null; streamState?: string };
};

type StreamEventPayload = {
  id?: string | number;
  result?: string;
  reason?: string;
  uid_hex?: string;
  bid?: string;
  tenant_slug?: string;
  city?: string;
  country_code?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  created_at?: string;
  stream_sent_at?: string;
  stream_latency_ms?: number | null;
  request_id?: string;
  stream_request_id?: string;
  origin_trace_id?: string | null;
};

type LiveFeedItem = {
  id: string;
  at: string;
  result: string;
  reason: string;
  uid: string;
  bid: string;
  tenant: string;
  city: string;
  country: string;
  streamLatencyMs: number | null;
  requestId: string;
};

const METADATA_TEMPLATES = [
  { vertical: "Vinos", fields: ["Nota de cata", "Temperatura de guarda", "Barrica / cosecha"] },
  { vertical: "Cosmética", fields: ["INCI", "Lote cosmético", "Fecha sugerida de uso"] },
  { vertical: "Documentos", fields: ["Hash PDF original", "Emisor legal", "Timestamping"] },
  { vertical: "Semillas", fields: ["Certificado origen", "Fecha vencimiento", "Tratamiento fitosanitario"] },
];

export function MultirubroOpsPanel() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [security, setSecurity] = useState<SecurityPayload | null>(null);
  const [tokenization, setTokenization] = useState<TokenizationPayload | null>(null);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [mintStatus, setMintStatus] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [demoDataMode, setDemoDataMode] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string>("");
  const [streamOnline, setStreamOnline] = useState(false);
  const [streamState, setStreamState] = useState<"connected" | "reconnecting" | "stale" | "offline">("offline");
  const [lastEventAt, setLastEventAt] = useState<string>("");
  const streamOnlineRef = useRef(false);
  const staleTimerRef = useRef<number | null>(null);
  const eventRefreshGateRef = useRef(0);
  const [demoActionStatus, setDemoActionStatus] = useState("");
  const [botQuestion, setBotQuestion] = useState("explicame el riesgo actual");
  const [botAnswer, setBotAnswer] = useState("");
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>("");
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>("");

  function normalizeFeedItem(payload: StreamEventPayload): LiveFeedItem {
    return {
      id: String(payload.id || `${payload.created_at || Date.now()}-${payload.uid_hex || "evt"}`),
      at: String(payload.created_at || new Date().toISOString()),
      result: String(payload.result || "UNKNOWN"),
      reason: String(payload.reason || "n/a"),
      uid: String(payload.uid_hex || "—"),
      bid: String(payload.bid || "—"),
      tenant: String(payload.tenant_slug || "—"),
      city: String(payload.city || "Unknown"),
      country: String(payload.country_code || "--"),
      streamLatencyMs: Number.isFinite(Number(payload.stream_latency_ms)) ? Number(payload.stream_latency_ms) : null,
      requestId: String(payload.origin_trace_id || payload.request_id || payload.stream_request_id || "n/a"),
    };
  }

  function applyIncomingEvent(payload: StreamEventPayload) {
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const createdAt = payload.created_at || new Date().toISOString();
    const result = String(payload.result || "").toUpperCase();
    const isValid = result === "VALID" || result === "TAP_VALID";
    const isReplay = String(payload.reason || "").toLowerCase().includes("replay");
    const isInvalidLike = !isValid;

    setAnalytics((prev) => {
      if (!prev) return prev;
      const scans = Number(prev.kpis?.scans || 0) + 1;
      const previousValidRate = Number(prev.kpis?.validRate || 0);
      const previousValidCount = Math.round((previousValidRate / 100) * Number(prev.kpis?.scans || 0));
      const nextValidCount = previousValidCount + (isValid ? 1 : 0);
      const nextValidRate = scans > 0 ? Number(((nextValidCount / scans) * 100).toFixed(1)) : previousValidRate;

      const trend = [...(prev.trend || [])];
      const day = createdAt.slice(0, 10);
      if (trend.length) {
        const last = trend[trend.length - 1];
        if (last.day === day) {
          last.scans += 1;
          if (isInvalidLike) last.duplicates += 1;
          if (String(payload.reason || "").toLowerCase().includes("tamper")) last.tamper += 1;
        } else {
          trend.push({ day, scans: 1, duplicates: isInvalidLike ? 1 : 0, tamper: String(payload.reason || "").toLowerCase().includes("tamper") ? 1 : 0 });
        }
      } else {
        trend.push({ day, scans: 1, duplicates: isInvalidLike ? 1 : 0, tamper: String(payload.reason || "").toLowerCase().includes("tamper") ? 1 : 0 });
      }

      const geoPoints = [...(prev.geoPoints || [])];
      if (hasGeo) {
        const city = String(payload.city || "Unknown");
        const country = String(payload.country_code || "--");
        const existing = geoPoints.find((point) => point.city === city && (point.country || "--") === country);
        if (existing) {
          existing.scans = Number(existing.scans || 0) + 1;
          if (isInvalidLike) existing.risk = Number(existing.risk || 0) + 1;
        } else {
          geoPoints.unshift({ city, country, scans: 1, risk: isInvalidLike ? 1 : 0, lat, lng });
        }
      }

      return {
        ...prev,
        kpis: { ...(prev.kpis || {}), scans, validRate: nextValidRate },
        trend: trend.slice(-30),
        geoPoints,
      };
    });

    if (isReplay) {
      setSecurity((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...(prev.summary || {}),
            repeatedInvalidUid: Number(prev.summary?.repeatedInvalidUid || 0) + 1,
          },
        };
      });
    }
  }

  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (readDemoDataMetaFromResponse(response).demoMode) setDemoDataMode(true);
      const payload = await response.json().catch(() => null);
      if (!payload) {
        return null;
      }
      if (!response.ok && typeof payload === "object") {
        return { ...(payload as object), ok: false } as T;
      }
      return payload as T;
    } catch {
      return null;
    }
  }

  function withQuery(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (String(value || "").trim()) qs.set(key, value.trim());
    }
    const query = qs.toString();
    return query ? `${path}?${query}` : path;
  }

  async function loadData() {
    const [a, s, alertsPayload, t, w, d] = await Promise.all([
      fetchJson<AnalyticsPayload>("/api/admin/analytics?range=24h"),
      fetchJson<SecurityPayload>("/api/admin/security-alerts?hours=24"),
      fetchJson<AlertsPayload>(withQuery("/api/admin/alerts", { severity: alertSeverityFilter, type: alertTypeFilter })),
      fetchJson<TokenizationPayload>("/api/admin/tokenization/requests?limit=20"),
      fetchJson<WalletPayload>("/api/admin/polygon/wallet"),
      fetchJson<DiagnosticsPayload>("/api/admin/diagnostics/live-pipeline"),
    ]);
    const nextWarnings = [
      a?.reason,
      s?.reason,
      alertsPayload?.reason,
      t?.reason,
      w?.reason,
      d?.ok === false ? "live_pipeline_unavailable" : null,
    ].filter(Boolean) as string[];
    setWarnings(Array.from(new Set(nextWarnings)));
    setAnalytics(a);
    setSecurity(s);
    setAlerts(alertsPayload?.items || []);
    setTokenization(t);
    setWallet(w);
    setDiagnostics(d);
    setLastSyncAt(new Date().toISOString());
  }

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      if (!streamOnlineRef.current) void loadData();
    }, 10_000);
    return () => clearInterval(timer);
  }, [alertSeverityFilter, alertTypeFilter]);

  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;
    let stream: EventSource | null = null;
    const clearStaleTimer = () => {
      if (staleTimerRef.current) {
        window.clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
    };
    const bumpStaleTimer = () => {
      clearStaleTimer();
      staleTimerRef.current = window.setTimeout(() => {
        if (!active) return;
        setStreamState("stale");
      }, 45_000);
    };

    const connect = () => {
      if (!active || typeof window === "undefined") return;
      stream = new EventSource("/api/admin/events/stream?limit=8");
      setStreamOnline(false);
      setStreamState("reconnecting");
      streamOnlineRef.current = false;
      stream.onopen = () => {
        if (!active) return;
        setStreamOnline(true);
        setStreamState("connected");
        streamOnlineRef.current = true;
        bumpStaleTimer();
      };
      stream.addEventListener("snapshot", (event) => {
        if (!active) return;
        setLastEventAt(new Date().toISOString());
        bumpStaleTimer();
        void loadData();
        try {
          const payload = JSON.parse(String((event as MessageEvent).data || "{}")) as { rows?: StreamEventPayload[] };
          const rows = Array.isArray(payload.rows) ? payload.rows : [];
          setLiveFeed(rows.slice(0, 12).map(normalizeFeedItem));
        } catch {
          setLiveFeed([]);
        }
      });
      stream.addEventListener("heartbeat", () => {
        if (!active) return;
        setLastEventAt(new Date().toISOString());
        setStreamState("connected");
        bumpStaleTimer();
      });
      stream.addEventListener("warning", (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(String((event as MessageEvent).data || "{}")) as { reason?: string };
          if (payload.reason) setWarnings((prev) => Array.from(new Set([...prev, payload.reason!])));
        } catch {
          setWarnings((prev) => Array.from(new Set([...prev, "stream_warning"])));
        }
      });
      stream.addEventListener("event", (event) => {
        if (!active) return;
        setLastEventAt(new Date().toISOString());
        setStreamState("connected");
        bumpStaleTimer();
        try {
          const payload = JSON.parse(String((event as MessageEvent).data || "{}")) as StreamEventPayload;
          applyIncomingEvent(payload);
          const item = normalizeFeedItem(payload);
          setLiveFeed((prev) => [item, ...prev.filter((row) => row.id !== item.id)].slice(0, 12));
        } catch {
          // ignore malformed payload; reconciliation fetch below will refresh state
        }
        const now = Date.now();
        if (now - eventRefreshGateRef.current > 2000) {
          eventRefreshGateRef.current = now;
          void loadData();
        }
        if (typeof window !== "undefined") {
          const pulse = document.getElementById("nexid-live-pulse");
          if (pulse) {
            pulse.animate(
              [{ transform: "scale(1)", opacity: 0.8 }, { transform: "scale(1.5)", opacity: 0 }],
              { duration: 500, easing: "ease-out" },
            );
          }
        }
      });
      stream.onerror = () => {
        setStreamOnline(false);
        setStreamState("reconnecting");
        streamOnlineRef.current = false;
        clearStaleTimer();
        if (stream) stream.close();
        if (!active) return;
        reconnectTimer = window.setTimeout(connect, 7000);
      };
    };

    connect();
    return () => {
      active = false;
      setStreamOnline(false);
      setStreamState("offline");
      streamOnlineRef.current = false;
      clearStaleTimer();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (stream) stream.close();
    };
  }, []);

  const tapsTotal = Number(analytics?.kpis?.scans || 0);
  const validRate = Number(analytics?.kpis?.validRate || 0);
  const originals = Math.round((validRate / 100) * tapsTotal);
  const clones = Math.max(0, tapsTotal - originals);
  const points = (analytics?.geoPoints || []).map((point) => ({
    city: point.city,
    country: point.country || "--",
    lat: point.lat,
    lng: point.lng,
    scans: point.scans || 1,
    risk: point.risk || 0,
    status: (point.risk || 0) > 0 ? "RISK" : "AUTH_OK",
  }));
  const pendingMint = useMemo(
    () => (tokenization?.rows || []).find((row) => String(row.status || "").toLowerCase() === "pending"),
    [tokenization?.rows]
  );


  async function runDemoAction(path: string, success: string) {
    setBusy(true);
    setDemoActionStatus("");
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ ok: false, reason: "network_error" }));
    setBusy(false);
    if (!response?.ok) {
      setDemoActionStatus(`Demo action failed: ${String(response?.reason || "unknown_error")}`);
      return;
    }
    setDemoActionStatus(success);
    void loadData();
  }

  async function handleMassMint() {
    if (!pendingMint?.id) {
      setMintStatus("No hay requests pending para mint masivo.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/tokenization/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: pendingMint.id, network: "polygon-amoy" }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    setMintStatus(res?.ok ? `Mint ejecutado (${String(res.tx_hash || "sin tx")})` : `Mint falló (${String(res?.reason || "unknown_error")})`);
    void loadData();
  }

  function exportPdfReport() {
    if (typeof window === "undefined") return;
    const summaryRows = [
      ["Taps totales", String(tapsTotal)],
      ["Originales", String(originals)],
      ["Clones", String(clones)],
      ["Gas wallet (POL)", Number(wallet?.balancePol || 0).toFixed(3)],
      ["Security alerts", String(Number(security?.summary?.repeatedInvalidUid || 0) + Number(security?.summary?.geoVelocityAlerts || 0))],
      ["Reporte generado", new Date().toLocaleString("es-AR")],
    ];
    const topGeoRows = points.slice(0, 8).map((point) => `<tr><td>${point.city}</td><td>${point.country}</td><td>${point.scans}</td><td>${point.status}</td></tr>`).join("");
    const topAlerts = [
      ...(security?.repeatedInvalidUid || []).slice(0, 5).map((item) => `UID ${item.uidHex}: ${item.count} inválidos (${item.severity})`),
      ...(security?.geoVelocityAlerts || []).slice(0, 5).map((item) => `UID ${item.uidHex}: ${item.fromCountry} → ${item.toCountry} (${item.severity})`),
    ];
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Nexid Ops Report</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a}
        h1,h2{margin:0 0 10px}
        .card{border:1px solid #cbd5e1;border-radius:12px;padding:14px;margin:12px 0}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px}
        .muted{color:#475569;font-size:12px}
      </style></head><body>
      <h1>Nexid · Reporte operativo</h1>
      <p class="muted">Snapshot multirubro para exportación PDF.</p>
      <section class="card"><h2>KPIs</h2><table><tbody>${summaryRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</tbody></table></section>
      <section class="card"><h2>Geo hubs (top)</h2>
        ${points.length ? `<table><thead><tr><th>Ciudad</th><th>País</th><th>Scans</th><th>Status</th></tr></thead><tbody>${topGeoRows}</tbody></table>` : `<p class="muted">Sin hubs visibles para esta ventana.</p>`}
      </section>
      <section class="card"><h2>Alertas críticas</h2>
        ${topAlerts.length ? `<ul>${topAlerts.map((row) => `<li>${row}</li>`).join("")}</ul>` : `<p class="muted">Sin alertas críticas en la ventana actual.</p>`}
      </section>
    </body></html>`;
    const popup = window.open("", "_blank", "noopener,noreferrer,width=980,height=760");
    if (!popup) {
      window.print();
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }


  function runBotAnalysis() {
    const q = botQuestion.toLowerCase();
    const replay = Number(security?.summary?.repeatedInvalidUid || 0);
    const geo = Number(security?.summary?.geoVelocityAlerts || 0);
    const riskRate = tapsTotal ? (((replay + geo) / tapsTotal) * 100).toFixed(1) : "0.0";
    const ts = lastSyncAt ? new Date(lastSyncAt).toLocaleString("es-AR") : "sin sync";
    if (q.includes("riesgo")) {
      setBotAnswer(`Riesgo actual ${riskRate}% (replay:${replay}, geo-alerts:${geo}). Frescura: ${ts}. Siguiente paso: revisar Events filtrando REPLAY_SUSPECT y abrir ticket crítico si supera 5%.`);
      return;
    }
    if (q.includes("replay")) {
      setBotAnswer(`Se detectaron ${replay} replays en la ventana. Recomendado: validar sample URLs y ejecutar simulate-tap para confirmar pipeline de detección.`);
      return;
    }
    setBotAnswer(`Scope tenant/demo. Última sync: ${ts}. KPI clave: scans ${tapsTotal}, validRate ${validRate}%.`);
  }

  return (
    <OpsPanel title="Nexid Dashboard · Multirubro" subtitle="Business Intelligence para Vinos, Cosmética, Documentos y Semillas (dark premium + data refresh).">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps totales<br /><b className="text-cyan-200">{tapsTotal}</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Originales vs Clones<br /><b className="text-emerald-200">{originals}</b> / <b className="text-rose-200">{clones}</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Gas wallet Polygon<br /><b className="text-amber-200">{Number(wallet?.balancePol || 0).toFixed(3)} POL</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Security alerts<br /><b className="text-rose-200">{Number(security?.summary?.repeatedInvalidUid || 0) + Number(security?.summary?.geoVelocityAlerts || 0)}</b></div>
      </motion.div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {demoDataMode ? <StatusChip label="DEMO DATA" tone="warn" /> : null}
        <StatusChip
          label={`stream ${streamState}`}
          tone={streamState === "connected" ? "good" : streamState === "stale" ? "warn" : "risk"}
        />
        <span id="nexid-live-pulse" className="inline-flex h-2 w-2 rounded-full bg-cyan-300" />
        <span className="text-slate-400">Última sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString("es-AR") : "—"}</span>
        <span className="text-slate-500">Último evento: {lastEventAt ? new Date(lastEventAt).toLocaleTimeString("es-AR") : "—"}</span>
        <span className="text-slate-500">
          Pipeline: {diagnostics?.freshness?.streamState || "unknown"} · eventos {Number(diagnostics?.counters?.eventsTotal || 0)}
        </span>
        <span className="text-slate-500">Risk {Number(diagnostics?.counters?.riskEvents || 0)} · Replay {Number(diagnostics?.counters?.replayEvents || 0)}</span>
      </div>
      {warnings.length ? (
        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-semibold">Operación degradada (datos reales incompletos)</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <WorldMapRealtime title="Heatmap de taps en tiempo real" subtitle="Mercados grises, zonas de fraude y expansión comercial por geolocalización." points={points} initialExpanded />
      </div>
      {!points.length ? (
        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          <p className="font-semibold">Sin puntos en el heatmap todavía.</p>
          <p className="mt-1 text-cyan-50/90">Podés generar actividad demo para validar KPI, feed y mapa en menos de 30s.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => void runDemoAction('/api/internal/demo/seed', 'Seed demo ejecutada correctamente.')} disabled={busy} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60">Seed demo</button>
            <button onClick={() => void runDemoAction('/api/internal/demo/generate-live-scans', 'Scans demo generados.')} disabled={busy} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60">Generate live scans</button>
            <button onClick={() => void runDemoAction('/api/internal/demo/simulate-tap', 'Tap simulado correctamente.')} disabled={busy} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60">Simulate tap</button>
          </div>
          {demoActionStatus ? <p className="mt-2 text-[11px] text-cyan-100">{demoActionStatus}</p> : null}
        </div>
      ) : null}


      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Scans vs duplicados (trend)</p>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="scans" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="duplicates" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Tamper / duplicados por día</p>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Bar dataKey="duplicates" fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="tamper" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">BotIA operativo (tenant scope)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={botQuestion} onChange={(e) => setBotQuestion(e.target.value)} className="min-w-[260px] flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100" />
          <button onClick={runBotAnalysis} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Analizar</button>
        </div>
        {botAnswer ? <p className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">{botAnswer}</p> : null}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Alert center (realtime)</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="text-slate-400">Severity
              <select value={alertSeverityFilter} onChange={(event) => setAlertSeverityFilter(event.target.value)} className="ml-1 rounded border border-white/10 bg-slate-950 px-2 py-1 text-slate-100">
                <option value="">all</option>
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>
            <label className="text-slate-400">Type
              <select value={alertTypeFilter} onChange={(event) => setAlertTypeFilter(event.target.value)} className="ml-1 rounded border border-white/10 bg-slate-950 px-2 py-1 text-slate-100">
                <option value="">all</option>
                <option value="replay_spike">replay_spike</option>
                <option value="tamper_rate">tamper_rate</option>
                <option value="invalid_rate">invalid_rate</option>
                <option value="geo_velocity">geo_velocity</option>
                <option value="new_country_for_uid">new_country_for_uid</option>
              </select>
            </label>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          {alerts.length ? alerts.slice(0, 12).map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-rose-200">{item.title || item.type}</span>
                <span className="text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleTimeString("es-AR") : "n/a"}</span>
              </div>
              <p className="mt-1 text-slate-400">{item.type} · {item.severity} · {item.status} · tenant {item.tenant_slug || "n/a"}</p>
            </div>
          )) : (
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">Sin alertas para los filtros seleccionados.</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Live event feed</p>
        <div className="mt-2 space-y-2">
          {liveFeed.length ? liveFeed.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-cyan-200">{item.result}</span>
                <span className="text-slate-400">{new Date(item.at).toLocaleTimeString("es-AR")}</span>
              </div>
              <p className="mt-1 text-slate-300">{item.reason}</p>
              <p className="mt-1 text-slate-500">Tenant {item.tenant} · BID {item.bid} · UID {item.uid} · {item.city}/{item.country}</p>
              <p className="mt-1 text-[11px] text-slate-500">trace {item.requestId} · latency {item.streamLatencyMs == null ? "n/a" : `${item.streamLatencyMs}ms`}</p>
            </div>
          )) : (
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">Sin eventos en vivo todavía para esta sesión.</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Plantillas de metadatos por rubro</p>
          <div className="mt-2 grid gap-2">
            {METADATA_TEMPLATES.map((template) => (
              <div key={template.vertical} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex items-center gap-3"><VerticalAsset vertical={template.vertical} size="sm" /><p className="font-semibold text-white">{template.vertical}</p></div>
                <p className="text-slate-400">{template.fields.join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Eventos de seguridad</p>
          <div className="mt-2 space-y-2 text-xs">
            {(security?.repeatedInvalidUid || []).slice(0, 3).map((item) => (
              <div key={`invalid-${item.uidHex}`} className="rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-rose-100">
                UID {item.uidHex} reportó {item.count} SUN inválidos.
              </div>
            ))}
            {(security?.geoVelocityAlerts || []).slice(0, 3).map((item) => (
              <div key={`geo-${item.uidHex}`} className="rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-rose-100">
                UID {item.uidHex} cambió de {item.fromCountry} a {item.toCountry} en &lt; 1h.
              </div>
            ))}
            {!security?.repeatedInvalidUid?.length && !security?.geoVelocityAlerts?.length ? (
              <p className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-emerald-100">Sin alertas críticas en la ventana actual.</p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => void handleMassMint()} disabled={busy} className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-60">
              {busy ? "Ejecutando mint..." : "Mint Masivo (control calidad OK)"}
            </button>
            <button onClick={exportPdfReport} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-200">Exportar reporte PDF</button>
            <StatusChip label={wallet?.mode || "simulated"} tone={wallet?.mode === "live" ? "good" : "warn"} />
          </div>
          {mintStatus ? <p className="mt-2 text-xs text-slate-300">{mintStatus}</p> : null}
          {wallet?.warning ? <p className="mt-1 text-[11px] text-amber-200">{wallet.warning}</p> : null}
        </div>
      </div>
    </OpsPanel>
  );
}
