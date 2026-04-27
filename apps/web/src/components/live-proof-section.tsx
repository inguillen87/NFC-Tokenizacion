import Link from "next/link";

type ProofEvent = {
  eventId: number;
  occurredAt: string;
  verdict: string;
  city: string;
  country: string;
  tenant: string;
  uidMasked: string;
  source: string;
};

type ProofSummary = {
  ok: boolean;
  tapsToday: number;
  validRate: number;
  riskBlocked: number;
  activeRegions: number;
  latestPublicEvents: ProofEvent[];
  demoMode: boolean;
  generatedAt: string;
};

async function getProofSummary(): Promise<ProofSummary | null> {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL;
  if (!base) return null;

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/public/proof/summary`, {
      next: { revalidate: 30 },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload as ProofSummary;
  } catch {
    return null;
  }
}

export async function LiveProofSection() {
  const proof = await getProofSummary();
  const rows = proof?.latestPublicEvents?.slice(0, 5) || [];

  return (
    <section className="container-shell py-8 md:py-10">
      <div className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_15%_20%,rgba(6,182,212,.18),transparent_42%),linear-gradient(155deg,#050b1f,#0b132b_55%,#121a36)] p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Physical identity infrastructure · live proof</p>
            <h3 className="mt-1 text-xl font-semibold text-white md:text-2xl">Tap telemetry, trust posture and global operations in one control narrative</h3>
          </div>
          {proof?.demoMode ? <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">DEMO DATA</span> : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3"><p className="text-[11px] text-slate-400">Taps today</p><p className="mt-1 text-2xl font-semibold text-cyan-100">{proof?.tapsToday ?? "—"}</p></div>
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3"><p className="text-[11px] text-slate-400">Valid rate</p><p className="mt-1 text-2xl font-semibold text-emerald-200">{proof ? `${proof.validRate.toFixed(1)}%` : "—"}</p></div>
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3"><p className="text-[11px] text-slate-400">Risk blocked</p><p className="mt-1 text-2xl font-semibold text-rose-200">{proof?.riskBlocked ?? "—"}</p></div>
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3"><p className="text-[11px] text-slate-400">Active regions (24h)</p><p className="mt-1 text-2xl font-semibold text-indigo-200">{proof?.activeRegions ?? "—"}</p></div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-3">
          {rows.length ? (
            <div className="space-y-2 text-xs text-slate-200">
              {rows.map((item) => (
                <div key={`${item.eventId}-${item.occurredAt}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-900/55 px-3 py-2">
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-100">{item.verdict}</span>
                  <span>{item.city}, {item.country}</span>
                  <span className="text-slate-400">{item.uidMasked}</span>
                  <span className="text-slate-500">tenant {item.tenant}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-slate-900/45 px-3 py-4 text-sm text-slate-400">
              No hay eventos públicos todavía. Ejecutá un tap demo para poblar prueba en vivo.
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/sun" className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100">Probar demo SUN</Link>
            <Link href="/demo-lab" className="rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100">Ver dashboard demo</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
