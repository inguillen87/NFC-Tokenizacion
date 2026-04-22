import { PortalShell } from "../_components/portal-shell";

export default function Page() {
  return (
    <PortalShell title="Portal nexID" subtitle="Vista premium del consumidor para productos verificados, loyalty y marketplace.">
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
        Esta sección está conectada al backend consumer API para listar datos reales por sesión.
      </section>
    </PortalShell>
  );
}
