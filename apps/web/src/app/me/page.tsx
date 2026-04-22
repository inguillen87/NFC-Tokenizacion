import { PortalShell } from "./_components/portal-shell";

const cards = [
  ["Productos verificados", "12"],
  ["Taps válidos", "29"],
  ["Marcas unidas", "3"],
  ["Rewards disponibles", "4"],
];

export default function MePage() {
  return (
    <PortalShell
      title="Tu pasaporte de productos auténticos"
      subtitle="Guardá productos, sumá puntos por tenant y descubrí marcas premium verificadas en la red nexID."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, value]) => (
          <article key={title} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold text-cyan-200">{value}</p>
          </article>
        ))}
      </div>
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
        <p>CTA principal: <b>Explorar marcas premium verificadas</b>.</p>
        <p className="mt-2">Si venís de un tap válido, podés guardar el producto, unirte al club del tenant y reclamar puntos.</p>
      </section>
    </PortalShell>
  );
}
