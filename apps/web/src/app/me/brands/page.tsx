import Link from "next/link";
import { Bell, Gift, PackageCheck, Radio, Sparkles, Trophy, Star, ChevronRight, MessageSquareText } from "lucide-react";
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
import { BrandsVotingClient } from "./brands-voting-client";

function statusLabel(status: string) {
  return status === "active" ? "CLUB ACTIVO" : status.toUpperCase();
}

function tierVisualTheme(tier: string) {
  const t = String(tier || "").toLowerCase();
  if (t.includes("oro") || t.includes("gold")) return {
    border: "border-amber-500/35 shadow-[0_8px_30px_rgba(245,158,11,0.08)]",
    badge: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    gradient: "from-amber-600 to-yellow-400",
    glow: "bg-amber-500"
  };
  if (t.includes("platino") || t.includes("platinum")) return {
    border: "border-slate-300/35 shadow-[0_8px_30px_rgba(226,232,240,0.08)]",
    badge: "border-slate-300/30 bg-slate-300/10 text-slate-100",
    gradient: "from-slate-500 to-slate-200",
    glow: "bg-slate-300"
  };
  return {
    border: "border-cyan-500/20 shadow-[0_8px_30px_rgba(6,182,212,0.05)]",
    badge: "border-cyan-400/20 bg-cyan-500/5 text-cyan-300",
    gradient: "from-cyan-600 to-indigo-400",
    glow: "bg-cyan-500"
  };
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
  
  const overviewMetrics: Array<{ label: string; value: number; Icon: LucideIcon; color: string }> = [
    { label: "Mis Clubes", value: engagement.length, Icon: Sparkles, color: "text-amber-400" },
    { label: "Puntos Totales", value: totalPoints, Icon: Trophy, color: "text-amber-300" },
    { label: "Botellas", value: totalClaimed, Icon: PackageCheck, color: "text-emerald-400" },
    { label: "Drops Habilitados", value: totalPromos, Icon: Gift, color: "text-cyan-400" },
  ];

  return (
    <PortalShell
      title="Marcas, Fidelización & Clubes"
      subtitle="Accede a los canales directos de tus bodegas preferidas: puntos acumulados, membresías VIP exclusivas y drops premium."
      notificationCount={notifications.length}
    >
      {!engagement.length ? (
        <section className="rounded-3xl border border-dashed border-white/10 bg-slate-950/25 p-8 text-center text-slate-400">
          <Sparkles className="mx-auto h-8 w-8 text-slate-600 animate-pulse" />
          <h3 className="mt-3 text-sm font-black text-white">No perteneces a ningún club de marcas</h3>
          <p className="mt-1 text-xs text-slate-500">
            Escanea tu primera botella nexID y reclama su propiedad para habilitar beneficios y activar tu membresía.
          </p>
        </section>
      ) : (
        <>
          {/* Header Dashboard Metrics */}
          <section className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#121215_0%,#0e0e10_100%)] p-6 shadow-xl">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/5 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Membresías Conectadas
                </div>
                <h2 className="mt-4 max-w-xl text-2xl font-black tracking-tight text-white leading-tight">
                  Tus interacciones reales activan canales exclusivos de confianza.
                </h2>
                <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-400">
                  Cada vez que compras y registras una botella nexID, acumulas puntos de fidelización de la bodega emisora, canjeables por visitas a bodegas, cenas exclusivas y drops limitados.
                </p>
              </div>
              <div className="grid gap-2.5 grid-cols-2">
                {overviewMetrics.map(({ label, value, Icon, color }) => (
                  <div key={label} className="rounded-2xl border border-white/5 bg-slate-900/30 p-4 transition duration-300 hover:border-white/10">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Live Notification Center */}
          <section className="rounded-3xl border border-purple-500/20 bg-purple-950/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-purple-300">Mensajes de Fidelización</p>
                <h2 className="mt-1 text-base font-black text-white">Promociones Directas & Actualizaciones del Club</h2>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-bold text-rose-300">
                <Bell className="h-3.5 w-3.5" />
                {notifications.length} Novedades
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {notifications.slice(0, 6).map((notification) => (
                <Link
                  key={`${notification.brandSlug}-${notification.id}`}
                  href={notification.href}
                  className="rounded-2xl border border-white/5 bg-slate-950/50 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-purple-500/30 hover:bg-slate-950/80"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-purple-400">{notification.brandName}</span>
                  <p className="mt-1.5 text-xs font-black text-white">{notification.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{notification.detail}</p>
                </Link>
              ))}
              {!notifications.length && (
                <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-xs text-slate-400 lg:col-span-3 text-center">
                  No hay notificaciones ni actualizaciones pendientes de tus marcas.
                </div>
              )}
            </div>
          </section>

          {/* Brands List */}
          <section className="grid gap-6">
            {engagement.map((item) => {
              const theme = tierVisualTheme(item.tier);
              return (
                <article key={item.key} className={`overflow-hidden rounded-3xl border ${theme.border} bg-slate-950/70 p-5 transition duration-300 hover:border-white/10`}>
                  <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    
                    {/* Left Panel: Membership Info & Milestone progression */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${theme.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${theme.glow} animate-pulse`} />
                              {statusLabel(item.status)}
                            </div>
                            <h2 className="mt-3 text-xl font-black text-white tracking-tight">{item.name}</h2>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Tenant: <span className="font-mono">{item.slug || "n/a"}</span> · Actividad: {item.lastActivityLabel}
                            </p>
                          </div>
                          
                          <div className={`rounded-xl border ${theme.badge} px-3 py-1 text-center shrink-0`}>
                            <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-bold">Nivel</span>
                            <span className="text-xs font-black text-white flex items-center gap-1 mt-0.5">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                              {item.tier}
                            </span>
                          </div>
                        </div>

                        {/* Progression bar */}
                        <div className="mt-6">
                          <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
                            <span className="text-slate-400">Progreso a {item.nextMilestone}</span>
                            <span className="text-white">{item.progress}%</span>
                          </div>
                          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                            <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} transition-all duration-1000`} style={{ width: `${item.progress}%` }} />
                          </div>
                        </div>

                        {/* Summary Grid stats */}
                        <div className="mt-6 grid grid-cols-4 gap-2">
                          {[
                            { label: "Botellas", value: item.productCount, Icon: PackageCheck, color: "text-emerald-400" },
                            { label: "Escaneos", value: item.tapCount, Icon: Radio, color: "text-cyan-400" },
                            { label: "Drops Live", value: item.activePromoCount, Icon: Gift, color: "text-amber-400" },
                            { label: "Alertas", value: item.unreadCount, Icon: Bell, color: "text-rose-400" },
                          ].map(({ label, value, Icon, color }) => (
                            <div key={label} className="rounded-xl border border-white/5 bg-slate-900/30 p-2 text-center">
                              <Icon className={`h-3.5 w-3.5 mx-auto ${color}`} />
                              <p className="mt-1 text-sm font-black text-white leading-tight">{value}</p>
                              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Brand Links */}
                      <div className="mt-6 flex flex-wrap gap-2.5">
                        <Link href={`/me/marketplace?tenant=${encodeURIComponent(item.slug)}`} className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 transition">
                          Ver Drops & Promos
                        </Link>
                        <Link href="/me/products" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition">
                          Mis Botellas
                        </Link>
                        <Link href="/me/taps" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition">
                          Historial
                        </Link>
                      </div>
                    </div>

                    {/* Right Panel: Feed & Recent Collections */}
                    <div className="border-t border-white/5 pt-5 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Últimos Mensajes del Viñedo</h3>
                          <span className="rounded bg-rose-500/15 border border-rose-500/25 px-1.5 py-0.5 text-[8px] font-bold text-rose-300">
                            {item.unreadCount} Nuevos
                          </span>
                        </div>

                        {/* Chat / Feed list */}
                        <div className="mt-3 space-y-2">
                          {item.notifications.slice(0, 2).map((notification) => (
                            <Link key={notification.id} href={notification.href} className="block rounded-xl border border-white/5 bg-slate-900/35 p-3 hover:bg-slate-900/50 transition">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold text-white leading-snug">{notification.title}</p>
                                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{notification.detail}</p>
                                </div>
                                <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[7px] font-bold uppercase text-slate-400">
                                  {notification.type}
                                </span>
                              </div>
                            </Link>
                          ))}
                          {!item.notifications.length && (
                            <p className="text-[10px] text-slate-500 py-3 text-center italic">Sin mensajes de fidelización por el momento.</p>
                          )}
                        </div>
                      </div>

                      {/* Linked Products & Recent Scan Timeline */}
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/5 bg-slate-900/20 p-3">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-2">Mis Vinos Registrados</span>
                          <div className="space-y-1.5">
                            {item.products.slice(0, 2).map((product, idx) => (
                              <div key={idx} className="rounded-lg border border-white/5 bg-slate-950/40 p-2 text-[10px]">
                                <p className="font-bold text-white leading-normal truncate">{product.product_name || "Vino"}</p>
                                <p className="text-slate-400 mt-0.5">BID {product.bid || "n/a"}</p>
                              </div>
                            ))}
                            {!item.products.length && <p className="text-[9px] text-slate-600">Ninguno todavía.</p>}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/5 bg-slate-900/20 p-3">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-2">Escaneos Recientes</span>
                          <div className="space-y-1.5">
                            {item.taps.slice(0, 2).map((tap, idx) => (
                              <div key={idx} className="rounded-lg border border-white/5 bg-slate-950/40 p-2 text-[10px] flex items-center justify-between gap-1.5">
                                <div className="truncate">
                                  <p className="font-bold text-emerald-400 leading-normal uppercase text-[9px]">{String(tap.verdict || "tap").toUpperCase()}</p>
                                  <p className="text-slate-400 mt-0.5 truncate">{tap.city || "Ubicación"}</p>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                              </div>
                            ))}
                            {!item.taps.length && <p className="text-[9px] text-slate-600">Ninguno todavía.</p>}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <BrandsVotingClient />
        </>
      )}
    </PortalShell>
  );
}
