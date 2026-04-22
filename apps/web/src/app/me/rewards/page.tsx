import { asArray, fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Reward = { title?: string; points?: number; status?: string; brand?: string };

export default async function RewardsPage() {
  const payload = await fetchConsumerPath("rewards");
  const rewards = asArray<Reward>(payload);

  return (
    <PortalShell title="Rewards & beneficios" subtitle="Puntos por marca, niveles y canjes sin fricción desde tu Passport.">
      {!rewards.length ? (
        <section className="rounded-xl border border-indigo-300/30 bg-indigo-500/10 p-5 text-sm text-indigo-100">Aún no hay rewards activos. Sumá puntos con esta marca desde el próximo tap.</section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {rewards.map((reward, idx) => {
            const status = String(reward.status || "available");
            const tone = status === "redeemed" ? "border-slate-400/30 bg-slate-500/10 text-slate-200" : status === "out_of_stock" ? "border-rose-300/30 bg-rose-500/10 text-rose-100" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
            return (
              <article key={`${reward.title || idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{reward.title || "Benefit"}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>{status.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{reward.brand || "Marca"} · {reward.points || 0} pts</p>
              </article>
            );
          })}
        </section>
      )}
    </PortalShell>
  );
}
