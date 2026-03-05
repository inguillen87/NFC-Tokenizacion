import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { DataTable } from "../../components/data-table";
import { getDashboardI18n } from "../../lib/locale";

export default async function DashboardHome() {
  const { copy } = await getDashboardI18n();

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.overview} title={copy.pages.overview.title} description={copy.pages.overview.description} />

      <AnalyticsPanels kpis={copy.kpis} trend={copy.data.trend} batchStatus={copy.data.batchStatusChart} />

      <DataTable
        title={copy.table.titles.overview}
        columns={[{ key: "tenant", label: copy.table.columns.tenant }, { key: "status", label: copy.table.columns.status }, { key: "scans", label: copy.table.columns.scans }, { key: "duplicates", label: copy.table.columns.duplicates }, { key: "tamper", label: copy.table.columns.tamper }]}
        rows={copy.data.overview}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        labels={copy.table}
      />

      <AdminActionForms copy={copy.forms} roles={copy.roles} />
    </main>
  );
}
