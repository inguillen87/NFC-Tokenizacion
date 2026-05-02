"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@product/ui";

type TokenizationRow = {
  id: string;
  bid: string;
  uid_hex: string;
  status: string;
  network?: string;
  issuer_wallet?: string | null;
  tx_hash?: string | null;
  token_id?: string | null;
  anchor_hash?: string | null;
  requested_at?: string;
  processed_at?: string | null;
  attempt_count?: number;
  last_error?: string | null;
  tenant_slug?: string | null;
};

type PolygonReadiness = {
  ready?: boolean;
  mode?: string;
  network?: string;
  autoTokenize?: boolean;
  useLocalMinter?: boolean;
  chainId?: string | null;
  executor?: { configured?: boolean; url?: string | null; secretConfigured?: boolean };
  contract?: { address?: string | null; deployed?: boolean };
  minter?: { address?: string | null; configured?: boolean; balancePol?: number | null };
  recipient?: { address?: string | null; balancePol?: number | null };
  checks?: Array<{ key: string; label: string; status: "pass" | "warn" | "fail"; detail?: string }>;
};

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, reason: "invalid json", raw: text };
  }
}

export function TokenizationQueuePanel() {
  const [rows, setRows] = useState<TokenizationRow[]>([]);
  const [pending, setPending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "failed" | "anchored">("all");
  const [status, setStatus] = useState("Cargando tokenization queue...");
  const [lastResponse, setLastResponse] = useState("{}");
  const [readiness, setReadiness] = useState<PolygonReadiness | null>(null);
  const apiRunway = [
    { method: "GET", path: "/admin/tokenization/requests", body: "Listar requests por estado y tenant." },
    { method: "POST", path: "/admin/tokenization/requests", body: "Procesar mint/anclaje en modo simulado o Amoy." },
    { method: "POST", path: "/public/cta/tokenize-request", body: "Crear request desde passport publico." },
    { method: "GET", path: "/public/proof/summary", body: "Probar la trazabilidad publica sin exponer datos sensibles." },
  ];

  async function load() {
    setPending(true);
    try {
      const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}&limit=120`;
      const response = await fetch(`/api/admin/tokenization/requests${query}`, { cache: "no-store" });
      const data = await parseJsonSafe(response);
      setLastResponse(JSON.stringify(data, null, 2));
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "load failed"));
      setRows(Array.isArray(data.rows) ? data.rows as TokenizationRow[] : []);
      setStatus(`Queue cargada: ${Array.isArray(data.rows) ? data.rows.length : 0} requests.`);
    } catch (error) {
      setRows([]);
      setStatus(error instanceof Error ? error.message : "failed to load queue");
    } finally {
      setPending(false);
    }
  }

  async function loadReadiness() {
    try {
      const response = await fetch("/api/admin/polygon/wallet", { cache: "no-store" });
      const data = await parseJsonSafe(response);
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "polygon readiness failed"));
      setReadiness(data as PolygonReadiness);
    } catch {
      setReadiness(null);
    }
  }

  async function processRequest(requestId: string) {
    setPending(true);
    setStatus(`Procesando request ${requestId.slice(0, 8)}...`);
    try {
      const response = await fetch("/api/admin/tokenization/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await parseJsonSafe(response);
      setLastResponse(JSON.stringify(data, null, 2));
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "tokenization process failed"));
      setStatus(`Request ${requestId.slice(0, 8)} anclada correctamente.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "process failed");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load();
    void loadReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counters = useMemo(() => {
    const total = rows.length;
    const pendingCount = rows.filter((row) => row.status === "pending").length;
    const processingCount = rows.filter((row) => row.status === "processing").length;
    const failedCount = rows.filter((row) => row.status === "failed").length;
    const anchoredCount = rows.filter((row) => row.status === "anchored").length;
    return { total, pendingCount, processingCount, failedCount, anchoredCount };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tokenization queue</h2>
            <p className="mt-1 text-xs text-slate-400">Fase 2.5: monitoreo + retry operativo sobre requests de tokenización.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "processing", "failed", "anchored"] as const).map((item) => (
              <button suppressHydrationWarning
                key={item}
                type="button"
                className={`rounded-lg border px-2 py-1 text-xs ${statusFilter === item ? "border-cyan-300/35 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`}
                onClick={() => setStatusFilter(item)}
              >
                {item}
              </button>
            ))}
            <Button disabled={pending} onClick={() => void load()}>Refresh</Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-200 md:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">Total: <b>{counters.total}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">Pending: <b>{counters.pendingCount}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">Processing: <b>{counters.processingCount}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">Failed: <b>{counters.failedCount}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">Anchored: <b>{counters.anchoredCount}</b></div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">Blockchain sandbox runway</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              El flujo recomendado para demo mundial: tap valido, request de tokenizacion, mint en Polygon Amoy y link de prueba al passport.
            </p>
            <div className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-4">
              {["Tap SUN", "Queue", "Mint", "Proof"].map((step, index) => (
                <div key={step} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Step {index + 1}</span>
                  <p className="mt-1 font-semibold text-white">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Mode</p>
              <p className="mt-1 font-semibold text-white">simulated / amoy</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Chain</p>
              <p className="mt-1 font-semibold text-cyan-100">Polygon Amoy</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Asset</p>
              <p className="mt-1 font-semibold text-emerald-100">Digital Twin NFT</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">Polygon Amoy readiness</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Diagnostico operativo para saber si manana solo falta pegar RPC, wallet minter, contrato y redeploy.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${readiness?.ready ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-amber-300/35 bg-amber-500/10 text-amber-100"}`}>
            {readiness?.ready ? "ready" : readiness ? "needs env" : "offline"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-slate-200 md:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Mode</p>
            <p className="mt-1 font-semibold text-white">{readiness?.mode || "unknown"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Auto SUN</p>
            <p className="mt-1 font-semibold text-white">{readiness?.autoTokenize ? "on" : "off"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Signer</p>
            <p className="mt-1 font-semibold text-white">{readiness?.executor?.configured ? "executor" : readiness?.useLocalMinter ? "local" : "pending"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Contract</p>
            <p className="mt-1 font-semibold text-white">{readiness?.contract?.deployed ? "deployed" : readiness?.contract?.address ? "configured" : "pending"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Minter gas</p>
            <p className="mt-1 font-semibold text-white">{typeof readiness?.minter?.balancePol === "number" ? `${readiness.minter.balancePol.toFixed(5)} POL` : "pending"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(readiness?.checks || []).map((item) => (
            <div key={item.key} className={`rounded-xl border p-3 text-xs ${item.status === "pass" ? "border-emerald-300/20 bg-emerald-500/10" : item.status === "warn" ? "border-amber-300/20 bg-amber-500/10" : "border-rose-300/20 bg-rose-500/10"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{item.label}</p>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-200">{item.status}</span>
              </div>
              {item.detail ? <p className="mt-1 text-slate-400">{item.detail}</p> : null}
            </div>
          ))}
          {!readiness ? <p className="text-xs text-slate-400">No se pudo cargar readiness. Revisa API/admin proxy.</p> : null}
        </div>
        <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs leading-5 text-cyan-100">
          Comando local equivalente: <code>cd apps/api && npm run tokenization:check</code>. El endpoint nunca devuelve private keys.
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">API web surface</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Endpoints clave para conectar portal, marketplace, wallet y automatizacion de tokenizacion sin salir del sandbox.
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">ready for demo</span>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {apiRunway.map((item) => (
            <div key={`${item.method}-${item.path}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 font-black text-emerald-100">{item.method}</span>
                <code className="text-cyan-100">{item.path}</code>
              </div>
              <p className="mt-2 text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-xs text-cyan-100">{status}</p>
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><b>{row.bid}</b> · {row.uid_hex} · <span className="text-cyan-200">{row.status}</span></p>
                <div className="flex gap-2">
                  {row.status === "failed" ? (
                    <button suppressHydrationWarning type="button" className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100" onClick={() => void processRequest(row.id)}>
                      Retry failed now
                    </button>
                  ) : null}
                  {row.status !== "anchored" ? (
                    <button suppressHydrationWarning type="button" className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100" onClick={() => void processRequest(row.id)}>
                      Mint now
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                tenant={row.tenant_slug || "-"} · network={row.network || "-"} · attempts={row.attempt_count || 0}
                {row.last_error ? ` · error=${row.last_error}` : ""}
              </p>
              {row.tx_hash ? <p className="mt-1 text-[11px] text-cyan-200">tx_hash={row.tx_hash}</p> : null}
            </div>
          ))}
          {!rows.length ? <p className="text-xs text-slate-400">Sin requests para este filtro.</p> : null}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Last API response</h3>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-slate-200">{lastResponse}</pre>
      </Card>
    </div>
  );
}
