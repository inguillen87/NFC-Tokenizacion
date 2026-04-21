"use client";

import { useEffect, useMemo, useState } from "react";
import { OpsPanel, StatusChip, WorldMapPlaceholder } from "@product/ui";

type AnalyticsPayload = {
  ok?: boolean;
  reason?: string;
  kpis?: { scans?: number; validRate?: number };
  geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>;
};

type SecurityPayload = {
  ok?: boolean;
  reason?: string;
  summary?: { repeatedInvalidUid?: number; geoVelocityAlerts?: number };
  repeatedInvalidUid?: Array<{ uidHex: string; count: number; severity: string }>;
  geoVelocityAlerts?: Array<{ uidHex: string; fromCountry: string; toCountry: string; severity: string }>;
};

type TokenizationPayload = {
  ok?: boolean;
  reason?: string;
  rows?: Array<{ id: string; bid: string; uid_hex: string; status: string; network?: string; tx_hash?: string | null; token_id?: string | null }>;
};

type WalletPayload = { ok?: boolean; reason?: string; balancePol?: number; mode?: string; warning?: string };

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
  const [busy, setBusy] = useState(false);
  const [mintStatus, setMintStatus] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, { cache: "no-store" });
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

  async function loadData() {
    const [a, s, t, w] = await Promise.all([
      fetchJson<AnalyticsPayload>("/api/admin/analytics?range=24h"),
      fetchJson<SecurityPayload>("/api/admin/security-alerts?hours=24"),
      fetchJson<TokenizationPayload>("/api/admin/tokenization/requests?limit=20"),
      fetchJson<WalletPayload>("/api/admin/polygon/wallet"),
    ]);
    const nextWarnings = [a?.reason, s?.reason, t?.reason, w?.reason].filter(Boolean) as string[];
    setWarnings(Array.from(new Set(nextWarnings)));
    setAnalytics(a);
    setSecurity(s);
    setTokenization(t);
    setWallet(w);
  }

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 20_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;
    let stream: EventSource | null = null;

    const connect = () => {
      if (!active || typeof window === "undefined") return;
      stream = new EventSource("/api/admin/events/stream?limit=8");
      stream.addEventListener("snapshot", () => {
        if (!active) return;
        void loadData();
      });
      stream.onerror = () => {
        if (stream) stream.close();
        if (!active) return;
        reconnectTimer = window.setTimeout(connect, 7000);
      };
    };

    connect();
    return () => {
      active = false;
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

  return (
    <OpsPanel title="Nexid Dashboard · Multirubro" subtitle="Business Intelligence para Vinos, Cosmética, Documentos y Semillas (dark premium + data refresh).">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps totales<br /><b className="text-cyan-200">{tapsTotal}</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Originales vs Clones<br /><b className="text-emerald-200">{originals}</b> / <b className="text-rose-200">{clones}</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Gas wallet Polygon<br /><b className="text-amber-200">{Number(wallet?.balancePol || 0).toFixed(3)} POL</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Security alerts<br /><b className="text-rose-200">{Number(security?.summary?.repeatedInvalidUid || 0) + Number(security?.summary?.geoVelocityAlerts || 0)}</b></div>
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
        <WorldMapPlaceholder title="Heatmap de taps en tiempo real" subtitle="Mercados grises, zonas de fraude y expansión comercial por geolocalización." points={points} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Plantillas de metadatos por rubro</p>
          <div className="mt-2 grid gap-2">
            {METADATA_TEMPLATES.map((template) => (
              <div key={template.vertical} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
                <p className="font-semibold text-white">{template.vertical}</p>
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
