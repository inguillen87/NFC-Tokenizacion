import Link from "next/link";
import { Gift, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, fetchMarketplacePath, requireConsumerSession } from "../_components/consumer-api";
import { buildBrandEngagement, type ConsumerBrand, type ConsumerPortalProduct, type ConsumerTap, type MarketplaceListing } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

type Reward = {
  title?: string;
  points?: number;
  points_cost?: number;
  status?: string;
  state?: string;
  brand?: string;
  tenant_slug?: string;
  redemption_code?: string | null;
};

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const voucher = typeof params.voucher === "string" ? params.voucher.replace(/[^\dA-Z-]/gi, "").slice(0, 32) : "";
  const tenant = typeof params.tenant === "string" ? params.tenant.replace(/[^a-z0-9-]/gi, "").slice(0, 60) : "";
  await requireConsumerSession(buildConsumerNextPath("/me/rewards", { voucher, tenant }));
  const [rewardsPayload, brandsPayload, productsPayload, tapsPayload, marketplacePayload] = await Promise.all([
    fetchConsumerPath("rewards"),
    fetchConsumerPath("brands"),
    fetchConsumerPath("products"),
    fetchConsumerPath("taps"),
    fetchMarketplacePath("products"),
  ]);
  const rewards = asArray<Reward>(rewardsPayload);
  const highlightedReward = voucher
    ? rewards.find((reward) => String(reward.redemption_code || "").replace(/\s+/g, "").toUpperCase() === voucher.toUpperCase())
    : null;
  const brandEngagement = buildBrandEngagement({
    brands: asArray<ConsumerBrand>(brandsPayload),
    products: asArray<ConsumerPortalProduct>(productsPayload),
    taps: asArray<ConsumerTap>(tapsPayload),
    listings: asArray<MarketplaceListing>(marketplacePayload),
  });
  const marketplaceRewards = brandEngagement.flatMap((brand) => brand.listings.map((listing) => ({ brand, listing })));
  const points = brandEngagement.reduce((sum, brand) => sum + brand.points, 0);
  
  const metrics: Array<{ label: string; value: number; Icon: LucideIcon; color: string }> = [
    { label: "Puntos Disponibles", value: points, Icon: Trophy, color: "text-amber-400" },
    { label: "Clubes Activos", value: brandEngagement.length, Icon: Sparkles, color: "text-cyan-400" },
    { label: "Canjes Habilitados", value: rewards.length + marketplaceRewards.length, Icon: Gift, color: "text-emerald-400" },
  ];

  return (
    <PortalShell title="Rewards & Beneficios" subtitle="Puntos acumulados, niveles VIP, vouchers y experiencias exclusivas activadas por tu colección." notificationCount={marketplaceRewards.length}>
      
      {/* Loyalty Engine Banner */}
      <section className="rounded-3xl border border-emerald-500/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_50%),linear-gradient(135deg,#0a0a0c,#131316)] p-6 shadow-2xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Loyalty engine nexID</p>
            <h2 className="mt-3 text-xl font-black text-white tracking-tight leading-none">Un canal VIP de fidelización directo</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-xl">
              Los beneficios son publicados por cada bodega emisora y quedan vinculados de forma segura a tus botellas escaneadas. Acumulas puntos reales y accedes a sorteos y catas privadas.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2.5 lg:min-w-80">
            {metrics.map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-xl border border-white/5 bg-slate-950/60 p-3.5 text-center">
                <Icon className={`h-4.5 w-4.5 mx-auto ${color}`} />
                <p className="mt-2 text-xl font-black text-white leading-none">{value}</p>
                <span className="text-[8px] uppercase tracking-wider text-slate-500 mt-1.5 block font-bold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {voucher ? (
        <section className="rounded-3xl border border-cyan-400/25 bg-cyan-500/10 p-5 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-200">Voucher abierto desde email</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">{highlightedReward?.title || "Voucher nexID"}</h2>
              <p className="mt-1 text-xs text-slate-300">
                Codigo: <span className="font-mono font-black text-cyan-100">{voucher}</span>
                {tenant ? <> · Emisor verificado por nexID</> : null}
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100">
              {highlightedReward ? String(highlightedReward.state || highlightedReward.status || "claimed") : "pendiente"}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Mostra este codigo o el pase QR recibido por WhatsApp/email en el comercio. El staff valida el canje desde el CRM nexID.
          </p>
        </section>
      ) : null}

      {/* Redeemed Vouchers list */}
      {rewards.length ? (
        <section className="grid gap-4 md:grid-cols-2">
          {rewards.map((reward, idx) => {
            const status = String(reward.status || reward.state || "available");
            const isRedeemed = status === "redeemed";
            const tone = isRedeemed 
              ? "border-white/5 bg-slate-900/40 text-slate-500" 
              : status === "out_of_stock" 
              ? "border-rose-500/25 bg-rose-500/5 text-rose-300" 
              : "border-emerald-500/25 bg-emerald-500/5 text-emerald-300";
              
            return (
              <article key={`${reward.title || idx}`} className={`rounded-2xl border ${tone} bg-slate-950/70 p-4 transition duration-300 hover:border-white/10`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{reward.title || "Beneficio"}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                    isRedeemed ? "border-white/5 bg-slate-900 text-slate-500" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}>{status.toUpperCase()}</span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Marca: <span className="font-bold text-slate-300">{reward.brand || "nexID Partner"}</span> · Costo: <span className="font-bold text-amber-200">{reward.points || 0} pts</span>
                </p>
                {reward.redemption_code ? (
                  <p className="mt-1 text-[10px] text-cyan-100">
                    Codigo de canje: <span className="font-mono font-black">{reward.redemption_code}</span>
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {/* Available Marketplace Rewards */}
      <section className="grid gap-4 md:grid-cols-2">
        {marketplaceRewards.map(({ brand, listing }, idx) => (
          <article key={`${listing.id || listing.title || idx}`} className="rounded-3xl border border-white/5 bg-slate-950/60 p-5 transition duration-300 hover:border-white/10 hover:shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-cyan-300">{brand.name}</p>
                <h3 className="mt-1.5 text-base font-black text-white leading-snug tracking-tight">{listing.title || "Beneficio disponible"}</h3>
                <p className="mt-1 text-[10px] text-slate-400">
                  Costo: <span className="font-bold text-amber-200">{listing.points_price || 0} pts</span> · Estatus: <span className="font-mono text-slate-300">{listing.stock_status || listing.status || "disponible"}</span>
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">ACTIVO</span>
            </div>
            
            <p className="mt-3.5 rounded-xl border border-white/5 bg-slate-900/30 p-3 text-[10px] leading-relaxed text-slate-400">
              Canje disponible para miembros con botellas verificadas de la marca. Habilita el reclamo de voucher digital en el marketplace.
            </p>
            
            <Link href={`/me/marketplace?tenant=${encodeURIComponent(brand.slug)}`} className="mt-4 inline-flex rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 transition">
              Canjear en Marketplace
            </Link>
          </article>
        ))}
        {!rewards.length && !marketplaceRewards.length ? (
          <section className="rounded-2xl border border-dashed border-white/10 bg-slate-950/25 p-8 text-center text-slate-400 md:col-span-2">
            <Gift className="mx-auto h-8 w-8 text-slate-600 animate-pulse" />
            <p className="mt-3 text-xs">Aún no hay beneficios activos en tu cuenta.</p>
            <p className="mt-1 text-[10px] text-slate-500 max-w-sm mx-auto">
              Cuando los viñedos asociados publiquen experiencias o drops, aparecerán listados aquí.
            </p>
          </section>
        ) : null}
      </section>
      
    </PortalShell>
  );
}
