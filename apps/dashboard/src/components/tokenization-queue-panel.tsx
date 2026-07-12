"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleOff,
  Clock3,
  ExternalLink,
  Fingerprint,
  FlaskConical,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@product/ui";

type QueueStatus = "pending" | "processing" | "failed" | "anchored" | "simulated" | "blocked";
type StatusFilter = "all" | QueueStatus;

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
  external_ref?: string | null;
  requested_at?: string;
  processed_at?: string | null;
  attempt_count?: number;
  last_error?: string | null;
  tenant_slug?: string | null;
  meta?: Record<string, unknown> | null;
};

type ReadinessCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
};

type PolygonReadiness = {
  ready?: boolean;
  chainReady?: boolean;
  mode?: string;
  network?: string;
  autoTokenize?: boolean;
  useLocalMinter?: boolean;
  chainId?: string | null;
  executor?: { configured?: boolean; url?: string | null; secretConfigured?: boolean };
  contract?: { address?: string | null; deployed?: boolean };
  minter?: { address?: string | null; configured?: boolean; balancePol?: number | null };
  recipient?: { address?: string | null; balancePol?: number | null };
  checks?: ReadinessCheck[];
};

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "En cola" },
  { key: "processing", label: "Procesando" },
  { key: "failed", label: "Con error" },
  { key: "anchored", label: "Confirmados" },
  { key: "simulated", label: "Simulados" },
  { key: "blocked", label: "Bloqueados" },
];

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, reason: "invalid_json", raw: text };
  }
}

function shorten(value: string | null | undefined, start = 10, end = 8) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  if (normalized.length <= start + end + 3) return normalized;
  return `${normalized.slice(0, start)}...${normalized.slice(-end)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin procesar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin procesar";
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function polygonExplorerUrl(network?: string, txHash?: string | null) {
  if (!txHash) return null;
  const normalized = String(network || "").toLowerCase();
  if (normalized.includes("amoy")) return `https://amoy.polygonscan.com/tx/${encodeURIComponent(txHash)}`;
  if (normalized.includes("polygon")) return `https://polygonscan.com/tx/${encodeURIComponent(txHash)}`;
  return null;
}

function normalizeStatus(value: string): QueueStatus {
  const normalized = String(value || "").toLowerCase();
  if (["pending", "processing", "failed", "anchored", "simulated", "blocked"].includes(normalized)) return normalized as QueueStatus;
  return "pending";
}

function statusDescriptor(status: QueueStatus) {
  if (status === "anchored") return { label: "On-chain confirmado", tone: "emerald", icon: CheckCircle2 } as const;
  if (status === "simulated") return { label: "Simulación sin tx", tone: "violet", icon: FlaskConical } as const;
  if (status === "processing") return { label: "Procesando", tone: "cyan", icon: LoaderCircle } as const;
  if (status === "failed") return { label: "Requiere revisión", tone: "rose", icon: AlertTriangle } as const;
  if (status === "blocked") return { label: "Bloqueado por política", tone: "amber", icon: CircleOff } as const;
  return { label: "En cola", tone: "slate", icon: Clock3 } as const;
}

function statusClass(tone: ReturnType<typeof statusDescriptor>["tone"]) {
  if (tone === "emerald") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (tone === "violet") return "border-violet-300/25 bg-violet-500/10 text-violet-100";
  if (tone === "cyan") return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
  if (tone === "rose") return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  if (tone === "amber") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

export function TokenizationQueuePanel({ canWrite = true, tenantSlug = "" }: { canWrite?: boolean; tenantSlug?: string }) {
  const [rows, setRows] = useState<TokenizationRow[]>([]);
  const [pending, setPending] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("Sincronizando estado operativo...");
  const [lastResponse, setLastResponse] = useState("{}");
  const [readiness, setReadiness] = useState<PolygonReadiness | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    try {
      const query = new URLSearchParams({ limit: "120" });
      if (tenantSlug) query.set("tenant", tenantSlug);
      if (statusFilter !== "all") query.set("status", statusFilter);
      const response = await fetch(`/api/admin/tokenization/requests?${query.toString()}`, { cache: "no-store" });
      const data = await parseJsonSafe(response);
      setLastResponse(JSON.stringify(data, null, 2));
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "No se pudo cargar la cola"));
      const nextRows = Array.isArray(data.rows) ? data.rows as TokenizationRow[] : [];
      setRows(nextRows);
      setMessage(`${nextRows.length} solicitudes visibles en el alcance actual.`);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la cola");
    } finally {
      setPending(false);
    }
  }, [statusFilter, tenantSlug]);

  const loadReadiness = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/polygon/wallet", { cache: "no-store" });
      const data = await parseJsonSafe(response);
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "readiness_failed"));
      setReadiness(data as PolygonReadiness);
    } catch {
      setReadiness(null);
    }
  }, []);

  async function processRequest(requestId: string) {
    setPending(true);
    setActiveRequestId(requestId);
    setMessage(`Procesando ${requestId.slice(0, 8)}...`);
    try {
      const response = await fetch("/api/admin/tokenization/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await parseJsonSafe(response);
      setLastResponse(JSON.stringify(data, null, 2));
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "No se pudo procesar la solicitud"));
      await Promise.all([load(), loadReadiness()]);
      setMessage(data.status === "simulated"
        ? "Simulación completada sin crear transacción ni token."
        : "Recibo Polygon confirmado y asociado al producto.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo procesar la solicitud");
    } finally {
      setPending(false);
      setActiveRequestId(null);
    }
  }

  useEffect(() => {
    void Promise.all([load(), loadReadiness()]);
  }, [load, loadReadiness]);

  const counters = useMemo(() => {
    const counts: Record<QueueStatus | "total", number> = {
      total: rows.length,
      pending: 0,
      processing: 0,
      failed: 0,
      anchored: 0,
      simulated: 0,
      blocked: 0,
    };
    rows.forEach((row) => { counts[normalizeStatus(row.status)] += 1; });
    return counts;
  }, [rows]);

  const mode = String(readiness?.mode || "unavailable").toLowerCase();
  const polygonLive = mode === "polygon" && readiness?.chainReady === true;
  const simulationMode = mode === "simulated";
  const disabledMode = mode === "disabled" || mode === "off";
  const actionAllowed = canWrite && !disabledMode && (simulationMode || polygonLive);
  const modeLabel = polygonLive ? "Polygon Amoy operativo" : simulationMode ? "Simulación explícita" : disabledMode ? "Tokenization deshabilitada" : mode === "polygon" ? "Polygon incompleto" : "Estado no disponible";
  const modeBody = polygonLive
    ? "Cada mint requiere contrato desplegado, signer autorizado y evidencia confirmada en chain 80002."
    : simulationMode
      ? "Sirve para ensayar la operación. Guarda una referencia interna, pero no crea tx hash, token ID ni explorer."
      : disabledMode
        ? "El runtime falla cerrado. Ninguna solicitud se presenta como blockchain hasta que un operador habilite un modo."
        : "La consola no habilita acciones hasta recuperar y validar el estado del runtime.";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_.9fr]">
          <div className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Runtime control</p>
                <h2 className="mt-1 text-2xl font-black text-white">{modeLabel}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{modeBody}</p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${polygonLive ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : simulationMode ? "border-violet-300/25 bg-violet-500/10 text-violet-100" : "border-amber-300/25 bg-amber-500/10 text-amber-100"}`}>
                <span className={`h-2 w-2 rounded-full ${polygonLive ? "bg-emerald-300" : simulationMode ? "bg-violet-300" : "bg-amber-300"}`} />
                {mode || "offline"}
              </span>
            </div>

            <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
              <RuntimeMetric label="Network" value={polygonLive ? "Amoy 80002" : simulationMode ? "Sin chain" : "No activa"} />
              <RuntimeMetric label="Contrato" value={readiness?.contract?.deployed ? "Verificado" : readiness?.contract?.address ? "Sin bytecode" : "No configurado"} />
              <RuntimeMetric label="Signer" value={readiness?.executor?.configured ? "Executor" : readiness?.useLocalMinter ? "Local" : "No disponible"} />
              <RuntimeMetric label="Gas" value={typeof readiness?.minter?.balancePol === "number" ? `${readiness.minter.balancePol.toFixed(4)} POL` : "No informado"} />
            </div>
          </div>

          <div className="p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Regla de producto</p>
            <div className="mt-3 space-y-3">
              <FlowRule icon={Fingerprint} title="nexID decide elegibilidad" body="Tap válido, tenant, lote, ownership y política de canal." />
              <FlowRule icon={ShieldCheck} title="IOTA conserva evidencia" body="Merkle root hash-only para auditoría de hitos; no representa propiedad." />
              <FlowRule icon={Boxes} title="Polygon registra ownership" body="Mint o transferencia opcional con recibo real y owner verificable." />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Queue por tenant</p>
            <h2 className="mt-1 text-xl font-black text-white">Solicitudes y recibos</h2>
            <p className="mt-1 text-sm text-slate-400">{message}</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void Promise.all([load(), loadReadiness()])}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
            Actualizar
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <QueueCounter label="Total" value={counters.total} />
          <QueueCounter label="En cola" value={counters.pending + counters.processing} />
          <QueueCounter label="Confirmados" value={counters.anchored} tone="emerald" />
          <QueueCounter label="Simulados" value={counters.simulated} tone="violet" />
          <QueueCounter label="Con error" value={counters.failed} tone="rose" />
          <QueueCounter label="Bloqueados" value={counters.blocked} tone="amber" />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar solicitudes">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={statusFilter === item.key}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition ${statusFilter === item.key ? "border-cyan-300/35 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-transparent text-slate-400 hover:text-white"}`}
              onClick={() => setStatusFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-slate-950/35">
          {rows.map((row) => (
            <QueueRow
              key={row.id}
              row={row}
              canProcess={actionAllowed}
              pending={pending && activeRequestId === row.id}
              runtimeMode={mode}
              onProcess={processRequest}
            />
          ))}
          {!rows.length ? (
            <div className="grid min-h-36 place-items-center p-6 text-center">
              <div>
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-200" aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-white">No hay solicitudes en este filtro</p>
                <p className="mt-1 text-xs text-slate-400">Cambia el estado o genera una solicitud desde un tap elegible.</p>
              </div>
            </div>
          ) : null}
        </div>

        {!canWrite ? (
          <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">Tu perfil puede auditar la cola, pero no ejecutar mint ni simulaciones.</p>
        ) : null}
        {canWrite && !actionAllowed ? (
          <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">Las acciones están deshabilitadas hasta que el runtime sea una simulación explícita o Polygon Amoy esté completamente verificado.</p>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Readiness técnico</p>
            <h2 className="mt-1 text-xl font-black text-white">Controles antes de operar</h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">sin secretos en UI</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(readiness?.checks || []).map((item) => <ReadinessRow key={item.key} item={item} />)}
          {!readiness ? <p className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-xs text-rose-100">No se pudo consultar el runtime. Las acciones permanecen cerradas.</p> : null}
        </div>

        <details className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
          <summary className="cursor-pointer font-black text-slate-100">Respuesta técnica de la última operación</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-5">{lastResponse}</pre>
        </details>
      </Card>
    </div>
  );
}

function RuntimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-slate-950/75 p-3">
      <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</span>
      <strong className="mt-1 block break-words text-xs text-white">{value}</strong>
    </div>
  );
}

function FlowRule({ icon: Icon, title, body }: { icon: typeof Fingerprint; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-100"><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div>
        <b className="block text-sm text-white">{title}</b>
        <p className="mt-0.5 text-xs leading-5 text-slate-400">{body}</p>
      </div>
    </div>
  );
}

function QueueCounter({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "emerald" | "violet" | "rose" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-200" : tone === "violet" ? "text-violet-200" : tone === "rose" ? "text-rose-200" : tone === "amber" ? "text-amber-200" : "text-white";
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <strong className={`block text-xl ${toneClass}`}>{value}</strong>
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
    </div>
  );
}

function QueueRow({
  row,
  canProcess,
  pending,
  runtimeMode,
  onProcess,
}: {
  row: TokenizationRow;
  canProcess: boolean;
  pending: boolean;
  runtimeMode: string;
  onProcess: (requestId: string) => Promise<void>;
}) {
  const status = normalizeStatus(row.status);
  const descriptor = statusDescriptor(status);
  const StatusIcon = descriptor.icon;
  const explorerUrl = status === "anchored" ? polygonExplorerUrl(row.network, row.tx_hash) : null;
  const actionable = !["anchored", "processing"].includes(status);
  const actionLabel = status === "failed" ? "Reintentar" : status === "simulated" && runtimeMode === "polygon" ? "Promover a Polygon" : runtimeMode === "simulated" ? "Simular" : "Emitir en Polygon";

  return (
    <article className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.8fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.11em] ${statusClass(descriptor.tone)}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${status === "processing" || pending ? "animate-spin" : ""}`} aria-hidden="true" />
            {descriptor.label}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{row.tenant_slug || "tenant"}</span>
        </div>
        <h3 className="mt-2 break-words text-sm font-black text-white">Lote {row.bid || "sin BID"}</h3>
        <p className="mt-1 break-all font-mono text-[11px] text-slate-400">UID {shorten(row.uid_hex, 8, 6)} · Request {shorten(row.id, 8, 6)}</p>
      </div>

      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Network</dt>
          <dd className="mt-1 break-words font-semibold text-slate-200">{status === "simulated" ? "Sin blockchain" : row.network || "-"}</dd>
        </div>
        <div>
          <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Intentos</dt>
          <dd className="mt-1 font-semibold text-slate-200">{Number(row.attempt_count || 0)}</dd>
        </div>
        <div>
          <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Token ID</dt>
          <dd className="mt-1 break-all font-mono text-[11px] text-slate-300">{status === "simulated" ? "No creado" : shorten(row.token_id, 8, 6)}</dd>
        </div>
        <div>
          <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Procesado</dt>
          <dd className="mt-1 text-slate-300">{formatDate(row.processed_at)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {explorerUrl ? (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-100">
            Explorer <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
        {actionable ? (
          <button
            type="button"
            disabled={!canProcess || pending}
            onClick={() => void onProcess(row.id)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "failed" ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
            {pending ? "Procesando" : actionLabel}
          </button>
        ) : null}
        {status === "anchored" && !explorerUrl ? (
          <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 text-xs font-black text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Falta explorer
          </span>
        ) : null}
      </div>

      {row.last_error ? <p className="min-w-0 break-words text-xs leading-5 text-rose-200 lg:col-span-3">{row.last_error}</p> : null}
      {status === "simulated" && row.external_ref ? <p className="min-w-0 break-all font-mono text-[10px] text-violet-200 lg:col-span-3">Referencia interna: {row.external_ref}</p> : null}
    </article>
  );
}

function ReadinessRow({ item }: { item: ReadinessCheck }) {
  const Icon = item.status === "pass" ? CheckCircle2 : item.status === "fail" ? AlertTriangle : Clock3;
  const classes = item.status === "pass"
    ? "border-emerald-300/20 bg-emerald-500/[0.07] text-emerald-100"
    : item.status === "fail"
      ? "border-rose-300/20 bg-rose-500/[0.07] text-rose-100"
      : "border-amber-300/20 bg-amber-500/[0.07] text-amber-100";
  return (
    <div className={`grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border p-3 ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4" aria-hidden="true" />
      <div className="min-w-0">
        <b className="block text-xs text-white">{item.label}</b>
        {item.detail ? <p className="mt-1 break-words text-[11px] leading-5 opacity-75">{item.detail}</p> : null}
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.12em]">{item.status}</span>
    </div>
  );
}
