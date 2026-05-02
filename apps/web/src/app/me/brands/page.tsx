import Link from "next/link";
import { Bell, Gift, PackageCheck, Radio, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asArray, fetchConsumerPath, fetchMarketplacePath, requireConsumerSession } from "../_components/consumer-api";
import {
  buildBrandEngagement,
  flattenBrandNotifications,
  type ConsumerBrand,
  type ConsumerPortalProduct,
  type ConsumerTap,
  type MarketplaceListing,
} from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

function statusLabel(status: string) {
  return status === "active" ? "ACTIVE" : status.toUpperCase();
}

export default async function BrandsPage() {
  await requireConsumerSession("/me/brands");
  const [brandsPayload, productsPayload, tapsPayload, marketplacePayload] = await Promise.all([
    fetchConsumerPath("brands"),
    fetchConsumerPath("products"),
    fetchConsumerPath("taps"),
    fetchMarketplacePath("products"),
  ]);
  const brands = asArray<ConsumerBrand>(brandsPayload);
  const products = asArray<ConsumerPortalProduct>(productsPayload);
  const taps = asArray<ConsumerTap>(tapsPayload);
  const listings = asArray<MarketplaceListing>(marketplacePayload);
  const engagement = buildBrandEngagement({ brands, products, taps, listings });
  const notifications = flattenBrandNotifications(engagement);
  const totalPoints = engagement.reduce((sum, item) => sum + item.points, 0);
  const totalPromos = engagement.reduce((sum, item) => sum + item.activePromoCount, 0);
  const totalClaimed = engagement.reduce((sum, item) => sum + item.claimedCount, 0);
  const overviewMetrics: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: "Marcas", value: engagement.length, Icon: Sparkles },
    { label: "Puntos", value: totalPoints, Icon: Trophy },
    { label: "Productos", value: totalClaimed, Icon: PackageCheck },
    { label: "Promos live", value: totalPromos, Icon: Gift },
  ];

  return (
    <PortalShell
      title="Marcas, loyalty y beneficios"
      subtitle="Cada tenant con el que interactuas tiene historial, productos, taps, promos y notificaciones conectadas a tu Passport."
    >
      {!engagement.length ? (
        <section className="consumer-empty-state rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-6 text-sm text-cyan-50">
          Todavia no seguis marcas. Cuando tapes un producto NFC o reclames un beneficio, el tenant aparece aca con su historial y promociones.
        </section>
      ) : (
        <>
          <section className="consumer-network-overview rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Loyalty vivo
                </div>
                <h2 className="mt-4 max-w-2xl text-2xl font-black tracking-tight text-white md:text-4xl">
                  Tus marcas activas se vuelven un canal directo de confianza, recompra y comunidad.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  El consumidor ve que producto verifico, que beneficios tiene disponibles y que novedades publico cada tenant.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {overviewMetrics.map(({ label, value, Icon }) => (
                  <div key={label} className="consumer-metric-card rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                      <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-3xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="consumer-notification-panel rounded-3xl border border-violet-300/20 bg-violet-950/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-200">Centro de notificaciones</p>
                <h2 className="mt-1 text-xl font-black text-white">Promos, taps y productos nuevos por tenant</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-100">
                <Bell className="h-4 w-4" aria-hidden="true" />
                {notifications.length} sin leer
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {notifications.slice(0, 6).map((notification) => (
                <Link
                  key={`${notification.brandSlug}-${notification.id}`}
                  href={notification.href}
                  className={`consumer-notification-card consumer-notification-card--${notification.tone} rounded-2xl border p-4 transition hover:-translate-y-0.5`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]">{notification.brandName}</p>
                  <p className="mt-2 text-sm font-black text-white">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{notification.detail}</p>
                </Link>
              ))}
              {!notifications.length ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300 lg:col-span-3">
                  Cuando un tenant publique un beneficio o el usuario interactue con un producto, las alertas aparecen aca en tiempo real.
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4">
            {engagement.map((item) => (
              <article key={item.key} className="consumer-brand-card overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
                <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="consumer-brand-card-main p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                          <span className="h-2 w-2 rounded-full bg-cyan-300" />
                          {statusLabel(item.status)}
                        </div>
                        <h2 className="mt-3 text-2xl font-black text-white">{item.name}</h2>
                        <p className="mt-1 text-xs text-slate-400">tenant {item.slug || "n/a"} - ultima actividad {item.lastActivityLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-3 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">Nivel</p>
                        <p className="text-xl font-black text-white">{item.tier}</p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-300">Progreso a {item.nextMilestone}</span>
                        <span className="font-black text-cyan-100">{item.progress}%</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="consumer-loyalty-progress h-full rounded-full" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {([
                        { label: "Productos", value: item.productCount, Icon: PackageCheck },
                        { label: "Taps", value: item.tapCount, Icon: Radio },
                        { label: "Promos", value: item.activePromoCount, Icon: Gift },
                        { label: "Alertas", value: item.unreadCount, Icon: Bell },
                      ] satisfies Array<{ label: string; value: number; Icon: LucideIcon }>).map(({ label, value, Icon }) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                          <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                          <p className="mt-2 text-xl font-black text-white">{value}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link href={`/me/marketplace?tenant=${encodeURIComponent(item.slug)}`} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20">
                        Ver promos
                      </Link>
                      <Link href="/me/products" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10">
                        Productos
                      </Link>
                      <Link href="/me/taps" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10">
                        Historial
                      </Link>
                    </div>
                  </div>

                  <div className="consumer-brand-activity border-t border-white/10 p-5 lg:border-l lg:border-t-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Feed del tenant</p>
                        <p className="mt-1 text-sm text-slate-300">Lo que el cliente ve despues del tap.</p>
                      </div>
                      <span className="rounded-full border border-rose-300/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black text-rose-100">
                        {item.unreadCount} new
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {item.notifications.map((notification) => (
                        <Link key={notification.id} href={notification.href} className={`consumer-feed-row consumer-feed-row--${notification.tone} block rounded-2xl border p-3`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-white">{notification.title}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-300">{notification.detail}</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">
                              {notification.type}
                            </span>
                          </div>
                        </Link>
                      ))}
                      {!item.notifications.length ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-xs leading-5 text-slate-300">
                          Sin novedades todavia. Cuando el tenant cargue promos, noticias o productos, este feed se actualiza sin mezclarlo con otras marcas.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </PortalShell>
  );
}
