import { requireDashboardSession } from "../../../../lib/session";
import { getServerOrigin } from "../../../../lib/server-origin";
import { headers } from "next/headers";
import { Card, SectionHeading } from "@product/ui";
import Link from "next/link";

async function adminGet(origin: string, path: string, cookie?: string) {
  try {
    const response = await fetch(`${origin}/api/admin/${path.replace(/^\/?admin\//, "")}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function LoyaltyOverviewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const requestedTenant = typeof query.tenant === "string" ? query.tenant : "";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : requestedTenant;
  const tenantQuery = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
  const origin = await getServerOrigin();
  const cookie = (await headers()).get("cookie") || "";

  const [loyaltyOverview, consumerOverview, rewardsRaw] = await Promise.all([
    adminGet(origin, `/admin/loyalty/overview${tenantQuery}`, cookie),
    adminGet(origin, `/admin/consumer-network/overview${tenantQuery}`, cookie),
    adminGet(origin, `/admin/loyalty/rewards${tenantQuery}`, cookie),
  ]);

  const overview = loyaltyOverview || { active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 };
  const consumer = consumerOverview?.overview || { riskBlockedClaims: 0, tapToRegistrationRate: 0, registrationToMembershipRate: 0 };
  const rewards = rewardsRaw?.rewards || [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Loyalty Studio</h1>
          <p className="mt-1 text-sm text-slate-400">Rendimiento del programa, métricas de engagement y prevención de fraude.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/loyalty/rewards" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors">
            Ver Catálogo
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Miembros</p>
          <p className="mt-2 text-3xl font-bold text-white">{Number(overview.total_members).toLocaleString("es-AR")}</p>
          <p className="mt-1 text-xs text-slate-500">Miembros enrolados en el programa</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Emitidos</p>
          <p className="mt-2 text-3xl font-bold text-white">{Number(overview.points_issued).toLocaleString("es-AR")}</p>
          <p className="mt-1 text-xs text-slate-500">Otorgados por escaneos válidos</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Canjeados</p>
          <p className="mt-2 text-3xl font-bold text-white">{Number(overview.points_redeemed).toLocaleString("es-AR")}</p>
          <p className="mt-1 text-xs text-emerald-400">Tasa de canje activa</p>
        </article>
        <article className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-400">Reclamos Sospechosos</p>
          <p className="mt-2 text-3xl font-bold text-rose-100">{Number(consumer.riskBlockedClaims || 0)}</p>
          <p className="mt-1 text-xs text-rose-300">Reclamos GPS / móvil bloqueados</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Catálogo de Beneficios Activos</h3>
            {rewards.length ? (
              <ul className="space-y-4">
                 {rewards.slice(0, 5).map((item: any, idx: number) => (
                    <li key={`${item.code}-${idx}`} className="flex justify-between items-center border-b border-white/5 pb-2">
                       <div>
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          <p className="text-xs text-slate-400">Código: {item.code}</p>
                       </div>
                       <div className="text-right">
                          <span className="text-sm font-bold text-emerald-400">{item.points} pts</span>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{item.status}</p>
                       </div>
                    </li>
                 ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No hay recompensas configuradas todavía.</p>
            )}
         </div>

         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Funnel de Engagement de Usuarios</h3>
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Taps Válidos</span>
                     <span className="font-bold text-white">100%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500 w-full"></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Tasa de Registro (Tap → Registro)</span>
                     <span className="font-bold text-white">{Number(consumer.tapToRegistrationRate || 0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500" style={{ width: `${Number(consumer.tapToRegistrationRate || 0)}%` }}></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Tasa de Fidelidad (Registro → Member)</span>
                     <span className="font-bold text-white">{Number(consumer.registrationToMembershipRate || 0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500" style={{ width: `${Number(consumer.registrationToMembershipRate || 0)}%` }}></div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
