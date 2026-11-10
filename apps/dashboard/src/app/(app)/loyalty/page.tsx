import { SectionHeading } from "@product/ui";
import Link from "next/link";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { customerRecordQuantity } from "../../../lib/customer-inbox-state";
import { readDemoDataMetaFromResponse } from "../../../lib/demo-data-mode";

type LoyaltyAvailability = "ready" | "ready_empty" | "forbidden" | "upstream_error";
type LoyaltySource = "production" | "demo" | "unavailable";
type AdminReadResult = {
  availability: LoyaltyAvailability;
  data: Record<string, unknown> | null;
  source: LoyaltySource;
};

async function adminGet(context: AdminPageContext, path: string): Promise<AdminReadResult> {
  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    const payload = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) return { availability: "forbidden", data: null, source: "unavailable" };
    if (!response.ok || response.headers.get("x-nexid-data-mode")?.trim().toLowerCase() !== meta.dataSource
      || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { availability: "upstream_error", data: null, source: "unavailable" };
    }
    if ((payload as { ok?: boolean }).ok === false) {
      return { availability: "upstream_error", data: null, source: "unavailable" };
    }
    return { availability: "ready", data: payload as Record<string, unknown>, source: meta.demoMode ? "demo" : "production" };
  } catch {
    return { availability: "upstream_error", data: null, source: "unavailable" };
  }
}

type HubMetric = { value: string | null; detail: string };
type CatalogReward = { code: string; title: string; points: number; status: string; tenant_slug: string };

function unavailableDetail(availability: LoyaltyAvailability) {
  return availability === "forbidden" ? "No disponible con tus permisos" : "Fuente no disponible";
}

function overviewMetric(read: AdminReadResult, key: string, readyDetail: string): HubMetric {
  if (read.availability !== "ready" || !read.data) return { value: null, detail: unavailableDetail(read.availability) };
  if (!Object.hasOwn(read.data, key)) return { value: null, detail: "No informado por la fuente" };
  const value = customerRecordQuantity(read.data[key], "");
  return value ? { value, detail: readyDetail } : { value: null, detail: "No se pudo confirmar este dato" };
}

function catalogRows(read: AdminReadResult, tenant: string): CatalogReward[] | null {
  const data = read.data;
  if (read.availability !== "ready" || !data || data.ok !== true
    || data.tenant !== (tenant || null) || data.scope !== (tenant ? "tenant" : "global")
    || !Array.isArray(data.rewards)) return null;
  return data.rewards.every((item: unknown): item is CatalogReward => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row.code === "string" && Boolean(row.code.trim())
      && typeof row.title === "string" && Boolean(row.title.trim())
      && customerRecordQuantity(row.points, "") !== ""
      && typeof row.status === "string" && Boolean(row.status.trim())
      && Object.hasOwn(row, "tenant_slug") && typeof row.tenant_slug === "string"
      && row.tenant_slug.trim().length > 0
      && (!tenant || row.tenant_slug === tenant);
  }) ? data.rewards : null;
}

export default async function LoyaltyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession("rewards:read");
  const isSuperadmin = session.role === "super-admin";
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;

  const [portfolioResult, rewardsResult, overviewResult] = await Promise.all([
    isSuperadmin ? adminGet(adminContext, "/superadmin/loyalty/portfolio") : Promise.resolve(null),
    adminGet(adminContext, tenantScope ? "/admin/loyalty/rewards" : "/admin/loyalty/rewards?scope=global"),
    adminGet(adminContext, "/admin/loyalty/overview"),
  ]);
  const portfolio = Array.isArray(portfolioResult?.data?.portfolio) ? portfolioResult.data.portfolio : [];
  const rewardsResponse = catalogRows(rewardsResult, tenantScope);
  const rewardsAvailability: LoyaltyAvailability = rewardsResult.availability !== "ready"
    ? rewardsResult.availability
    : rewardsResponse
      ? rewardsResponse.length ? "ready" : "ready_empty"
      : "upstream_error";
  const credits = overviewMetric(overviewResult, "points_issued", "Puntos sumados en programas activos.");
  const enrollments = overviewMetric(overviewResult, "total_members", "Una persona puede figurar en varios programas activos.");
  const overviewAvailability: LoyaltyAvailability = overviewResult.availability !== "ready"
    ? overviewResult.availability
    : credits.value !== null && enrollments.value !== null ? "ready" : "upstream_error";
  const availability: LoyaltyAvailability = [rewardsAvailability, overviewAvailability].includes("forbidden")
    ? "forbidden"
    : [rewardsAvailability, overviewAvailability].includes("upstream_error")
      ? "upstream_error"
      : rewardsAvailability === "ready_empty" ? "ready_empty" : "ready";
  const rewardCount: HubMetric = rewardsResponse === null
    ? { value: null, detail: unavailableDetail(rewardsAvailability) }
    : { value: String(rewardsResponse.length), detail: "Incluye todos los estados del catálogo." };
  const metrics = [
    { label: "Puntos acreditados", metric: credits, source: overviewResult.source },
    { label: "Recompensas configuradas", metric: rewardCount, source: rewardsResult.source },
    { label: "Inscripciones en programas", metric: enrollments, source: overviewResult.source },
  ];
  const source: LoyaltySource = metrics.some(item => item.metric.value !== null && item.source === "demo")
    ? "demo"
    : (availability === "ready" || availability === "ready_empty") && rewardsResult.source === "production" && overviewResult.source === "production"
      ? "production"
      : "unavailable";

  return (
    <main className="space-y-8" data-loyalty-availability={availability} data-loyalty-source={source}>
      <SectionHeading eyebrow={copy.nav.loyalty} title={copy.pages.loyalty.title} description={copy.pages.loyalty.description} />
      <Link href={`/loyalty/configuration${tenantScope ? `?${new URLSearchParams({ tenant: tenantScope })}` : ""}`} className="inline-flex min-h-11 items-center rounded-lg border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-200">Configurar servicios, puntos y trivias</Link>

      {availability === "forbidden" ? (
        <div role="alert" className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-5 text-sm text-amber-100">
          Esta sesión no tiene acceso a una o más fuentes de fidelización. Cada indicador muestra su propio estado.
        </div>
      ) : availability === "upstream_error" ? (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-400/[0.07] p-5 text-sm text-rose-100">
          Algunas cifras de fidelización están pendientes de confirmar. Los indicadores no disponibles se muestran con “—”, nunca como actividad cero.
        </div>
      ) : null}
      {source === "demo" ? (
        <div role="status" className="rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.06] p-4 text-xs text-cyan-100">
          Los indicadores marcados como Demo contienen datos ilustrativos.
        </div>
      ) : null}

      {isSuperadmin && portfolio.length > 0 && (
        <section className="mb-8 rounded-2xl border border-emerald-300/20 bg-slate-900/40 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Superadmin: Loyalty Portfolio</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {portfolio.slice(0, 3).map((item: any) => (
              <div key={item.program_id} className="rounded-xl border border-white/10 bg-slate-950 p-4">
                <p className="text-sm font-semibold text-white">{item.tenant_name} · {item.program_name}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Miembros: <b className="text-slate-200">{item.enrolled_members}</b></span>
                  <span>Puntos: <b className="text-slate-200">{item.points_issued}</b></span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="loyalty-hub-indicators" className="rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.15),transparent_40%),#020617] p-5 shadow-[0_24px_70px_rgba(2,6,23,.7)] md:p-6">
        <h2 id="loyalty-hub-indicators" className="text-sm font-semibold text-emerald-200">
          Indicadores de fidelización {tenantScope ? `(${tenantScope})` : "(Global)"}
        </h2>
        <p className="mt-2 text-sm text-slate-100">Configurá recompensas, puntos y niveles VIP vinculados a escaneos válidos.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {metrics.map(({ label, metric, source: metricSource }) => (
            <article key={label} className="min-w-0 rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-slate-300">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-white tabular-nums [overflow-wrap:anywhere]">{metric.value ?? "—"}</p>
              <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
              {metric.value !== null && metricSource === "demo" ? <p className="mt-2 text-xs font-semibold text-amber-200">Demo</p> : null}
            </article>
          ))}
        </div>
      </section>

      {rewardsResponse !== null ? <DataTable {...copy.tableFeedback}
        title="Catálogo de recompensas"
        columns={[{ key: "code", label: "Código" }, { key: "title", label: "Título" }, { key: "points", label: "Costo (Pts)" }, { key: "status", label: "Estado" }]}
        rows={rewardsResponse.map(r => ({ code: r.code, title: r.title, points: String(r.points), status: r.status }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel="No hay recompensas configuradas todavía."
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
      /> : null}
    </main>
  );
}
