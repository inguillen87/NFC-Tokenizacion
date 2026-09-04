import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../../components/data-table";
import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";
import {
  buildUtcHourlyHeatmap,
  describeProductActivity,
  formatUtcTimestamp,
  parseConsumerNetworkMembers,
  parseConsumerNetworkOverview,
  parseConsumerNetworkProducts,
  parseConsumerNetworkTaps,
  withTenantScope,
  type ConsumerNetworkOverviewMetrics,
  type ParsedConsumerNetworkPayload,
} from "../../../../lib/consumer-network-overview-truth";

type SourceAvailability = "ready" | "empty" | "unavailable" | "error";
type SourceReason = "ready" | "empty" | "forbidden" | "demo_rejected" | "invalid_payload" | "upstream_error" | "unreachable";
type AdminGetResult<T> = {
  availability: SourceAvailability;
  reason: SourceReason;
  data: T | null;
  source: "production" | "demo" | "unavailable";
  endpoint: string;
  observedAt: string;
  latestRecordedAt: string | null;
};
type PayloadParser<T> = (payload: unknown, expectedTenant: string) => ParsedConsumerNetworkPayload<T> | null;

async function adminGet<T>(
  context: AdminPageContext,
  path: string,
  allowDemoData: boolean,
  parse: PayloadParser<T>,
): Promise<AdminGetResult<T>> {
  const failed = (
    availability: Extract<SourceAvailability, "unavailable" | "error">,
    reason: Extract<SourceReason, "forbidden" | "demo_rejected" | "invalid_payload" | "upstream_error" | "unreachable">,
  ): AdminGetResult<T> => ({
    availability,
    reason,
    data: null,
    source: "unavailable",
    endpoint: path,
    observedAt: new Date().toISOString(),
    latestRecordedAt: null,
  });

  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    if (response.status === 401 || response.status === 403) return failed("unavailable", "forbidden");
    if (!response.ok) return failed("error", "upstream_error");

    const payload = await response.json().catch(() => null);
    const upstreamUnavailable = Boolean(
      payload
      && typeof payload === "object"
      && !Array.isArray(payload)
      && (payload as { ok?: boolean }).ok === false,
    );
    if (upstreamUnavailable) return failed("error", "upstream_error");
    if (meta.demoMode && !allowDemoData) return failed("unavailable", "demo_rejected");

    const parsed = parse(payload, context.tenantSlug);
    if (!parsed) return failed("unavailable", "invalid_payload");

    return {
      availability: parsed.empty ? "empty" : "ready",
      reason: parsed.empty ? "empty" : "ready",
      data: parsed.data,
      source: meta.demoMode ? "demo" : "production",
      endpoint: path,
      observedAt: new Date().toISOString(),
      latestRecordedAt: parsed.latestRecordedAt,
    };
  } catch {
    return failed("error", "unreachable");
  }
}

function sourceIsConfirmed(availability: SourceAvailability) {
  return availability === "ready" || availability === "empty";
}

function sourceStateLabel(result: AdminGetResult<unknown>) {
  if (result.availability === "ready") return "Disponible con registros";
  if (result.availability === "empty") return "Vacío confirmado";
  if (result.reason === "forbidden") return "No disponible por permisos";
  if (result.reason === "demo_rejected") return "Fuente demo rechazada en sesión operativa";
  if (result.reason === "invalid_payload") return "No disponible: contrato inválido";
  if (result.reason === "unreachable") return "Error de conexión";
  return "Error del servicio";
}

function SourceEvidenceCard({ label, result }: { label: string; result: AdminGetResult<unknown> }) {
  const confirmed = sourceIsConfirmed(result.availability);
  const provenance = result.source === "production"
    ? "API operativa declarada por el BFF"
    : result.source === "demo"
      ? "Sandbox demo declarado por el BFF"
      : "Procedencia no confirmada";
  const latest = result.latestRecordedAt
    ? formatUtcTimestamp(result.latestRecordedAt)
    : result.availability === "empty"
      ? "Sin registros en la respuesta válida"
      : confirmed
        ? "La API no informa timestamp de corte"
        : "No confirmada";

  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/55 p-3" data-source-state={result.availability}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">{label}</h3>
        <span className={result.availability === "error" ? "text-rose-200" : result.availability === "unavailable" ? "text-amber-200" : "text-emerald-200"}>
          {sourceStateLabel(result)}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-slate-400">
        <div><dt className="inline text-slate-500">Procedencia: </dt><dd className="inline">{provenance}</dd></div>
        <div><dt className="inline text-slate-500">Endpoint: </dt><dd className="inline font-mono">{result.endpoint}</dd></div>
        <div><dt className="inline text-slate-500">Último registro: </dt><dd className="inline">{latest}</dd></div>
        <div><dt className="inline text-slate-500">Consulta observada: </dt><dd className="inline">{formatUtcTimestamp(result.observedAt)}</dd></div>
      </dl>
    </article>
  );
}

function pct(value: number | undefined, available = true) {
  return available && typeof value === "number" ? `${value.toFixed(1)}%` : "—";
}

export default async function PortalUsuariosOverviewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const adminContext = await createAdminPageContext(session, query.tenant);
  const allowDemoData = Boolean(session.isDemo);

  const [overviewResult, membersResult, productsResult, tapsResult] = await Promise.all([
    adminGet(adminContext, "/admin/consumer-network/overview", allowDemoData, parseConsumerNetworkOverview),
    adminGet(adminContext, "/admin/consumer-network/members", allowDemoData, parseConsumerNetworkMembers),
    adminGet(adminContext, "/admin/consumer-network/products", allowDemoData, parseConsumerNetworkProducts),
    adminGet(adminContext, "/admin/consumer-network/taps", allowDemoData, parseConsumerNetworkTaps),
  ]);

  const overviewReady = sourceIsConfirmed(overviewResult.availability);
  const membersReady = sourceIsConfirmed(membersResult.availability);
  const productsReady = sourceIsConfirmed(productsResult.availability);
  const tapsReady = sourceIsConfirmed(tapsResult.availability);
  const sourceEntries = [
    ["Resumen", overviewResult],
    ["Miembros", membersResult],
    ["Productos", productsResult],
    ["Taps", tapsResult],
  ] as const;
  const visibleSources = sourceEntries
    .map(([, result]) => result)
    .filter((result) => sourceIsConfirmed(result.availability))
    .map((result) => result.source);
  const dataSource = visibleSources.length === 0
    ? "unavailable"
    : visibleSources.every((source) => source === "production")
      ? "production"
      : visibleSources.every((source) => source === "demo")
        ? "demo"
        : "mixed";
  const unavailableSources = sourceEntries.filter(([, result]) => result.availability === "unavailable");
  const errorSources = sourceEntries.filter(([, result]) => result.availability === "error");
  const retryHref = withTenantScope("/consumer-network/overview", adminContext.tenantSlug);
  const membersHref = withTenantScope("/consumer-network/overview#miembros", adminContext.tenantSlug);
  const productsHref = withTenantScope("/consumer-network/overview#productos", adminContext.tenantSlug);
  const tapsHref = withTenantScope("/consumer-network/overview#taps", adminContext.tenantSlug);

  const overviewPayload = overviewResult.data;
  const overview: Partial<ConsumerNetworkOverviewMetrics> = overviewPayload?.overview || {};
  const topProductsByClaims = overviewPayload?.topProductsByClaims || [];
  const members = membersResult.data || [];
  const products = productsResult.data || [];
  const taps = tapsResult.data || [];
  const heatmapCells = tapsReady ? buildUtcHourlyHeatmap(taps) : [];

  const description = dataSource === "demo"
    ? "Escenario demo aislado: separa lecturas, acciones, unidades y actores sin afirmar personas ni conversiones reales."
    : dataSource === "production"
      ? "Actividad agregada y relaciones de actores devueltas por fuentes operativas dentro del alcance autorizado."
      : dataSource === "mixed"
        ? "La vista combina fuentes operativas y demo declaradas; cada módulo muestra su procedencia y no se agrega como un único total productivo."
        : "No hay una fuente confirmada para mostrar métricas; la vista conserva el estado de error o indisponibilidad sin fabricar ceros.";

  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Clientes CRM" title="Clientes & campañas" description={description} />

      <nav aria-label="Secciones de clientes y campañas" className="flex flex-wrap gap-2 text-xs">
        <a href={membersHref} className="rounded-lg border border-white/10 bg-slate-900/55 px-3 py-2 font-bold text-slate-200">Miembros</a>
        <a href={productsHref} className="rounded-lg border border-white/10 bg-slate-900/55 px-3 py-2 font-bold text-slate-200">Productos</a>
        <a href={tapsHref} className="rounded-lg border border-white/10 bg-slate-900/55 px-3 py-2 font-bold text-slate-200">Actividad</a>
      </nav>

      <div data-testid="consumer-network-source" data-data-source={dataSource} className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-xs text-slate-300">
        Fuente visible: <b className={dataSource === "production" ? "text-emerald-200" : dataSource === "unavailable" ? "text-slate-200" : "text-amber-200"}>{dataSource}</b>
        {dataSource === "demo" ? " · DEMO DATA; no se agrega como actividad productiva." : null}
        {dataSource === "mixed" ? " · FUENTES MIXTAS; consultar la procedencia de cada módulo." : null}
        <span className="ml-2">Scope: <b>{adminContext.isGlobal ? "global autorizado" : adminContext.tenantSlug}</b>.</span>
      </div>

      <section data-testid="consumer-network-provenance" className="rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Procedencia y vigencia</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Cada fuente conserva su propio estado</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-slate-400">Zona horaria visible: UTC. “Consulta observada” es la hora en que el dashboard recibió la respuesta; no equivale al corte del dataset. Cuando la API no informa ese corte, se declara expresamente.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sourceEntries.map(([label, result]) => <SourceEvidenceCard key={label} label={label} result={result} />)}
        </div>
      </section>

      {errorSources.length ? (
        <EnterpriseOpsState
          variant="error"
          title="Error al consultar fuentes del CRM"
          description="El servicio devolvió un error o no pudo establecerse la conexión. Los módulos afectados no se convierten en actividad cero."
          checklist={errorSources.map(([name, result]) => `${name}: ${sourceStateLabel(result)}`)}
          action={<a href={retryHref} className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100">Reintentar con el mismo tenant</a>}
          testId="consumer-network-source-errors"
        />
      ) : null}

      {unavailableSources.length ? (
        <EnterpriseOpsState
          variant="warning"
          title="CRM parcialmente disponible"
          description="Una o más fuentes no pudieron validarse o no están autorizadas. Los módulos afectados muestran valores no disponibles en lugar de convertir la ausencia en cero actividad."
          checklist={unavailableSources.map(([name, result]) => `${name}: ${sourceStateLabel(result)}`)}
          action={<a href={retryHref} className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100">Reintentar con el mismo tenant</a>}
          testId="consumer-network-partial-sources"
        />
      ) : null}

      {overviewResult.availability === "empty" ? (
        <EnterpriseOpsState
          variant="empty"
          title="Sin actividad confirmada en este scope"
          description="La fuente de resumen respondió con un contrato válido y métricas en cero. Este estado sí representa un vacío confirmado, no una falla encubierta."
          testId="consumer-network-overview-empty"
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Lecturas NFC / QR</p>
          <p className="mt-2 text-3xl font-bold text-white">{overviewReady ? Number(overview.totalTaps) : "—"}</p>
          <p className="mt-1 text-xs text-slate-400">Lecturas registradas por la API; no prueban presencia física por sí solas.</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Acciones post-tap</p>
          <p className="mt-2 text-3xl font-bold text-white">{overviewReady ? Number(overview.customerActions) : "—"}</p>
          <p className="mt-1 text-xs text-slate-400">Contenido, servicios y CTAs registrados.</p>
        </article>
        <article className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Unidades reconocidas</p>
          <p className="mt-2 text-3xl font-bold text-cyan-100">{overviewReady ? Number(overview.recognizedUnits) : "—"}</p>
          <p className="mt-1 text-xs text-cyan-200">Tags registrados distintos; no son personas.</p>
        </article>
        <article className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-violet-300">Actividad sin actor</p>
          <p className="mt-2 text-3xl font-bold text-violet-100">{overviewReady ? Number(overview.activityWithoutActor) : "—"}</p>
          <p className="mt-1 text-xs text-violet-200">Eventos aún no vinculados a un actor conocido.</p>
        </article>
      </div>

      <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Analytics command center</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{overviewReady ? "Cobertura de actividad e identidad" : "Métricas sin fuente disponible"}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">{overviewReady ? "Separamos actividad, unidades, actores y permisos de contacto; un UID nunca se interpreta como una persona." : "No mostramos métricas en cero cuando la fuente overview no respondió con un contrato válido."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Actividad vinculada <b className="text-cyan-100">{pct(overview.actorLinkedActivityRate, overviewReady)}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Actores conocidos <b className="text-violet-100">{overviewReady ? Number(overview.knownActors) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Identidad verificada <b className="text-sky-100">{overviewReady ? Number(overview.verifiedIdentityActors) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Email opt-in <b className="text-emerald-100">{overviewReady ? Number(overview.consentedActorsByChannel?.email) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">WhatsApp opt-in <b className="text-emerald-100">{overviewReady ? Number(overview.consentedActorsByChannel?.whatsapp) : "—"}</b></span>
            <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-200">Teléfono opt-in <b className="text-emerald-100">{overviewReady ? Number(overview.consentedActorsByChannel?.phone) : "—"}</b></span>
          </div>
        </div>
        <div className="mt-5" id="taps">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Heatmap horario de taps asociados · UTC</p>
          {tapsResult.availability === "ready" ? (
            <>
              <div className="mt-2 grid grid-cols-12 gap-1">
                {heatmapCells.map((cell) => (
                  <div
                    key={cell.hour}
                    title={`${String(cell.hour).padStart(2, "0")}:00 UTC · ${cell.count} taps`}
                    className="h-9 rounded-md border border-white/10"
                    style={{ backgroundColor: `rgba(34, 211, 238, ${0.08 + cell.intensity * 0.62})` }}
                  >
                    <span className="sr-only">{String(cell.hour).padStart(2, "0")}:00 UTC {cell.count} taps</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>00h UTC</span><span>12h UTC</span><span>23h UTC</span></div>
            </>
          ) : tapsResult.availability === "empty" ? (
            <EnterpriseOpsState compact variant="empty" title="Sin taps en el scope" description="La fuente respondió correctamente con una lista vacía; no se dibuja una grilla de ceros como si fueran observaciones horarias." testId="consumer-taps-empty" />
          ) : (
            <EnterpriseOpsState compact variant={tapsResult.availability === "error" ? "error" : "warning"} title="Heatmap no disponible" description="La fuente de taps no confirmó registros; no generamos una grilla de ceros." />
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Miembros activos del tenant</p>
          <p className="mt-2 text-2xl font-bold text-white">{overviewReady ? Number(overview.activeTenantMembers) : "—"}</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Productos guardados</p>
          <p className="mt-2 text-2xl font-bold text-white">{overviewReady ? Number(overview.savedProducts) : "—"}</p>
        </article>
        <article className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-300">Claims bloqueados por riesgo</p>
          <p className="mt-2 text-2xl font-bold text-rose-100">{overviewReady ? Number(overview.riskBlockedClaims) : "—"}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Límites de uso de los datos</h3>
          <div className="mt-3 space-y-2 text-xs text-slate-300">
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2"><b className="text-cyan-100">Analítica:</b> usa actividad agregada, incluso cuando no existe un actor conocido.</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2"><b className="text-violet-100">Relación:</b> sólo usa actividad vinculada a un actor conocido.</p>
            <p className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2"><b className="text-emerald-100">Campañas:</b> requieren miembro activo y consentimiento vigente para el canal y propósito exactos.</p>
          </div>
        </section>
        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Productos con más claims</h3>
          <div className="mt-3 space-y-2">
            {topProductsByClaims.length ? topProductsByClaims.map((item) => (
              <div key={`${item.bid}-${item.productName}`} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                {item.productName} · BID {item.bid} · claims {item.claims}
              </div>
            )) : <p className="text-xs text-slate-400">{overviewReady ? "Respuesta válida sin claims para el scope actual." : "La fuente overview no está disponible."}</p>}
          </div>
        </section>
      </div>

      <section id="miembros">
        {membersReady ? (
          <DataTable
            title="Actores conocidos"
            columns={[
              { key: "actor", label: "Alias o contacto enmascarado" },
              { key: "tenant", label: "Tenant" },
              { key: "status", label: "Estado reportado" },
              { key: "points", label: "Puntos reportados" },
              { key: "last", label: "Última actividad (UTC)" },
            ]}
            rows={members.map((item) => ({
              actor: item.label,
              tenant: item.tenantSlug,
              status: item.status,
              points: item.pointsBalance === null ? "—" : String(item.pointsBalance),
              last: formatUtcTimestamp(item.lastActivityAt),
            }))}
            filterKey="status"
            loadingLabel="Actualizando miembros"
            emptyLabel="La fuente respondió correctamente y confirmó que no hay miembros para este scope."
          />
        ) : (
          <EnterpriseOpsState
            variant={membersResult.availability === "error" ? "error" : "warning"}
            title="Miembros no disponibles"
            description="Fuente de miembros no disponible; no es un cero confirmado. Ningún UID se usa como nombre de persona."
            testId="consumer-members-unavailable"
          />
        )}
      </section>

      <section id="productos">
        {productsReady ? (
          <DataTable
            title="Conversión por producto"
            columns={[
              { key: "product", label: "Producto" },
              { key: "tenant", label: "Tenant" },
              { key: "claimed", label: "Claims" },
              { key: "saved", label: "Guardados" },
              { key: "status", label: "Lectura derivada" },
              { key: "last", label: "Última actividad (UTC)" },
            ]}
            rows={products.map((item) => ({
              product: item.productName,
              tenant: item.tenantSlug,
              claimed: String(item.claimedCount),
              saved: String(item.savedCount),
              status: describeProductActivity(item),
              last: formatUtcTimestamp(item.latestActivityAt),
            }))}
            filterKey="status"
            loadingLabel="Actualizando conversión por producto"
            emptyLabel="La fuente respondió correctamente y confirmó que no hay conversión de productos para este scope."
          />
        ) : (
          <EnterpriseOpsState
            variant={productsResult.availability === "error" ? "error" : "warning"}
            title="Productos no disponibles"
            description="Fuente de productos no disponible; no se deriva un estado active, pending o risk desde campos ausentes."
            testId="consumer-products-unavailable"
          />
        )}
      </section>

      <section>
        {tapsReady ? (
          <DataTable
            title="Actividad de taps"
            columns={[
              { key: "event", label: "ID de evento" },
              { key: "tenant", label: "Tenant" },
              { key: "verdict", label: "Veredicto reportado" },
              { key: "risk", label: "Riesgo reportado" },
              { key: "at", label: "Creado (UTC)" },
            ]}
            rows={taps.map((item) => ({
              event: item.eventId,
              tenant: item.tenantSlug,
              verdict: item.verdict || "No informado por la fuente",
              risk: item.riskLevel || "No informado por la fuente",
              at: formatUtcTimestamp(item.createdAt),
            }))}
            filterKey="verdict"
            loadingLabel="Actualizando actividad de taps"
            emptyLabel="La fuente respondió correctamente y confirmó que no hay taps para este scope."
          />
        ) : (
          <EnterpriseOpsState
            variant={tapsResult.availability === "error" ? "error" : "warning"}
            title="Actividad de taps no disponible"
            description="Fuente de taps no disponible; no es un cero confirmado y no se inventan veredictos ni riesgo."
            testId="consumer-taps-unavailable"
          />
        )}
      </section>
    </main>
  );
}
