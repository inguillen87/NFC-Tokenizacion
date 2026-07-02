import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileSearch, LockKeyhole, Network, ShieldCheck } from "lucide-react";
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
  anchored_at: string;
};

type VerifyResponse = {
  ok: boolean;
  valid?: boolean;
  included?: boolean;
  event_hash?: string;
  provider?: string | null;
  network?: string | null;
  merkle_root?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  matches?: VerifyMatch[];
  reason?: string;
  privacy?: string;
};

export const metadata: Metadata = {
  title: "Proof Verifier | nexID",
  description: "Verificacion publica hash-only de anchors, Merkle roots y evidencia DPP/logistica en nexID.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function shortHash(value: string | null | undefined) {
  const text = String(value || "");
  if (text.length <= 24) return text || "-";
  return `${text.slice(0, 18)}...${text.slice(-10)}`;
}

function statusTone(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (["confirmed", "submitted", "local"].includes(normalized)) return "border-emerald-300/50 bg-emerald-50 text-emerald-800";
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

export default async function ProofVerifierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const eventHash = first(params.event_hash || params.eventHash || params.hash).trim();
  const anchorId = first(params.anchor_id || params.anchorId).trim();
  const result = await verifyProof(eventHash, anchorId);
  const matches = result?.matches || [];
  const included = Boolean(result?.included || result?.valid);

  return (
    <main
      className="proof-verify-page min-h-screen text-slate-950"
      style={{
        background:
          "radial-gradient(circle at 15% 0%, rgba(34, 211, 238, 0.18), transparent 32%), linear-gradient(180deg, #f7fbff 0%, #eef5fb 52%, #f8fbff 100%)",
      }}
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <BackLink href="/" label="nexID" />
          <Link
            href="/demo-lab?scenario=iota-proof"
            className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            Demo Lab <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Hash-only evidence verifier
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-normal text-slate-950 sm:text-6xl">
                Verificacion publica para auditoria DPP, QA y logistica.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                El verificador comprueba inclusion en anchors de evidencia sin mostrar UIDs, clientes, manifests, direcciones, keys ni datos comerciales.
              </p>
            </div>
          </div>

          <form action="/proof/verify" className="rounded-[1.5rem] border border-cyan-100 bg-white/88 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="grid gap-3">
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

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/82 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Resultado</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {!eventHash ? "Esperando hash" : included ? "Evidencia incluida" : "Sin inclusion verificada"}
                </h2>
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
      </section>
    </main>
  );
}
