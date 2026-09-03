import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
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
    if (response.status === 403) return { availability: "forbidden", data: null, source: "unavailable" };
    if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
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
  const rewardsPayload = rewardsResult.data?.rewards;
  const rewardsAvailability: LoyaltyAvailability = rewardsResult.availability !== "ready"
    ? rewardsResult.availability
    : Array.isArray(rewardsPayload)
      ? rewardsPayload.length ? "ready" : "ready_empty"
      : "upstream_error";
  const rewardsResponse = Array.isArray(rewardsPayload) ? rewardsPayload : [];
  const overviewPayload = overviewResult.data;
  const overviewReady = overviewResult.availability === "ready"
    && Boolean(overviewPayload)
    && (
      Object.prototype.hasOwnProperty.call(overviewPayload, "points_issued")
      || Object.prototype.hasOwnProperty.call(overviewPayload, "total_members")
    );
  const overviewAvailability: LoyaltyAvailability = overviewResult.availability !== "ready"
    ? overviewResult.availability
    : overviewReady ? "ready" : "upstream_error";
  const overview = overviewReady ? overviewPayload! : {};
  const availability: LoyaltyAvailability = [rewardsAvailability, overviewAvailability].includes("forbidden")
    ? "forbidden"
    : [rewardsAvailability, overviewAvailability].includes("upstream_error")
      ? "upstream_error"
      : rewardsAvailability === "ready_empty" ? "ready_empty" : "ready";
  const source: LoyaltySource = rewardsResult.source === "demo" || overviewResult.source === "demo"
    ? "demo"
    : rewardsResult.source === "production" && overviewResult.source === "production"
      ? "production"
      : "unavailable";
  const metricsAvailable = overviewAvailability === "ready";
  const rewardsAvailable = rewardsAvailability === "ready" || rewardsAvailability === "ready_empty";

  return (
    <main className="space-y-8" data-loyalty-availability={availability} data-loyalty-source={source}>
      <SectionHeading eyebrow={copy.nav.loyalty} title={copy.pages.loyalty.title} description={copy.pages.loyalty.description} />

      {availability === "forbidden" ? (
        <div role="alert" className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-5 text-sm text-amber-100">
          Esta sesión no tiene acceso a una o más fuentes de loyalty. No se consultan ni reemplazan con datos de ejemplo.
        </div>
      ) : availability === "upstream_error" ? (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-400/[0.07] p-5 text-sm text-rose-100">
          No se pudo confirmar el estado completo de loyalty. Los indicadores no disponibles se muestran con “—”, nunca como actividad cero.
        </div>
      ) : source === "demo" ? (
        <div role="status" className="rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.06] p-4 text-xs text-cyan-100">
          Datos ilustrativos del sandbox · no representan actividad ni persistencia productiva.
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

      <section className="rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,.15),transparent_40%),#020617] p-5 shadow-[0_24px_70px_rgba(2,6,23,.7)] md:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-emerald-200">
          {metricsAvailable && rewardsAvailable ? "Loyalty confirmado" : "Estado de loyalty no confirmado"} {tenantScope ? `(${tenantScope})` : "(Global)"}
        </p>
        <p className="mt-2 text-sm text-slate-100">Configurá recompensas, puntos y niveles VIP vinculados a escaneos válidos.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-emerald-300/30">
            <p className="text-2xl font-semibold text-white">{metricsAvailable ? String(overview.points_issued ?? 0) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Puntos emitidos</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-emerald-300/30">
            <p className="text-2xl font-semibold text-white">{rewardsAvailable ? rewardsResponse.length : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Recompensas activas</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-emerald-300/30">
            <p className="text-2xl font-semibold text-white">{metricsAvailable ? String(overview.total_members ?? 0) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Miembros enrolados</p>
          </div>
        </div>
      </section>

      {rewardsAvailable ? <DataTable
        title="Catálogo de recompensas"
        columns={[{ key: "code", label: "Código" }, { key: "title", label: "Título" }, { key: "points", label: "Costo (Pts)" }, { key: "status", label: "Estado" }]}
        rows={rewardsResponse.map((r: any) => ({ code: r.code, title: r.title, points: String(r.points), status: r.status }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel="No hay recompensas configuradas todavía."
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
      /> : null}
    </main>
  );
}
