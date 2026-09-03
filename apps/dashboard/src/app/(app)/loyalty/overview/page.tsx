import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { Card, SectionHeading } from "@product/ui";
import Link from "next/link";

async function adminGet(context: AdminPageContext, path: string) {
  try {
    const response = await fetchAdminPage(context, path);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function metricText(value: unknown, available: boolean) {
  return available ? Number(value || 0).toLocaleString("es-AR") : "—";
}

function rateText(value: unknown, available: boolean) {
  return available ? `${Number(value || 0)}%` : "—";
}

function rateWidth(value: unknown, available: boolean) {
  if (!available) return "0%";
  return `${Math.max(0, Math.min(100, Number(value || 0)))}%`;
}

export default async function LoyaltyOverviewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession("rewards:read");
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;

  const [loyaltyOverview, consumerOverview, rewardsRaw] = await Promise.all([
    adminGet(adminContext, "/admin/loyalty/overview"),
    adminGet(adminContext, "/admin/consumer-network/overview"),
    adminGet(adminContext, tenantScope ? "/admin/loyalty/rewards" : "/admin/loyalty/rewards?scope=global"),
  ]);

  const loyaltyReady = Boolean(loyaltyOverview && typeof loyaltyOverview === "object" && !Array.isArray(loyaltyOverview));
  const consumerReady = Boolean(consumerOverview?.overview && typeof consumerOverview.overview === "object" && !Array.isArray(consumerOverview.overview));
  const rewardsReady = Array.isArray(rewardsRaw?.rewards);
  const overview = loyaltyReady ? loyaltyOverview : {};
  const consumer = consumerReady ? consumerOverview.overview : {};
  const rewards = rewardsReady ? rewardsRaw.rewards : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">CRM de clientes</h1>
          <p className="mt-1 text-sm text-slate-400">Rendimiento de beneficios, miembros, canjes y prevención de fraude post-tap.</p>
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

      {!loyaltyReady || !consumerReady || !rewardsReady ? (
        <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-4 text-xs text-amber-100" role="status">
          Fuentes parciales: los módulos no disponibles se muestran con “—”; no se convierten en actividad cero ni en tasas estimadas.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Miembros</p>
          <p className="mt-2 text-3xl font-bold text-white">{metricText(overview.total_members, loyaltyReady)}</p>
          <p className="mt-1 text-xs text-slate-500">{loyaltyReady ? "Miembros enrolados en el programa" : "Fuente loyalty no disponible"}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Emitidos</p>
          <p className="mt-2 text-3xl font-bold text-white">{metricText(overview.points_issued, loyaltyReady)}</p>
          <p className="mt-1 text-xs text-slate-500">{loyaltyReady ? "Otorgados por mensajes NFC válidos según policy" : "Fuente loyalty no disponible"}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Canjeados</p>
          <p className="mt-2 text-3xl font-bold text-white">{metricText(overview.points_redeemed, loyaltyReady)}</p>
          <p className="mt-1 text-xs text-emerald-400">{loyaltyReady ? "Canjes confirmados por la fuente" : "Fuente loyalty no disponible"}</p>
        </article>
        <article className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-400">Reclamos Sospechosos</p>
          <p className="mt-2 text-3xl font-bold text-rose-100">{metricText(consumer.riskBlockedClaims, consumerReady)}</p>
          <p className="mt-1 text-xs text-rose-300">{consumerReady ? "Reclamos GPS / móvil bloqueados" : "Fuente consumer no disponible"}</p>
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
              <p className="text-xs text-slate-400">{rewardsReady ? "No hay recompensas configuradas todavía." : "Fuente de recompensas no disponible; no se infiere un catálogo vacío."}</p>
            )}
         </div>

         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <h3 className="text-sm font-bold text-white mb-4">Funnel de Engagement de Usuarios</h3>
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Mensajes NFC válidos (base)</span>
                     <span className="font-bold text-white">{consumerReady ? "Base" : "—"}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500" style={{ width: consumerReady ? "100%" : "0%" }}></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Tasa de Registro (Tap → Registro)</span>
                     <span className="font-bold text-white">{rateText(consumer.tapToRegistrationRate, consumerReady)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500" style={{ width: rateWidth(consumer.tapToRegistrationRate, consumerReady) }}></div>
                  </div>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Tasa de Fidelidad (Registro → Member)</span>
                     <span className="font-bold text-white">{rateText(consumer.registrationToMembershipRate, consumerReady)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500" style={{ width: rateWidth(consumer.registrationToMembershipRate, consumerReady) }}></div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
