import { fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type WalletPayload = { balance_points?: number; memberships?: number; saved_products?: number; trust_score?: number };

export default async function WalletPage() {
  const wallet = (await fetchConsumerPath("wallet")) as WalletPayload | null;

  return (
    <PortalShell title="Wallet" subtitle="Balance de puntos, estado de membresías y score de confianza consolidado.">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Puntos", String(wallet?.balance_points || 0)],
          ["Membresías", String(wallet?.memberships || 0)],
          ["Productos guardados", String(wallet?.saved_products || 0)],
          ["Trust score", `${wallet?.trust_score || 0}/100`],
        ].map(([k, v]) => (
          <article key={k} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{k}</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-100">{v}</p>
          </article>
        ))}
      </section>
    </PortalShell>
  );
}
