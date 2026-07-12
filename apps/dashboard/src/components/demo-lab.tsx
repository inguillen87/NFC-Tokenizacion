"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { productUrls } from "@product/config";
import {
  ArrowUpRight,
  Beaker,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  Fingerprint,
  FlaskConical,
  Leaf,
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  TriangleAlert,
} from "lucide-react";

type DemoEvent = {
  id: string | number;
  created_at: string;
  result: string;
  uid_hex?: string;
  city?: string;
  source?: string;
};

type DemoSummary = {
  ok?: boolean;
  exists?: boolean;
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads?: number; tickets?: number; orders?: number };
  events?: DemoEvent[];
};

type ExecutionReceipt = {
  runId: string;
  scenario: string;
  mode: string;
  result: string;
  source: string;
  persisted: boolean;
  chainWrite: false;
  eventId?: string | number;
  startedAt: string;
  finishedAt: string;
};

type Scenario = {
  id: string;
  label: string;
  vertical: string;
  description: string;
  proof: string;
  href: string;
  icon: typeof FlaskConical;
};

const TENANT = "demobodega";
const BID = "DEMO-2026-02";
const RESET_CONFIRMATION = `RESET ${TENANT}/${BID}`;

const SCENARIOS: Scenario[] = [
  {
    id: "qr-gs1",
    label: "Secure Delivery",
    vertical: "wine",
    description: "Producto, lote, custodia y salida para cliente final.",
    proof: "Passport y trazabilidad nexID",
    href: "/demo-lab?scenario=qr-gs1",
    icon: PackageCheck,
  },
  {
    id: "offline-verifier",
    label: "Pharma Cold Chain",
    vertical: "pharma",
    description: "Unidad serializada, control offline y excepcion de cadena fria.",
    proof: "Evento sintetico, sin dato de paciente",
    href: "/demo-lab?scenario=offline-verifier",
    icon: Snowflake,
  },
  {
    id: "iota-proof",
    label: "Agro Stewardship",
    vertical: "agro",
    description: "Origen, canal autorizado, lectura de campo y politica de reclamo.",
    proof: "Recibo hash-only IOTA",
    href: "/demo-lab?scenario=iota-proof",
    icon: Leaf,
  },
  {
    id: "polygon-ownership",
    label: "Ownership Polygon",
    vertical: "wine",
    description: "Claim, garantia y gemelo transferible cuando la politica lo permite.",
    proof: "Certificado testnet separado del tap",
    href: "/demo-lab?scenario=polygon-ownership",
    icon: Boxes,
  },
];

async function requestDemo(endpoint: string, method = "GET", payload?: Record<string, unknown>) {
  const response = await fetch(`/api/internal/demo/${endpoint}`, {
    method,
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !data || data.ok === false) {
    throw new Error(String(data?.reason || `demo_request_failed_${response.status}`));
  }
  return { data, runId: response.headers.get("x-nexid-demo-run") || crypto.randomUUID() };
}

function resultTone(result: string) {
  const normalized = result.toUpperCase();
  if (normalized.includes("TAMPER")) return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  if (normalized.includes("REPLAY")) return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
}

function shortUid(uid?: string) {
  const value = String(uid || "");
  return value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value || "sin UID";
}

export function DemoLabControlCenter({
  canReset,
  canRun,
  tenantSlug,
}: {
  canReset: boolean;
  canRun: boolean;
  tenantSlug: string;
}) {
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [selectedId, setSelectedId] = useState(SCENARIOS[0]?.id || "qr-gs1");
  const [pendingMode, setPendingMode] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [resetText, setResetText] = useState("");
  const selected = useMemo(() => SCENARIOS.find((item) => item.id === selectedId) || SCENARIOS[0]!, [selectedId]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await requestDemo("summary");
      setSummary(data as DemoSummary);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el corpus demo.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const run = async (mode: "valid" | "replay" | "tamper") => {
    if (!canRun || pendingMode) return;
    const startedAt = new Date().toISOString();
    setPendingMode(mode);
    setError("");
    try {
      const { data, runId } = await requestDemo("simulate-tap", "POST", {
        tenant_slug: TENANT,
        bid: BID,
        mode,
        scenario: mode,
        vertical: selected.vertical,
        product_name: selected.label,
      });
      const execution = data.payload && typeof data.payload === "object"
        ? data.payload as Record<string, unknown>
        : data;
      const source = String(execution.source || data.source || "unknown");
      const result = String(execution.result || (execution.tap as { status?: string } | undefined)?.status || "UNKNOWN");
      const rawEventId = execution.event_id
        || (execution.dashboard_realtime as { event_id?: string | number } | undefined)?.event_id;
      const eventId = typeof rawEventId === "string" || typeof rawEventId === "number"
        ? rawEventId
        : undefined;
      setReceipt({
        runId,
        scenario: selected.label,
        mode,
        result,
        source,
        persisted: source === "demo",
        chainWrite: false,
        eventId,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La ejecucion demo fallo.");
    } finally {
      setPendingMode("");
    }
  };

  const reset = async () => {
    if (!canReset || resetText !== RESET_CONFIRMATION || pendingMode) return;
    setPendingMode("reset");
    setError("");
    try {
      await requestDemo("reset", "POST", { tenant_slug: TENANT, bid: BID, confirm: resetText });
      setReceipt(null);
      setResetText("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo resetear el corpus demo.");
    } finally {
      setPendingMode("");
    }
  };

  const events = summary?.events || [];
  const corpusReady = summary?.exists && summary?.batch?.bid === BID;

  return (
    <div className="space-y-5" data-testid="demo-mission-control">
      <section className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5" aria-label="Estado del entorno demo">
        <StatusCell label="Scope" value={tenantSlug === TENANT ? "Bodega Balmec" : tenantSlug} detail="Tenant de la sesion" />
        <StatusCell label="Corpus" value={corpusReady ? "Listo" : "No disponible"} detail={summary?.batch?.bid || BID} tone={corpusReady ? "ok" : "warn"} />
        <StatusCell label="Tags" value={String(summary?.tagCount ?? "-")} detail="Inventario demo" />
        <StatusCell label="Eventos" value={String(events.length)} detail="Solo source=demo" />
        <StatusCell label="Chain" value="Sin escritura" detail="IOTA/Polygon se verifican aparte" tone="neutral" />
      </section>

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-black">Demo no disponible</p><p className="mt-1 text-rose-100/75">{error}</p></div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]">
        <section className="min-w-0 space-y-4" aria-labelledby="demo-scenarios-title">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Escenario comercial</p>
              <h2 id="demo-scenarios-title" className="mt-1 text-xl font-black text-white">Elegir, ejecutar y explicar</h2>
            </div>
            <button type="button" onClick={() => void refresh()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-black text-slate-200 hover:border-cyan-300/35 hover:text-cyan-100">
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SCENARIOS.map((scenario) => {
              const Icon = scenario.icon;
              const active = scenario.id === selected.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(scenario.id)}
                  className={`min-h-36 rounded-lg border p-4 text-left transition ${active ? "border-cyan-300/45 bg-cyan-500/10 shadow-[inset_3px_0_0_#67e8f9]" : "border-white/10 bg-slate-950/35 hover:border-white/20"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-slate-950/55 text-cyan-200"><Icon className="h-5 w-5" /></span>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${active ? "border-cyan-300/30 text-cyan-100" : "border-white/10 text-slate-500"}`}>{scenario.vertical}</span>
                  </span>
                  <span className="mt-3 block text-base font-black text-white">{scenario.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-400">{scenario.description}</span>
                  <span className="mt-3 block text-xs font-bold text-cyan-200">{scenario.proof}</span>
                </button>
              );
            })}
          </div>

          <section className="border-t border-white/10 pt-4" aria-label="Ejecutar escenario seleccionado">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Ejecucion controlada</p>
                <h3 className="mt-1 text-lg font-black text-white">{selected.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">Estas acciones generan una lectura demo. No publican IOTA, no mintean Polygon y no representan un tap fisico.</p>
              </div>
              <a href={`${productUrls.web}${selected.href}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-100 hover:bg-cyan-500/15">
                Abrir experiencia publica <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <RunButton icon={ShieldCheck} label="Tap valido" tone="emerald" pending={pendingMode === "valid"} disabled={!canRun || Boolean(pendingMode)} onClick={() => void run("valid")} />
              <RunButton icon={RotateCcw} label="Replay" tone="amber" pending={pendingMode === "replay"} disabled={!canRun || Boolean(pendingMode)} onClick={() => void run("replay")} />
              <RunButton icon={ShieldAlert} label="Tamper" tone="rose" pending={pendingMode === "tamper"} disabled={!canRun || Boolean(pendingMode)} onClick={() => void run("tamper")} />
            </div>
            {!canRun ? <p className="mt-3 text-xs text-amber-200">Tu rol tiene lectura del Demo Lab, pero no permiso demo:run.</p> : null}
          </section>
        </section>

        <aside className="min-w-0 border-l-0 border-white/10 xl:border-l xl:pl-5" aria-label="Recibo y actividad demo">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-500/10 text-cyan-100"><Fingerprint className="h-5 w-5" /></span>
            <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Execution receipt</p><h2 className="text-lg font-black text-white">Verdad de la corrida</h2></div>
          </div>

          {receipt ? (
            <div className="mt-4 space-y-3" data-testid="demo-execution-receipt">
              <div className={`rounded-lg border p-4 ${resultTone(receipt.result)}`}>
                <div className="flex items-center justify-between gap-3"><span className="font-black">{receipt.result}</span><CheckCircle2 className="h-5 w-5" /></div>
                <p className="mt-2 text-xs opacity-75">{receipt.scenario} / {receipt.mode}</p>
              </div>
              <ReceiptRow label="Run ID" value={receipt.runId} mono />
              <ReceiptRow label="Fuente" value={receipt.source} />
              <ReceiptRow label="Persistencia" value={receipt.persisted ? "Evento demo persistido" : "Memoria efimera"} />
              <ReceiptRow label="Blockchain" value="No hubo escritura on-chain" />
              <ReceiptRow label="Event ID" value={String(receipt.eventId || "no emitido")} mono />
              <ReceiptRow label="Finalizo" value={new Date(receipt.finishedAt).toLocaleString("es-AR")} />
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-slate-950/25 p-5 text-sm text-slate-400">
              <Clock3 className="h-5 w-5 text-slate-500" />
              <p className="mt-3 font-bold text-slate-200">Todavia no hay corrida en esta sesion.</p>
              <p className="mt-1 leading-6">Ejecuta un estado para obtener fuente, persistencia, resultado y referencia operativa.</p>
            </div>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Ultimos eventos demo</p><span className="text-xs font-bold text-slate-500">{events.length}</span></div>
            <div className="mt-3 space-y-2">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/8 py-2.5 last:border-0">
                  <span className={`h-2.5 w-2.5 rounded-full ${event.result.toUpperCase().includes("VALID") ? "bg-emerald-300" : event.result.toUpperCase().includes("REPLAY") ? "bg-amber-300" : "bg-rose-300"}`} />
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{event.result}</span><span className="block truncate text-xs text-slate-500">{shortUid(event.uid_hex)} / {event.city || "sin ciudad"}</span></span>
                  <span className="text-[10px] font-semibold text-slate-500">{new Date(event.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
              {!events.length ? <p className="py-4 text-sm text-slate-500">Sin eventos source=demo en el corpus visible.</p> : null}
            </div>
          </div>
        </aside>
      </div>

      <section className="grid gap-3 border-t border-white/10 pt-5 md:grid-cols-3" aria-label="Capas conectadas">
        <TrustLink icon={Database} label="nexID Core" body="Identidad, SUN, lote, evento y tenant." href="/events?source=demo" />
        <TrustLink icon={ShieldCheck} label="Proof / IOTA" body="Decoder y recibos hash-only verificables." href="/proof" />
        <TrustLink icon={Boxes} label="Ownership / Polygon" body="Claims y certificados separados de la simulacion." href="/tokenization" />
      </section>

      {canReset ? (
        <details className="rounded-lg border border-rose-300/15 bg-rose-500/[0.04] p-4">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-rose-200">Reset super-admin del corpus demo</summary>
          <p className="mt-3 text-sm text-slate-400">Solo elimina eventos con tenant demobodega, batch {BID} y source=demo. Preserva tenant, tags, lote y CRM.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={resetText} onChange={(event) => setResetText(event.target.value)} aria-label="Confirmacion exacta del reset demo" placeholder={RESET_CONFIRMATION} className="min-h-11 flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-rose-300/45" />
            <button type="button" disabled={resetText !== RESET_CONFIRMATION || Boolean(pendingMode)} onClick={() => void reset()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-300/25 bg-rose-500/10 px-4 text-xs font-black text-rose-100 disabled:cursor-not-allowed disabled:opacity-40">
              {pendingMode === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset controlado
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function StatusCell({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "ok" | "warn" }) {
  const valueTone = tone === "ok" ? "text-emerald-200" : tone === "warn" ? "text-amber-200" : "text-white";
  return <div className="min-w-0 bg-slate-950/70 p-3"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className={`mt-1 truncate text-sm font-black ${valueTone}`}>{value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{detail}</p></div>;
}

function RunButton({ icon: Icon, label, tone, pending, disabled, onClick }: { icon: typeof Beaker; label: string; tone: "emerald" | "amber" | "rose"; pending: boolean; disabled: boolean; onClick: () => void }) {
  const toneClass = tone === "emerald" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : tone === "amber" ? "border-amber-300/25 bg-amber-500/10 text-amber-100" : "border-rose-300/25 bg-rose-500/10 text-rose-100";
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>;
}

function ReceiptRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-white/8 pb-2 text-xs"><span className="font-black uppercase tracking-[0.1em] text-slate-500">{label}</span><span className={`min-w-0 break-all text-slate-200 ${mono ? "font-mono" : "font-semibold"}`}>{value}</span></div>;
}

function TrustLink({ icon: Icon, label, body, href }: { icon: typeof Database; label: string; body: string; href: string }) {
  return <a href={href} className="group flex min-h-24 items-start gap-3 rounded-lg border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-500/10 text-cyan-100"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-black text-white">{label}<ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-cyan-200" /></span><span className="mt-1 block text-xs leading-5 text-slate-400">{body}</span></span></a>;
}
