import { fetchConsumerMe } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Passport = { ok?: boolean; consumer?: { display_name?: string | null; email?: string | null; passport_status?: string | null } };

export default async function PassportPage() {
  const payload = (await fetchConsumerMe()) as Passport | null;
  const status = String(payload?.consumer?.passport_status || "pending").toLowerCase();
  const tone = status === "verified" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-amber-300/30 bg-amber-500/10 text-amber-100";

  return (
    <PortalShell title="NexID Premium Passport" subtitle="Identidad, memberships, productos verificados y actividad de autenticidad.">
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Perfil de identidad</p>
          <span className={`rounded-full border px-2 py-1 text-xs ${tone}`}>{status.toUpperCase()}</span>
        </div>
        <p className="mt-3 text-sm text-slate-200">{payload?.consumer?.display_name || "Usuario NexID"}</p>
        <p className="text-xs text-slate-400">{payload?.consumer?.email || "Sin email validado"}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Membresías activas", "0", "Unite a marcas para desbloquear rewards."],
          ["Documentos", "Pendiente", "Completá validación para elevar trust score."],
          ["Nivel", status === "verified" ? "Premium" : "Starter", "Se actualiza automáticamente con tus taps."],
        ].map(([k, v, d]) => (
          <article key={k} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{k}</p>
            <p className="mt-2 text-xl font-semibold text-cyan-100">{v}</p>
            <p className="mt-1 text-xs text-slate-400">{d}</p>
          </article>
        ))}
      </section>
    </PortalShell>
  );
}
