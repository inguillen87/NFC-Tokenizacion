"use client";

import { useEffect, useMemo, useState } from "react";
import { OpsPanel, StatusChip, WorldMapPlaceholder } from "@product/ui";

type AnalyticsPayload = {
  kpis?: { scans?: number; validRate?: number };
  geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>;
};

type SecurityPayload = {
  summary?: { repeatedInvalidUid?: number; geoVelocityAlerts?: number };
  repeatedInvalidUid?: Array<{ uidHex: string; count: number; severity: string }>;
  geoVelocityAlerts?: Array<{ uidHex: string; fromCountry: string; toCountry: string; severity: string }>;
};

type TokenizationPayload = {
  rows?: Array<{ id: string; bid: string; uid_hex: string; status: string; network?: string; tx_hash?: string | null; token_id?: string | null }>;
};

type WalletPayload = { balancePol?: number; mode?: string; warning?: string };

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

  async function loadData() {
    const [a, s, t, w] = await Promise.all([
      fetch("/api/admin/analytics?range=24h", { cache: "no-store" }).then((res) => res.json()).catch(() => null),
      fetch("/api/admin/security-alerts?hours=24", { cache: "no-store" }).then((res) => res.json()).catch(() => null),
      fetch("/api/admin/tokenization/requests?limit=20", { cache: "no-store" }).then((res) => res.json()).catch(() => null),
      fetch("/api/admin/polygon/wallet", { cache: "no-store" }).then((res) => res.json()).catch(() => null),
    ]);
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

  return (
    <OpsPanel title="Nexid Dashboard · Multirubro" subtitle="Business Intelligence para Vinos, Cosmética, Documentos y Semillas (dark premium + data refresh).">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Taps totales<br /><b className="text-cyan-200">{tapsTotal}</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Originales vs Clones<br /><b className="text-emerald-200">{originals}</b> / <b className="text-rose-200">{clones}</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Gas wallet Polygon<br /><b className="text-amber-200">{Number(wallet?.balancePol || 0).toFixed(3)} POL</b></div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">Security alerts<br /><b className="text-rose-200">{Number(security?.summary?.repeatedInvalidUid || 0) + Number(security?.summary?.geoVelocityAlerts || 0)}</b></div>
      </div>

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
            <button onClick={() => window.print()} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-200">Exportar reporte PDF</button>
            <StatusChip label={wallet?.mode || "simulated"} tone={wallet?.mode === "live" ? "good" : "warn"} />
          </div>
          {mintStatus ? <p className="mt-2 text-xs text-slate-300">{mintStatus}</p> : null}
          {wallet?.warning ? <p className="mt-1 text-[11px] text-amber-200">{wallet.warning}</p> : null}
        </div>
      </div>
    </OpsPanel>
  );
}
