import Link from "next/link";
import { Gift, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asArray, fetchConsumerPath, fetchMarketplacePath, requireConsumerSession } from "../_components/consumer-api";
import { buildBrandEngagement, type ConsumerBrand, type ConsumerPortalProduct, type ConsumerTap, type MarketplaceListing } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

type Reward = { title?: string; points?: number; status?: string; brand?: string };

export default async function RewardsPage() {
  await requireConsumerSession("/me/rewards");
  const [rewardsPayload, brandsPayload, productsPayload, tapsPayload, marketplacePayload] = await Promise.all([
    fetchConsumerPath("rewards"),
    fetchConsumerPath("brands"),
    fetchConsumerPath("products"),
    fetchConsumerPath("taps"),
    fetchMarketplacePath("products"),
  ]);
  const rewards = asArray<Reward>(rewardsPayload);
  const brandEngagement = buildBrandEngagement({
    brands: asArray<ConsumerBrand>(brandsPayload),
    products: asArray<ConsumerPortalProduct>(productsPayload),
    taps: asArray<ConsumerTap>(tapsPayload),
    listings: asArray<MarketplaceListing>(marketplacePayload),
  });
  const marketplaceRewards = brandEngagement.flatMap((brand) => brand.listings.map((listing) => ({ brand, listing })));
  const points = brandEngagement.reduce((sum, brand) => sum + brand.points, 0);
  const metrics: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: "Puntos", value: points, Icon: Trophy },
    { label: "Marcas", value: brandEngagement.length, Icon: Sparkles },
    { label: "Canjes", value: rewards.length + marketplaceRewards.length, Icon: Gift },
  ];

  return (
    <PortalShell title="Rewards & beneficios" subtitle="Puntos, niveles, canjes y experiencias activadas por producto verificado.">
      <section className="consumer-rewards-hero rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Loyalty engine</p>
            <h2 className="mt-2 text-2xl font-black text-white">Un sistema de fidelizacion por marca, no un cupon suelto.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Los beneficios salen del tenant y se conectan con productos, taps, puntos y ownership. Si una marca publica una promo, aparece en el portal del usuario.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-80">
            {metrics.map(({ label, value, Icon }) => (
              <div key={label} className="consumer-metric-card rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                <Icon className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {rewards.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {rewards.map((reward, idx) => {
            const status = String(reward.status || "available");
            const tone = status === "redeemed" ? "border-slate-400/30 bg-slate-500/10 text-slate-200" : status === "out_of_stock" ? "border-rose-300/30 bg-rose-500/10 text-rose-100" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
            return (
              <article key={`${reward.title || idx}`} className="consumer-reward-card rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-white">{reward.title || "Benefit"}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>{status.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{reward.brand || "Marca"} - {reward.points || 0} pts</p>
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {marketplaceRewards.map(({ brand, listing }, idx) => (
          <article key={`${listing.id || listing.title || idx}`} className="consumer-reward-card rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">{brand.name}</p>
                <h2 className="mt-2 text-lg font-black text-white">{listing.title || "Beneficio disponible"}</h2>
                <p className="mt-1 text-xs text-slate-400">{listing.points_price || 0} pts - estado {listing.stock_status || listing.status || "available"}</p>
              </div>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">live</span>
            </div>
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
              Disponible para miembros que interactuaron con productos del tenant. Se puede canjear o solicitar desde marketplace.
            </p>
            <Link href={`/me/marketplace?tenant=${encodeURIComponent(brand.slug)}`} className="mt-4 inline-flex rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20">
              Abrir beneficio
            </Link>
          </article>
        ))}
        {!rewards.length && !marketplaceRewards.length ? (
          <section className="consumer-empty-state rounded-2xl border border-indigo-300/30 bg-indigo-500/10 p-6 text-sm text-indigo-100 md:col-span-2">
            Aun no hay rewards activos. Cuando el tenant publique puntos, vouchers, preventas o experiencias, van a aparecer aca conectados al historial del cliente.
          </section>
        ) : null}
      </section>
    </PortalShell>
  );
}
