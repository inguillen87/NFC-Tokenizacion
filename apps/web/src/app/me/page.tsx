import { PortalShell } from "./_components/portal-shell";

type MePayload = { ok: boolean; consumer?: { email?: string | null; display_name?: string | null }; stats?: { products?: number; taps?: number; memberships?: number; unread?: number } };

async function loadMe(): Promise<MePayload> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.nexid.lat';
  const res = await fetch(`${base}/consumer/me`, { cache: "no-store", headers: { cookie: '' } }).catch(() => null);
  if (!res || !res.ok) return { ok: false };
  return res.json();
}

export default async function MePage() {
  const me = await loadMe();
  const stats = me.stats || {};
  return (
    <PortalShell
      title="Tu pasaporte de productos auténticos"
      subtitle="Guardá productos, sumá puntos por tenant y descubrí marcas premium verificadas en la red nexID."
    >
      {!me.ok ? <section className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">Iniciá sesión desde un tap válido para activar tu portal.</section> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Productos verificados", String(stats.products || 0)],
          ["Taps registrados", String(stats.taps || 0)],
          ["Marcas unidas", String(stats.memberships || 0)],
          ["Notificaciones", String(stats.unread || 0)],
        ].map(([title, value]) => (
          <article key={title} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold text-cyan-200">{value}</p>
          </article>
        ))}
      </div>
    </PortalShell>
  );
}
