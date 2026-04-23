import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export default async function CampaignsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.campaigns} title={copy.pages.campaigns.title} description={copy.pages.campaigns.description} />
      <section className="rounded-2xl border border-indigo-300/20 bg-[radial-gradient(circle_at_top,rgba(99,102,241,.15),transparent_40%),#020617] p-5 shadow-[0_24px_70px_rgba(2,6,23,.7)] md:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-indigo-200">Growth Strategist</p>
        <p className="mt-2 text-sm text-slate-100">Campañas activadas por IA o triggers basados en escanos NFC reales.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-indigo-300/30">
            <p className="text-2xl font-semibold text-white">0</p>
            <p className="mt-1 text-xs text-slate-400">Campañas activas</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-indigo-300/30">
            <p className="text-2xl font-semibold text-white">0</p>
            <p className="mt-1 text-xs text-slate-400">Audiencia conectada</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-indigo-300/30">
            <p className="text-2xl font-semibold text-white">0%</p>
            <p className="mt-1 text-xs text-slate-400">Conversión tap-to-action</p>
          </div>
        </div>
      </section>

      <DataTable
        title="Historial de Campañas"
        columns={[{ key: "name", label: "Campaña" }, { key: "trigger", label: "Trigger" }, { key: "performance", label: "Rendimiento" }, { key: "status", label: "Estado" }]}
        rows={[]}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel="No hay campañas activas todavía."
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
      />
    </main>
  );
}
