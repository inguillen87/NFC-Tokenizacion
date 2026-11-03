import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { dashboardHighImpactPermissionMatches, dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { TenantEngagementPanel } from "../../../../components/tenant-engagement-panel";
import { projectConsumerNetworkOverview, type ConsumerOverviewMetricField, type ConsumerOverviewRateField } from "../../../../lib/consumer-network-overview-truth";
import Link from "next/link";

type JsonRecord = Record<string, unknown>;
type ReadReason = "ready" | "forbidden" | "session_unavailable" | "upstream_error" | "invalid_payload" | "demo_rejected" | "unreachable";
type AdminRead = { source: "production" | "demo"; reason: "ready"; payload: JsonRecord }
  | { source: "unavailable"; reason: Exclude<ReadReason, "ready">; payload: null };
const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const owns = (record: JsonRecord, key: string) => Object.hasOwn(record, key);
const unavailableField = (): ConsumerOverviewMetricField => ({ state: "unavailable", value: null });

async function adminGet(context: AdminPageContext, path: string, allowDemoData: boolean): Promise<AdminRead> {
  const failed = (reason: Exclude<ReadReason, "ready">): AdminRead => ({ source: "unavailable", reason, payload: null });
  try {
    const response = await fetchAdminPage(context, path);
    if (response.status === 401 || response.status === 403) return failed("forbidden");
    if (response.status === 503 && response.headers.get("x-nexid-auth-outcome") === "session-resolver-unavailable") return failed("session_unavailable");
    if (!response.ok) return failed("upstream_error");
    const source = String(response.headers.get("x-nexid-data-mode") || "").trim().toLowerCase();
    if (source !== "production" && source !== "demo") return failed("invalid_payload");
    if (source === "demo" && !allowDemoData) return failed("demo_rejected");
    const payload: unknown = await response.json().catch(() => null);
    if (!isRecord(payload)) return failed("invalid_payload");
    if (owns(payload, "ok") && payload.ok !== true) return failed("upstream_error");
    if ((owns(payload, "demoMode") && payload.demoMode !== (source === "demo"))
      || (owns(payload, "dataSource") && payload.dataSource !== source)
      || (owns(payload, "demo") && payload.demo !== (source === "demo"))) return failed("invalid_payload");
    return { source, reason: "ready", payload };
  } catch {
    return failed("unreachable");
  }
}

function loyaltyField(read: AdminRead, key: string): ConsumerOverviewMetricField {
  if (read.source === "unavailable") return unavailableField();
  if (!owns(read.payload, key)) return { state: "missing", value: null };
  const value = read.payload[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? { state: "ready", value } : { state: "invalid", value: null };
}

type OverviewReward = { code: string; title: string; points: number; status: unknown; tenant_slug: string };
function overviewRewards(read: AdminRead, tenant: string): OverviewReward[] | null {
  if (read.source === "unavailable") return null;
  const body = read.payload;
  if (!["ok", "tenant", "scope", "rewards"].every(key => owns(body, key)) || body.ok !== true || body.tenant !== (tenant || null) || body.scope !== (tenant ? "tenant" : "global") || !Array.isArray(body.rewards)) return null;
  const rows: OverviewReward[] = [];
  for (const row of body.rewards) {
    if (!isRecord(row) || !["code", "title", "points", "tenant_slug"].every(key => owns(row, key))
      || typeof row.code !== "string" || !row.code.trim()
      || typeof row.title !== "string" || !row.title.trim()
      || typeof row.points !== "number" || !Number.isSafeInteger(row.points) || row.points < 0
      || typeof row.tenant_slug !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(row.tenant_slug)
      || (tenant && row.tenant_slug !== tenant)) return null;
    rows.push({ code: row.code, title: row.title, points: row.points, status: row.status, tenant_slug: row.tenant_slug });
  }
  return rows;
}

function rewardStatusLabel(value: unknown) {
  switch (value) {
    case "active": return "Activo";
    case "paused": return "Pausado";
    case "draft": return "Borrador";
    case "archived": return "Archivado";
    default: return "Estado sin confirmar";
  }
}

function metricText(field: ConsumerOverviewMetricField, available: boolean) {
  return available && field.state === "ready" ? field.value.toLocaleString("es-AR") : "—";
}

function rateText(field: ConsumerOverviewRateField, available: boolean) {
  if (!available) return "—";
  return field.state === "no_base" ? "Sin actividad" : field.state === "ready" ? `${field.value.toLocaleString("es-AR")}%` : "—";
}

function missingMetricCopy(field: ConsumerOverviewMetricField, reason: ReadReason, readyCopy = "") {
  if (field.state === "ready") return readyCopy;
  if (reason === "forbidden") return "No disponible con tus permisos";
  if (field.state === "missing") return "No informado por la fuente";
  if (field.state === "invalid") return "No se pudo confirmar este dato";
  return "Fuente no disponible";
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
  const canStreamEngagement = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "events.read_sensitive",
    session.deniedPermissions,
  );

  const allowDemoData = Boolean(session.isDemo);
  const [loyaltyRead, consumerRead, rewardsRead] = await Promise.all([
    adminGet(adminContext, "/admin/loyalty/overview", allowDemoData),
    adminGet(adminContext, "/admin/consumer-network/overview", allowDemoData),
    adminGet(adminContext, tenantScope ? "/admin/loyalty/rewards" : "/admin/loyalty/rewards?scope=global", allowDemoData),
  ]);

  const overview = {
    active_programs: loyaltyField(loyaltyRead, "active_programs"),
    total_members: loyaltyField(loyaltyRead, "total_members"),
    points_issued: loyaltyField(loyaltyRead, "points_issued"),
    points_redeemed: loyaltyField(loyaltyRead, "points_redeemed"),
  };
  const loyaltyReady = Object.values(overview).every(field => field.state === "ready");
  let projection = consumerRead.source === "unavailable" ? null : projectConsumerNetworkOverview(consumerRead.payload, tenantScope);
  if (consumerRead.source === "demo" && projection && projection.provenance.counts.operationalTap > 0) projection = null;
  const consumerReady = Boolean(projection);
  const consumer = {
    riskBlockedClaims: projection?.counts.riskBlockedClaims || unavailableField(),
    totalActivity: projection?.counts.totalActivity || unavailableField(),
    knownActors: projection?.counts.knownActors || unavailableField(),
    verifiedIdentityActors: projection?.counts.verifiedIdentityActors || unavailableField(),
    actorLinkedActivityRate: projection?.rate || unavailableField(),
    consentedActorsByChannel: projection?.channels || { email: unavailableField(), whatsapp: unavailableField(), phone: unavailableField() },
  };
  const catalog = overviewRewards(rewardsRead, tenantScope);
  const rewardsReady = catalog !== null;
  const rewards = catalog || [];
  const demoBlocks = [
    loyaltyRead.source === "demo" ? "puntos y miembros" : null,
    consumerRead.source === "demo" ? "actividad y consentimientos" : null,
    rewardsRead.source === "demo" ? "beneficios" : null,
  ].filter((label): label is string => label !== null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Actividad post-tap</h1>
          <p className="mt-1 text-sm text-slate-400">Consultá las lecturas, acciones y beneficios de tu empresa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/loyalty/configuration${tenantScope ? `?${new URLSearchParams({ tenant: tenantScope })}` : ""}`} className="min-h-11 px-4 py-2 border border-cyan-300/30 text-cyan-200 text-sm font-semibold rounded-lg">
            Configurar servicios y trivias
          </Link>
          <Link href={`/loyalty/rewards${tenantScope ? `?${new URLSearchParams({ tenant: tenantScope })}` : ""}`} className="min-h-11 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors">
            Ver Catálogo
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        {tenantScope ? "Empresa actual: " : "Vista de empresas: "}<b className="text-white">{tenantName}</b>
        {demoBlocks.length ? <p className="mt-2 text-xs text-amber-200">Datos de demostración en: {demoBlocks.join(", ")}. Las cifras disponibles de esos bloques son de ejemplo.</p> : null}
      </div>

      {!loyaltyReady || !consumerReady || projection?.availability === "partial" || !rewardsReady ? (
        <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-4 text-xs text-amber-100" role="status">
          Fuentes parciales: los módulos no disponibles se muestran con “—”; no se convierten en actividad cero ni en tasas estimadas.
        </div>
      ) : null}

      <TenantEngagementPanel
        tenantSlug={tenantScope}
        tenantName={tenantName}
        canRead={canReadEngagement}
        streamEnabled={canStreamEngagement}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="min-w-0 rounded-xl border border-white/10 bg-slate-900/50 p-4" data-source-mode={loyaltyRead.source}>
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Miembros</p>
          <p className="mt-2 text-3xl font-bold text-white tabular-nums [overflow-wrap:anywhere]">{metricText(overview.total_members, loyaltyRead.source !== "unavailable")}</p>
          <p className="mt-1 text-xs text-slate-500">{missingMetricCopy(overview.total_members, loyaltyRead.reason, "Miembros enrolados en el programa")}</p>
          {loyaltyRead.source === "demo" ? <p className="mt-2 text-xs font-semibold text-amber-200">Demo</p> : null}
        </article>
        <article className="min-w-0 rounded-xl border border-white/10 bg-slate-900/50 p-4" data-source-mode={loyaltyRead.source}>
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Emitidos</p>
          <p className="mt-2 text-3xl font-bold text-white tabular-nums [overflow-wrap:anywhere]">{metricText(overview.points_issued, loyaltyRead.source !== "unavailable")}</p>
          <p className="mt-1 text-xs text-slate-500">{missingMetricCopy(overview.points_issued, loyaltyRead.reason, "Puntos otorgados por la plataforma")}</p>
          {loyaltyRead.source === "demo" ? <p className="mt-2 text-xs font-semibold text-amber-200">Demo</p> : null}
        </article>
        <article className="min-w-0 rounded-xl border border-white/10 bg-slate-900/50 p-4" data-source-mode={loyaltyRead.source}>
          <p className="text-xs uppercase tracking-widest text-slate-400">Puntos Canjeados</p>
          <p className="mt-2 text-3xl font-bold text-white tabular-nums [overflow-wrap:anywhere]">{metricText(overview.points_redeemed, loyaltyRead.source !== "unavailable")}</p>
          <p className="mt-1 text-xs text-emerald-400">{missingMetricCopy(overview.points_redeemed, loyaltyRead.reason, "Canjes confirmados por la fuente")}</p>
          {loyaltyRead.source === "demo" ? <p className="mt-2 text-xs font-semibold text-amber-200">Demo</p> : null}
        </article>
        <article className="min-w-0 rounded-xl border border-rose-500/20 bg-rose-950/20 p-4" data-source-mode={consumerRead.source}>
          <p className="text-xs uppercase tracking-widest text-rose-400">Titularidad con restricciones</p>
          <p className="mt-2 text-3xl font-bold text-rose-100 tabular-nums [overflow-wrap:anywhere]">{metricText(consumer.riskBlockedClaims, consumerReady)}</p>
          <p className="mt-1 text-xs text-rose-300">{missingMetricCopy(consumer.riskBlockedClaims, consumerRead.reason, "Lectura repetida, revocación o disputa.")}</p>
          {consumerRead.source === "demo" ? <p className="mt-2 text-xs font-semibold text-amber-200">Demo</p> : null}
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6" data-source-mode={rewardsRead.source}>
            <h2 className="text-sm font-bold text-white mb-2">Últimos beneficios configurados</h2>
            {rewardsRead.source === "demo" ? <p className="mb-2 text-xs font-semibold text-amber-200">Demo</p> : null}
            <p className="mb-4 text-xs text-slate-400">Hasta cinco beneficios recientes. El estado no confirma que puedan reservarse; cada reserva se valida en el portal.</p>
            {rewards.length ? (
              <ul className="space-y-4">
                 {rewards.slice(0, 5).map((item: any, idx: number) => (
                    <li key={`${item.code}-${idx}`} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
                       <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white [overflow-wrap:anywhere]">{item.title}</p>
                          <p className="text-xs text-slate-400 [overflow-wrap:anywhere]">Código: {item.code}</p>
                          {!tenantScope ? <p className="text-xs text-slate-400 [overflow-wrap:anywhere]">Empresa: {item.tenant_slug}</p> : null}
                       </div>
                       <div className="shrink-0 text-right">
                          <span className="text-sm font-bold text-emerald-400">{item.points} pts</span>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{rewardStatusLabel(item.status)}</p>
                       </div>
                    </li>
                 ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">{rewardsReady ? "No hay recompensas configuradas todavía." : "Fuente de recompensas no disponible; no se infiere un catálogo vacío."}</p>
            )}
         </div>

         <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6" data-source-mode={consumerRead.source}>
            <h2 className="text-sm font-bold text-white mb-2">Cobertura de relación y permisos</h2>
            {consumerRead.source === "demo" ? <p className="mb-2 text-xs font-semibold text-amber-200">Demo</p> : null}
            <p className="mb-5 text-xs text-slate-400">Actividad, actores conocidos y permisos son métricas independientes. Un UID o dispositivo no se cuenta como persona.</p>
            <div className="space-y-5">
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Actividad registrada</span>
                     <span className="font-bold text-white">{metricText(consumer.totalActivity, consumerReady)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{missingMetricCopy(consumer.totalActivity, consumerRead.reason, "Actividad operativa registrada por la plataforma.")}</p>
               </div>
               <div>
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Actividad vinculada a un actor conocido</span>
                     <span className="font-bold text-white">{rateText(consumer.actorLinkedActivityRate, consumerReady)}</span>
                  </div>
                  {consumerReady && consumer.actorLinkedActivityRate.state === "ready" ? (
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden" aria-hidden="true">
                       <div className="h-full bg-cyan-500" style={{ width: `${consumer.actorLinkedActivityRate.value}%` }}></div>
                    </div>
                  ) : null}
                  {consumer.actorLinkedActivityRate.state !== "ready" && consumer.actorLinkedActivityRate.state !== "no_base" ? <p className="mt-1 text-[11px] text-slate-500">{missingMetricCopy(consumer.actorLinkedActivityRate, consumerRead.reason)}</p> : null}
               </div>
               <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Actores conocidos</p><p className="mt-1 text-lg font-bold text-white tabular-nums [overflow-wrap:anywhere]">{metricText(consumer.knownActors, consumerReady)}</p>{consumer.knownActors.state !== "ready" ? <p className="mt-1 text-[11px] text-slate-400">{missingMetricCopy(consumer.knownActors, consumerRead.reason)}</p> : null}</div>
                  <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Identidad verificada</p><p className="mt-1 text-lg font-bold text-sky-300 tabular-nums [overflow-wrap:anywhere]">{metricText(consumer.verifiedIdentityActors, consumerReady)}</p>{consumer.verifiedIdentityActors.state !== "ready" ? <p className="mt-1 text-[11px] text-slate-400">{missingMetricCopy(consumer.verifiedIdentityActors, consumerRead.reason)}</p> : null}</div>
                  <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Email opt-in</p><p className="mt-1 text-lg font-bold text-emerald-300 tabular-nums [overflow-wrap:anywhere]">{metricText(consumer.consentedActorsByChannel.email, consumerReady)}</p>{consumer.consentedActorsByChannel.email.state !== "ready" ? <p className="mt-1 text-[11px] text-slate-400">{missingMetricCopy(consumer.consentedActorsByChannel.email, consumerRead.reason)}</p> : null}</div>
                  <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">WhatsApp opt-in</p><p className="mt-1 text-lg font-bold text-emerald-300 tabular-nums [overflow-wrap:anywhere]">{metricText(consumer.consentedActorsByChannel.whatsapp, consumerReady)}</p>{consumer.consentedActorsByChannel.whatsapp.state !== "ready" ? <p className="mt-1 text-[11px] text-slate-400">{missingMetricCopy(consumer.consentedActorsByChannel.whatsapp, consumerRead.reason)}</p> : null}</div>
                  <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-slate-400">Teléfono opt-in</p><p className="mt-1 text-lg font-bold text-emerald-300 tabular-nums [overflow-wrap:anywhere]">{metricText(consumer.consentedActorsByChannel.phone, consumerReady)}</p>{consumer.consentedActorsByChannel.phone.state !== "ready" ? <p className="mt-1 text-[11px] text-slate-400">{missingMetricCopy(consumer.consentedActorsByChannel.phone, consumerRead.reason)}</p> : null}</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
