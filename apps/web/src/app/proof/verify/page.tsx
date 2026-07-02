import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Database,
  FileSearch,
  Layers,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@product/ui";
import { productUrls } from "@product/config";
import { BackLink } from "../../../components/back-link";

type VerifyMatch = {
  anchor_id: string;
  provider: string;
  network: string;
  merkle_root: string;
  tx_hash: string | null;
  explorer_url: string | null;
  status: string;
  anchored_at: string | null;
};

type DemoEvent = {
  id: string;
  title: string;
  event_type: string;
  hash: string;
  summary: string;
};

type DemoCase = {
  id: string;
  title: string;
  vertical: string;
  headline: string;
  body: string;
  primary_event_hash: string;
  anchor_id: string;
  provider: string;
  network: string;
  status: string;
  merkle_root: string;
  resource_type: string;
  resource_id: string;
  anchored_at: string;
  explorer_url: string | null;
  tx_hash: string | null;
  public_receipt: {
    title: string;
    business_claim: string;
    manager_explanation: string;
    on_chain_memo: string;
    receipt_hash: string;
    tx_hash: string | null;
    explorer_url: string | null;
    public_fields: string[];
    private_fields: string[];
  };
  events: DemoEvent[];
  proof_layers: Array<{
    layer: string;
    purpose: string;
    status: string;
  }>;
};

type VerifyResponse = {
  ok: boolean;
  valid?: boolean;
  included?: boolean;
  demo?: boolean;
  event_hash?: string;
  provider?: string | null;
  network?: string | null;
  merkle_root?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  matches?: VerifyMatch[];
  demo_case?: DemoCase | null;
  reason?: string;
  registry_warning?: string | null;
  privacy?: string;
};

type DemoCasesResponse = {
  ok: boolean;
  cases?: DemoCase[];
  testnet?: {
    iota?: {
      mode?: string;
      network?: string;
      rpc_configured?: boolean;
      contract_configured?: boolean;
      signer_configured?: boolean;
      deployer_address?: string | null;
      contract_address?: string | null;
      contract_explorer_url?: string | null;
      demo_tx_hash?: string | null;
      demo_tx_explorer_url?: string | null;
      demo_txs?: Record<string, {
        tx_hash?: string | null;
        explorer_url?: string | null;
        receipt_tx_hash?: string | null;
        receipt_explorer_url?: string | null;
      }>;
    };
    polygon?: {
      network?: string;
      rpc_configured?: boolean;
      contract_configured?: boolean;
      signer_configured?: boolean;
      contract_address?: string | null;
      owner_address?: string | null;
      contract_explorer_url?: string | null;
      owner_explorer_url?: string | null;
      demo_tx_hash?: string | null;
      demo_tx_explorer_url?: string | null;
    };
  };
};

export const metadata: Metadata = {
  title: "Proof Verifier | nexID",
  description: "Verificador publico hash-only para anchors, Merkle roots y evidencia DPP, QA y logistica en nexID.",
};

const proofFlow = [
  {
    label: "1. Evento",
    title: "nexID registra el hecho",
    body: "Puede ser un tap valido, QA de lote, entrega, custodia, DPP o reporte logistico.",
  },
  {
    label: "2. Hash",
    title: "Se calcula evidencia minima",
    body: "El sistema genera un sha256 del evento canonico. No publica UIDs, clientes, rutas privadas ni keys.",
  },
  {
    label: "3. Anchor",
    title: "Se agrupa en un Merkle root",
    body: "Varios hashes se consolidan en un root auditable local o externo, segun politica del tenant.",
  },
  {
    label: "4. Recibo publico",
    title: "Se publica un memo entendible",
    body: "IOTA puede guardar un texto publico minimo: caso, recurso, eventos, root y privacy=hash-only.",
  },
  {
    label: "5. Verificacion",
    title: "El tercero comprueba inclusion",
    body: "Con el hash, un auditor o cliente confirma si esa evidencia esta incluida sin ver el dato privado.",
  },
];

const connectionCards = [
  {
    title: "Demo Lab",
    body: "Muestra el recorrido comercial: producto, custodia, DPP, riesgo y proof. Es la demo para explicar el concepto.",
    href: "/demo-lab?scenario=iota-proof",
    cta: "Abrir demo IOTA",
  },
  {
    title: "SDK & API",
    body: "El cliente integra taps, POS, ERP, sensores o app mobile. La API puede crear eventos y consultar proofs por hash.",
    href: "/sdk",
    cta: "Ver SDK",
  },
  {
    title: "Dashboard enterprise",
    body: "Operaciones decide que eventos se anclan: manifests, QA, entregas, claims o reportes DPP.",
    href: "/docs#trust-layers",
    cta: "Ver arquitectura",
  },
  {
    title: "IOTA / Polygon",
    body: "IOTA sirve como proof/auditoria opcional. Polygon queda separado para ownership, certificados y warranty transfer.",
    href: "/docs#trust-layers",
    cta: "Separar capas",
  },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function shortHash(value: string | null | undefined) {
  const text = String(value || "");
  if (text.length <= 24) return text || "-";
  return `${text.slice(0, 18)}...${text.slice(-10)}`;
}

function explorerLink(url: string | null | undefined, label: string) {
  if (!url) return null;
  return (
    <a href={url} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-cyan-800" target="_blank" rel="noreferrer">
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </a>
  );
}

function statusTone(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (["confirmed", "submitted", "local"].includes(normalized)) return "border-emerald-300/50 bg-emerald-50 text-emerald-800";
  if (["demo_ready"].includes(normalized)) return "border-cyan-300/60 bg-cyan-50 text-cyan-800";
  if (["failed"].includes(normalized)) return "border-rose-300/60 bg-rose-50 text-rose-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

async function verifyProof(eventHash: string, anchorId: string): Promise<VerifyResponse | null> {
  if (!eventHash) return null;
  const params = new URLSearchParams({ event_hash: eventHash });
  if (anchorId) params.set("anchor_id", anchorId);
  try {
    const response = await fetch(`${productUrls.api}/public/proof/verify?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as VerifyResponse | null;
    if (!data) return { ok: false, reason: `proof_verifier_http_${response.status}` };
    if (!response.ok && !data.reason) return { ...data, ok: false, reason: `proof_verifier_http_${response.status}` };
    return data;
  } catch {
    return { ok: false, reason: "proof_verifier_unavailable" };
  }
}

async function loadDemoCases(): Promise<DemoCasesResponse> {
  try {
    const response = await fetch(`${productUrls.api}/public/proof/demo-cases`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as DemoCasesResponse | null;
    if (!data || !response.ok) return { ok: false, cases: [] };
    return data;
  } catch {
    return { ok: false, cases: [] };
  }
}

export default async function ProofVerifierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const eventHash = first(params.event_hash || params.eventHash || params.hash).trim();
  const anchorId = first(params.anchor_id || params.anchorId).trim();
  const [result, demoCatalog] = await Promise.all([
    verifyProof(eventHash, anchorId),
    loadDemoCases(),
  ]);
  const matches = result?.matches || [];
  const included = Boolean(result?.included || result?.valid);
  const demoCases = demoCatalog.cases || [];
  const activeDemo = result?.demo_case || demoCases.find((demoCase) =>
    demoCase.events.some((event) => event.hash.toLowerCase() === eventHash.toLowerCase()),
  ) || null;

  return (
    <main className="proof-verify-page min-h-screen text-slate-950">
      <style>{`
        .proof-verify-page {
          --proof-page-bg:
            radial-gradient(circle at 14% 2%, rgba(34, 211, 238, 0.18), transparent 34%),
            radial-gradient(circle at 84% 12%, rgba(124, 58, 237, 0.16), transparent 30%),
            linear-gradient(180deg, #020617 0%, #08111f 48%, #020617 100%);
          --proof-card-bg: rgba(15, 23, 42, 0.78);
          --proof-soft-bg: rgba(15, 23, 42, 0.62);
          --proof-cyan-bg: rgba(8, 145, 178, 0.13);
          --proof-emerald-bg: rgba(16, 185, 129, 0.12);
          --proof-amber-bg: rgba(245, 158, 11, 0.12);
          --proof-border: rgba(148, 163, 184, 0.18);
          --proof-border-strong: rgba(34, 211, 238, 0.28);
          --proof-title: #f8fafc;
          --proof-text: #e2e8f0;
          --proof-muted: #94a3b8;
          --proof-accent: #67e8f9;
          --proof-success: #bbf7d0;
          --proof-success-strong: #dcfce7;
          --proof-warning: #fde68a;
          --proof-warning-strong: #fef3c7;
          --proof-shadow: 0 24px 90px rgba(0, 0, 0, 0.34);
          background: var(--proof-page-bg);
          color: var(--proof-text);
        }

        html[data-theme="light"] .proof-verify-page,
        html.theme-light .proof-verify-page {
          --proof-page-bg:
            radial-gradient(circle at 15% 0%, rgba(34, 211, 238, 0.18), transparent 32%),
            linear-gradient(180deg, #f7fbff 0%, #eef5fb 52%, #f8fbff 100%);
          --proof-card-bg: rgba(255, 255, 255, 0.86);
          --proof-soft-bg: rgba(248, 250, 252, 0.92);
          --proof-cyan-bg: rgba(236, 254, 255, 0.78);
          --proof-emerald-bg: rgba(236, 253, 245, 0.95);
          --proof-amber-bg: rgba(255, 251, 235, 0.95);
          --proof-border: rgba(15, 23, 42, 0.12);
          --proof-border-strong: rgba(14, 116, 144, 0.24);
          --proof-title: #0f172a;
          --proof-text: #334155;
          --proof-muted: #64748b;
          --proof-accent: #0e7490;
          --proof-success: #065f46;
          --proof-success-strong: #064e3b;
          --proof-warning: #92400e;
          --proof-warning-strong: #78350f;
          --proof-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
        }

        .proof-verify-page [class*="bg-white"],
        .proof-verify-page form,
        .proof-verify-page article {
          background: var(--proof-card-bg) !important;
          border-color: var(--proof-border) !important;
          box-shadow: var(--proof-shadow);
          backdrop-filter: blur(18px);
        }

        .proof-verify-page [class*="bg-slate-50"],
        .proof-verify-page [class*="bg-slate-100"] {
          background: var(--proof-soft-bg) !important;
          border-color: var(--proof-border) !important;
        }

        .proof-verify-page [class*="bg-cyan-50"] {
          background: var(--proof-cyan-bg) !important;
          border-color: var(--proof-border-strong) !important;
        }

        .proof-verify-page [class*="bg-emerald-50"] {
          background: var(--proof-emerald-bg) !important;
          border-color: rgba(52, 211, 153, 0.3) !important;
        }

        .proof-verify-page [class*="bg-amber-50"] {
          background: var(--proof-amber-bg) !important;
          border-color: rgba(251, 191, 36, 0.32) !important;
        }

        .proof-verify-page [class*="text-slate-950"],
        .proof-verify-page [class*="text-slate-900"],
        .proof-verify-page [class*="text-slate-800"],
        .proof-verify-page [class*="text-slate-700"] {
          color: var(--proof-title) !important;
        }

        .proof-verify-page [class*="text-slate-600"],
        .proof-verify-page [class*="text-slate-500"],
        .proof-verify-page [class*="text-slate-400"] {
          color: var(--proof-muted) !important;
        }

        .proof-verify-page [class*="text-cyan-700"],
        .proof-verify-page [class*="text-cyan-800"] {
          color: var(--proof-accent) !important;
        }

        .proof-verify-page [class*="text-emerald-950"],
        .proof-verify-page [class*="text-emerald-900"],
        .proof-verify-page [class*="text-emerald-800"],
        .proof-verify-page [class*="text-emerald-700"] {
          color: var(--proof-success) !important;
        }

        .proof-verify-page [class*="text-amber-950"],
        .proof-verify-page [class*="text-amber-900"],
        .proof-verify-page [class*="text-amber-800"],
        .proof-verify-page [class*="text-amber-700"] {
          color: var(--proof-warning) !important;
        }

        .proof-verify-page input {
          background: var(--proof-soft-bg) !important;
          border-color: var(--proof-border) !important;
          color: var(--proof-title) !important;
        }

        .proof-verify-page input::placeholder {
          color: var(--proof-muted);
        }

        .proof-verify-page form button {
          background: linear-gradient(135deg, #06b6d4, #14b8a6) !important;
          color: #020617 !important;
          box-shadow: 0 18px 50px rgba(20, 184, 166, 0.22) !important;
        }

        .proof-verify-page .theme-toggle {
          border-color: var(--proof-border-strong) !important;
          background: var(--proof-card-bg) !important;
          color: var(--proof-text) !important;
        }
      `}</style>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <BackLink href="/" label="nexID" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ThemeToggle />
            <Link
              href="/demo-lab?scenario=iota-proof"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              Demo IOTA <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sdk"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              SDK/API
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Public proof verifier
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-normal text-slate-950 sm:text-6xl">
                Prueba publica para evidencia privada.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Proof Verify permite que un cliente, auditor o inversor compruebe que una evidencia existia y no fue cambiada, sin ver el dato sensible que genero esa evidencia.
              </p>
            </div>
          </div>

          <form action="/proof/verify" className="rounded-[1.5rem] border border-cyan-100 bg-white/88 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-6 text-slate-700">
                <strong className="block text-slate-950">Que pega una empresa en este campo?</strong>
                Un hash de evento autorizado: por ejemplo QA de lote, entrega, claim, DPP o checkpoint logistico. Si el hash aparece en un anchor, la evidencia quedo incluida.
              </div>
              <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Event hash
                <input
                  name="event_hash"
                  defaultValue={eventHash}
                  placeholder="sha256:..."
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Anchor ID opcional
                <input
                  name="anchor_id"
                  defaultValue={anchorId}
                  placeholder="uuid"
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </label>
              <button className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-cyan-900/10 transition hover:bg-cyan-900">
                Verificar prueba <FileSearch className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {proofFlow.map((item) => (
            <article key={item.label} className="rounded-[1.25rem] border border-slate-200 bg-white/82 p-4 shadow-sm">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-cyan-700">{item.label}</p>
              <h2 className="mt-3 text-lg font-black leading-tight text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Polygon ownership layer</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Contrato real NXDT en Amoy.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta capa prueba propiedad, warranty transferible o reclamo comercial. No se mezcla con la evidencia privada: es el certificado publico del activo.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${demoCatalog.testnet?.polygon?.contract_address ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
                {demoCatalog.testnet?.polygon?.contract_address ? "deployed" : "pending"}
              </span>
            </div>
            <dl className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Contrato</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.polygon?.contract_address || "-"}</dd>
                <div className="mt-3">{explorerLink(demoCatalog.testnet?.polygon?.contract_explorer_url, "Abrir contrato")}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Owner / minter demo</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.polygon?.owner_address || "-"}</dd>
                <div className="mt-3">{explorerLink(demoCatalog.testnet?.polygon?.owner_explorer_url, "Abrir wallet")}</div>
              </div>
              {demoCatalog.testnet?.polygon?.demo_tx_hash ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Mint demo real</dt>
                  <dd className="mt-2 break-all font-mono text-xs font-bold text-emerald-950">{demoCatalog.testnet.polygon.demo_tx_hash}</dd>
                  <div className="mt-3">{explorerLink(demoCatalog.testnet.polygon.demo_tx_explorer_url, "Abrir tx")}</div>
                </div>
              ) : null}
            </dl>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">IOTA proof layer</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Merkle root para auditoria publica.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta capa prueba que un evento existia sin mostrar el evento. Es ideal para DPP, QA, cadena de custodia y auditoria externa.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${demoCatalog.testnet?.iota?.contract_configured ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                {demoCatalog.testnet?.iota?.contract_configured ? "deployed" : "fund + deploy"}
              </span>
            </div>
            <dl className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Deployer testnet</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.iota?.deployer_address || "-"}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Contrato anchor</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.iota?.contract_address || "Pendiente de deploy cuando haya saldo IOTA testnet."}</dd>
                <div className="mt-3">{explorerLink(demoCatalog.testnet?.iota?.contract_explorer_url, "Abrir contrato")}</div>
              </div>
              {demoCatalog.testnet?.iota?.demo_tx_hash ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Anchor demo real</dt>
                  <dd className="mt-2 break-all font-mono text-xs font-bold text-emerald-950">{demoCatalog.testnet.iota.demo_tx_hash}</dd>
                  <div className="mt-3">{explorerLink(demoCatalog.testnet.iota.demo_tx_explorer_url, "Abrir tx")}</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Siguiente paso: fondear la wallet IOTA testnet, desplegar `LogisticsEventAnchor` y anclar el Merkle root de uno de estos casos. La UX ya esta lista para mostrar tx/explorer real.
                </div>
              )}
            </dl>
          </article>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Demos publicos verificables</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">Entrar, elegir un caso y verificar un SHA real.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Estos casos no usan marcas reales ni datos sensibles. El backend calcula hashes canonicos, Merkle roots reales y muestra la transaccion IOTA testnet cuando ese caso ya fue anclado.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/75 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-800">
              IOTA {demoCatalog.testnet?.iota?.mode || "disabled"} · Polygon {demoCatalog.testnet?.polygon?.network || "amoy"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {demoCases.length ? demoCases.map((demoCase) => (
              <article key={demoCase.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-700">{demoCase.vertical}</p>
                    <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">{demoCase.title}</h3>
                  </div>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-cyan-800">
                    {demoCase.events.length} eventos
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{demoCase.headline}</p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">SHA principal</p>
                  <p className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCase.primary_event_hash}</p>
                </div>
                {demoCase.tx_hash ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">IOTA anchor confirmado</p>
                    <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-emerald-950">{shortHash(demoCase.tx_hash)}</p>
                    <div className="mt-2">{explorerLink(demoCase.explorer_url, "Abrir tx")}</div>
                  </div>
                ) : null}
                {demoCase.public_receipt?.tx_hash ? (
                  <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Memo publico en IOTA</p>
                    <p className="mt-2 text-xs leading-5 text-slate-700">{demoCase.public_receipt.business_claim}</p>
                    <div className="mt-2">{explorerLink(demoCase.public_receipt.explorer_url, "Abrir memo tx")}</div>
                  </div>
                ) : null}
                <Link
                  href={`/proof/verify?event_hash=${encodeURIComponent(demoCase.primary_event_hash)}&anchor_id=${encodeURIComponent(demoCase.anchor_id)}`}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-900"
                >
                  Verificar este SHA <FileSearch className="h-4 w-4" />
                </Link>
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600 lg:col-span-3">
                La API de demos no respondio ahora. El verificador manual sigue funcionando si pegás un hash autorizado.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/82 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Resultado</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {!eventHash ? "Esperando hash" : included ? "Evidencia incluida" : "Sin inclusion verificada"}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  {!eventHash
                    ? "Pegando un hash se consulta el registry publico de anchors. La prueba responde inclusion, no revela el evento privado."
                    : included
                      ? "El hash existe dentro de uno o mas anchors. Si hay explorer_url, tambien se puede abrir la prueba externa."
                      : "No se encontro inclusion para este hash. Puede ser un hash mal copiado, un evento no anclado o una prueba pendiente."}
                </p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${included ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
                <BadgeCheck className="h-4 w-4" />
                {eventHash ? (included ? "valid" : "not found") : "ready"}
              </span>
            </div>

            <dl className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Event hash</dt>
                <dd className="mt-2 break-all font-mono text-slate-900">{eventHash || "sha256:..."}</dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Provider</dt>
                  <dd className="mt-2 font-mono text-slate-900">{result?.provider || "-"}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Network</dt>
                  <dd className="mt-2 font-mono text-slate-900">{result?.network || "-"}</dd>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Merkle root</dt>
                <dd className="mt-2 break-all font-mono text-slate-900">{result?.merkle_root || "-"}</dd>
              </div>
            </dl>
            {result?.registry_warning ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                El demo publico verifico con el anchor testnet disponible. El registry privado no respondio en este intento, por eso no se muestran anchors internos.
              </div>
            ) : null}
            {activeDemo ? (
              <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-800">Caso explicado</p>
                <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">{activeDemo.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{activeDemo.body}</p>
                <div className="mt-4 grid gap-2">
                  {activeDemo.events.map((event, index) => (
                    <div key={event.id} className="rounded-2xl border border-cyan-100 bg-white/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-slate-950">{index + 1}. {event.title}</strong>
                        <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-cyan-800">{event.event_type}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{event.summary}</p>
                      <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-slate-800">{event.hash}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-800">Recibo publico on-chain</p>
                      <h4 className="mt-2 text-lg font-black leading-tight text-emerald-950">{activeDemo.public_receipt.title}</h4>
                    </div>
                    {activeDemo.public_receipt.tx_hash ? (
                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-emerald-900">
                        memo tx real
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-emerald-900">{activeDemo.public_receipt.business_claim}</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">{activeDemo.public_receipt.manager_explanation}</p>
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/70 p-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Texto exacto escrito como data de transaccion</p>
                    <p className="mt-2 break-all font-mono text-[0.72rem] font-bold leading-5 text-slate-900">{activeDemo.public_receipt.on_chain_memo}</p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Hash del memo</p>
                      <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-slate-900">{activeDemo.public_receipt.receipt_hash}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Transaccion memo</p>
                      <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-slate-900">{shortHash(activeDemo.public_receipt.tx_hash)}</p>
                      <div className="mt-2">{explorerLink(activeDemo.public_receipt.explorer_url, "Abrir memo en explorer")}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Publico</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{activeDemo.public_receipt.public_fields.join(", ")}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-800">Privado dentro de nexID</p>
                      <p className="mt-2 text-sm leading-6 text-amber-900">{activeDemo.public_receipt.private_fields.join(", ")}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white/82 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Anchors</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{matches.length} coincidencias</h2>
              </div>
              <Network className="h-6 w-6 text-cyan-700" />
            </div>

            <div className="mt-5 grid gap-3">
              {matches.length ? matches.map((match) => (
                <article key={match.anchor_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-sm font-bold text-slate-900">{shortHash(match.anchor_id)}</p>
                    <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${statusTone(match.status)}`}>{match.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">Provider</p>
                      <p className="mt-1 font-mono text-slate-900">{match.provider} / {match.network}</p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">Tx</p>
                      <p className="mt-1 font-mono text-slate-900">{shortHash(match.tx_hash)}</p>
                    </div>
                  </div>
                  {match.explorer_url ? (
                    <a href={match.explorer_url} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-cyan-800" target="_blank" rel="noreferrer">
                      Abrir explorer <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                  {result?.ok === false ? `El verificador respondio: ${result.reason || "error"}.` : "Ingresar un hash valido devuelve anchors compatibles y estado de inclusion."}
                </div>
              )}
            </div>
          </div>
        </section>

        {activeDemo ? (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-800">
                <Network className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Capas del caso</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Que se prueba en nexID, IOTA y Polygon</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {activeDemo.proof_layers.map((layer) => (
                <article key={layer.layer} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-700">{layer.status}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{layer.layer}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{layer.purpose}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {activeDemo.tx_hash
                ? "Este caso ya tiene hash, Merkle root y transaccion IOTA testnet reales. Sirve para mostrar auditoria externa sin publicar datos privados; produccion cambia llaves, saldo, monitoreo y politica de retencion."
                : "Este caso ya tiene hash y Merkle root reales. Cuando operaciones ancla el root en testnet o mainnet, la misma pantalla muestra tx y explorer sin cambiar la experiencia."}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-800">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Como se conecta</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">De demo a prueba verificable</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {connectionCards.map((card) => (
                <Link key={card.title} href={card.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/60">
                  <strong className="block text-sm text-slate-950">{card.title}</strong>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{card.body}</span>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-800">
                    {card.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-800">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Para gente normal</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Que demuestra y que no</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <strong className="text-sm text-emerald-950">Demuestra</strong>
                <p className="mt-2 text-sm leading-6 text-emerald-900">Que ese hash fue incluido en un anchor con fecha, provider, red, Merkle root y, si aplica, transaccion externa.</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <strong className="text-sm text-amber-950">No demuestra solo</strong>
                <p className="mt-2 text-sm leading-6 text-amber-900">No reemplaza la validacion NFC/SUN, el dashboard privado ni el certificado Polygon. Es una prueba externa de integridad, no una copia de toda la base.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <strong className="text-sm text-slate-950">Como se usa en ventas</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">Mostras Demo Lab, elegis un evento de negocio, ensenas su hash y despues lo verificas aca. La empresa entiende privacidad, auditoria y compliance en menos de un minuto.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 rounded-[1.5rem] border border-cyan-100 bg-cyan-50/70 p-5 text-sm leading-7 text-slate-700 sm:grid-cols-3">
          <div className="flex gap-3">
            <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-cyan-800" />
            <p>Solo se verifica el hash. La prueba no revela UIDs, manifests ni identidad del destinatario.</p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-800" />
            <p>Polygon queda para ownership/certificados. IOTA/local proof queda para auditoria y DPP.</p>
          </div>
          <div className="flex gap-3">
            <Network className="mt-1 h-5 w-5 shrink-0 text-cyan-800" />
            <p>La API tambien acepta POST JSON en <span className="font-mono">/public/proof/verify</span>.</p>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Mensaje comercial correcto</p>
              <h2 className="mt-2 text-3xl font-black leading-tight">IOTA prueba evidencia. Polygon prueba ownership.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Proof Verify existe para explicar auditoria sin complejidad blockchain: el cliente no necesita ver contratos, wallets ni payloads privados para comprobar integridad.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Database className="mb-3 h-5 w-5 text-cyan-300" />
                <strong className="block text-sm">Backend nexID</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-400">Fuente privada de verdad, policies y eventos.</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Network className="mb-3 h-5 w-5 text-emerald-300" />
                <strong className="block text-sm">IOTA opcional</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-400">Anchors de hashes o Merkle roots para auditoria.</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-violet-300" />
                <strong className="block text-sm">Polygon opcional</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-400">Certificados, claims, ownership y garantia transferible.</span>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
