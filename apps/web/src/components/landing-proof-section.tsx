import { Card, SectionHeading } from "@product/ui";

export type LandingProofEvent = {
  city: string;
  country: string;
  verdict: string;
  tenant: string;
  occurredAt: string;
  uidMasked: string;
};

export type ProofSummary = {
  tapsToday: number;
  validRate: number;
  riskBlocked: number;
  activeRegions: number;
  demoMode: boolean;
  latestPublicEvents: LandingProofEvent[];
};

export function LandingProofSection({ proof }: { proof: ProofSummary }) {
  return (
    <section className="container-shell py-8">
      <Card className="p-6 md:p-8">
        <SectionHeading
          eyebrow="Prueba en vivo"
          title="Prueba operativa en tiempo real"
          description="Métricas de validación y últimos eventos públicos anonimizados."
        />

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Taps hoy</p>
            <p className="mt-1 text-2xl font-semibold text-white">{proof.tapsToday.toLocaleString("es-AR")}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Tasa válida</p>
            <p className="mt-1 text-2xl font-semibold text-white">{proof.validRate}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Riesgos bloqueados</p>
            <p className="mt-1 text-2xl font-semibold text-white">{proof.riskBlocked}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Regiones activas</p>
            <p className="mt-1 text-2xl font-semibold text-white">{proof.activeRegions}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Últimos eventos públicos</p>
            {proof.demoMode ? (
              <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                Demo data
              </span>
            ) : (
              <p className="text-xs text-slate-400">Datos operativos</p>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {proof.latestPublicEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-slate-900/60 p-4">
                <p className="text-sm font-medium text-slate-200">Todavía no hay eventos públicos recientes.</p>
                <p className="mt-1 text-xs text-slate-400">Cuando haya nuevas validaciones anonimizadas, aparecerán acá automáticamente.</p>
              </div>
            ) : (
              proof.latestPublicEvents.slice(0, 6).map((event) => (
                <div key={`${event.occurredAt}-${event.uidMasked}`} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="text-white">{event.city}, {event.country} · {event.verdict}</p>
                  <p className="text-slate-400">{event.tenant} · {event.uidMasked} · {event.occurredAt}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
