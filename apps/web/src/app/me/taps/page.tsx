import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { asArray, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { formatPortalDate, type ConsumerTap } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

function tapState(tap: ConsumerTap) {
  const verdict = String(tap.verdict || "VALID").toUpperCase();
  const isReplay = verdict.includes("REPLAY") || verdict.includes("BLOCK");
  const isTamper = verdict.includes("TAMPER") || verdict.includes("BROKEN") || verdict.includes("REVOKE");
  if (isTamper) return { verdict, Icon: ShieldAlert, title: "Alerta tamper", desc: "Sello comprometido o estado revocado.", card: "border-rose-300/25", chip: "border-rose-300/30 bg-rose-500/10 text-rose-100" };
  if (isReplay) return { verdict, Icon: AlertTriangle, title: "Replay bloqueado", desc: "El evento no es claimable y queda auditado.", card: "border-amber-300/25", chip: "border-amber-300/30 bg-amber-500/10 text-amber-100" };
  return { verdict, Icon: CheckCircle2, title: "Tap valido", desc: "Autenticidad verificada y lista para acciones post-tap.", card: "border-emerald-300/25", chip: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" };
}

export default async function TapsTimelinePage() {
  await requireConsumerSession("/me/taps");
  const payload = await fetchConsumerPath("taps");
  const taps = asArray<ConsumerTap>(payload);
  const valid = taps.filter((tap) => String(tap.verdict || "").toUpperCase().includes("VALID")).length;
  const blocked = taps.length - valid;

  return (
    <PortalShell
      title="Historial de taps"
      subtitle="Trazabilidad de interacciones fisicas: ubicacion, tenant, verdict, replay y estado de seguridad."
    >
      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Eventos", taps.length],
          ["Validos", valid],
          ["Alertas", blocked],
        ].map(([label, value]) => (
          <article key={String(label)} className="consumer-metric-card rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
          </article>
        ))}
      </section>

      <div className="consumer-tap-timeline relative mx-auto max-w-3xl space-y-4">
        {!taps.length ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
            Aun no tenes historial de interacciones. Tus proximos taps autenticados apareceran aca.
          </div>
        ) : (
          taps.map((tap, idx) => {
            const state = tapState(tap);
            const Icon = state.Icon;
            return (
              <article key={`tap-${tap.tap_event_id || idx}`} className={`consumer-tap-row rounded-3xl border ${state.card} bg-slate-950/70 p-4`}>
                <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${state.chip}`}>{state.verdict}</span>
                      <span className="rounded-full border border-indigo-300/25 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-100">risk {String(tap.risk_level || "n/a")}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-black text-white">{state.title} #{tap.tap_event_id || "n/a"}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{state.desc}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300 md:min-w-52">
                    <p className="font-black text-white">{tap.city || "Ciudad no informada"}, {tap.country || "--"}</p>
                    <p className="mt-1">tenant {tap.tenant_slug || "n/a"}</p>
                    <p className="mt-1">{formatPortalDate(tap.created_at)}</p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </PortalShell>
  );
}
