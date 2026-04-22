import Link from "next/link";
import { fetchConsumerMe } from "./_components/consumer-api";
import { PortalShell } from "./_components/portal-shell";

type MePayload = {
  ok?: boolean;
  consumer?: { email?: string | null; display_name?: string | null; passport_status?: string | null };
  stats?: { products?: number; taps?: number; memberships?: number; unread?: number; rewards?: number };
};

export default async function MePage() {
  const me = (await fetchConsumerMe()) as MePayload | null;
  const stats = me?.stats || {};
  const isReady = Boolean(me?.ok);

  return (
    <PortalShell
      title="Tu pasaporte de productos auténticos"
      subtitle="Guardá productos, sumá puntos por marca y gestioná ownership, rewards y privacidad desde un solo portal premium."
    >
      {!isReady ? (
        <section className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Iniciá sesión desde un tap válido para activar tu NexID Passport y desbloquear acciones de ownership/rewards.
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Productos verificados", String(stats.products || 0)],
          ["Taps registrados", String(stats.taps || 0)],
          ["Marcas unidas", String(stats.memberships || 0)],
          ["Rewards disponibles", String(stats.rewards || 0)],
          ["Alertas", String(stats.unread || 0)],
        ].map(([title, value]) => (
          <article key={title} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold text-cyan-200">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {[
          ["/me/passport", "Completar Passport", "Actualizá identidad y estado de verificación para acceso premium."],
          ["/me/products", "Guardar producto", "Registrá este item en tu biblioteca personal verificada."],
          ["/me/rewards", "Sumar puntos", "Activá beneficios por marca y canjeá experiencias reales."],
        ].map(([href, title, desc]) => (
          <Link key={href} href={href} className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4 transition hover:border-cyan-300/40 hover:bg-cyan-500/15">
            <p className="text-sm font-semibold text-cyan-100">{title}</p>
            <p className="mt-1 text-xs text-cyan-50/90">{desc}</p>
          </Link>
        ))}
      </section>
    </PortalShell>
  );
}
