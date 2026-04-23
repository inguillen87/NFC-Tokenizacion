import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function adminGet(path: string) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });

    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

import { requireDashboardSession } from "../../../lib/session";

export default async function LoyaltyPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const tenantFilter = String(query.tenant || "").trim().toLowerCase();

  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const session = await requireDashboardSession();
  const isSuperadmin = session.role === "super-admin";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : tenantFilter;

  const [portfolio, rewardsResponse, overview] = await Promise.all([
    isSuperadmin ? adminGet("/superadmin/loyalty/portfolio").then((r) => r.portfolio || []) : [],
    adminGet(`/admin/loyalty/rewards?tenant=${tenantScope}`).then((r) => r.rewards || []),
    adminGet(`/admin/loyalty/overview?tenant=${tenantScope}`),
  ]);

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.loyalty} title={copy.pages.loyalty.title} description={copy.pages.loyalty.description} />

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
        <p className="text-xs uppercase tracking-[0.16em] text-emerald-200">Loyalty Engine Activo {tenantScope ? `(${tenantScope})` : "(Global)"}</p>
        <p className="mt-2 text-sm text-slate-100">Configurá recompensas, puntos y niveles VIP vinculados a escaneos válidos.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-emerald-300/30">
            <p className="text-2xl font-semibold text-white">{overview.points_issued || 0}</p>
            <p className="mt-1 text-xs text-slate-400">Puntos emitidos</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-emerald-300/30">
            <p className="text-2xl font-semibold text-white">{rewardsResponse.length}</p>
            <p className="mt-1 text-xs text-slate-400">Recompensas activas</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-emerald-300/30">
            <p className="text-2xl font-semibold text-white">{overview.total_members || 0}</p>
            <p className="mt-1 text-xs text-slate-400">Miembros enrolados</p>
          </div>
        </div>
      </section>

      <DataTable
        title="Catálogo de recompensas"
        columns={[{ key: "code", label: "Código" }, { key: "title", label: "Título" }, { key: "points", label: "Costo (Pts)" }, { key: "status", label: "Estado" }]}
        rows={rewardsResponse.map((r: any) => ({ code: r.code, title: r.title, points: String(r.points), status: r.status }))}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel="No hay recompensas configuradas todavía."
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
      />
    </main>
  );
}
