import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { TenantEngagementPanel } from "../../../../components/tenant-engagement-panel";
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

function tenantDisplayName(tenantSlug: string | null) {
  const normalized = String(tenantSlug || "").trim().toLowerCase();
  if (!normalized) return "Red multi-tenant";
  if (normalized === "demobodega" || normalized === "bodegabalmec" || normalized === "bodega-balmec") {
    return "Bodega Balmec";
  }
  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

export default async function LoyaltyOverviewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession("crm:read");
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const tenantName = tenantDisplayName(tenantScope);
  const canReadEngagement = dashboardPermissionMatches(
    session.permissions,
    "crm:read",
    session.deniedPermissions,
  );

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Actividad post-tap</h1>
          <p className="mt-1 text-sm text-slate-400">Acciones post-tap, consentimiento, beneficios y seguimiento operativo del tenant.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/loyalty/rewards" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors">
            Ver Catálogo
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Workspace activo: <b className="text-white">{tenantName}</b>
      </div>

      {!loyaltyReady || !consumerReady || !rewardsReady ? (
        <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-4 text-xs text-amber-100" role="status">
          Fuentes parciales: los módulos no disponibles se muestran con “—”; no se convierten en actividad cero ni en tasas estimadas.
        </div>
      ) : null}

      <TenantEngagementPanel tenantSlug={tenantScope} tenantName={tenantName} canRead={canReadEngagement} />

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
            <h3 className="text-sm font-bold text-white mb-2">Cobertura de relación y permisos</h3>
            <p className="mb-5 text-xs text-slate-400">Actividad, actores conocidos y permisos son métricas independientes. Un UID o dispositivo no se cuenta como persona.</p>
            <div className="space-y-5">
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Actividad registrada</span>
                     <span className="font-bold text-white">{metricText(consumer.totalActivity, consumerReady)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Lecturas físicas más acciones post-tap persistidas.</p>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Actividad vinculada a un actor conocido</span>
                     <span className="font-bold text-white">{rateText(consumer.actorLinkedActivityRate, consumerReady)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500" style={{ width: rateWidth(consumer.actorLinkedActivityRate, consumerReady) }}></div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Actores conocidos</p><p className="mt-1 text-lg font-bold text-white">{metricText(consumer.knownActors, consumerReady)}</p></div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Identidad verificada</p><p className="mt-1 text-lg font-bold text-sky-300">{metricText(consumer.verifiedIdentityActors, consumerReady)}</p></div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Email opt-in</p><p className="mt-1 text-lg font-bold text-emerald-300">{metricText(consumer.consentedActorsByChannel?.email, consumerReady)}</p></div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">WhatsApp opt-in</p><p className="mt-1 text-lg font-bold text-emerald-300">{metricText(consumer.consentedActorsByChannel?.whatsapp, consumerReady)}</p></div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Teléfono opt-in</p><p className="mt-1 text-lg font-bold text-emerald-300">{metricText(consumer.consentedActorsByChannel?.phone, consumerReady)}</p></div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
