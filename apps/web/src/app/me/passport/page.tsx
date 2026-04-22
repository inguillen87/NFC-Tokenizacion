import { PortalShell } from "../_components/portal-shell";

export default function PassportPage() {
  return (
    <PortalShell title="NexID Premium Passport" subtitle="Identidad, memberships, productos verificados y actividad de autenticidad.">
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
        Tu Passport se alimenta con eventos reales de tap y membresías por tenant.
      </section>
    </PortalShell>
  );
}
