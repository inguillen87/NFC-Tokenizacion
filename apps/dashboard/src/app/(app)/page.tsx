import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { DataTable } from "../../components/data-table";
import { ModuleGrid } from "../../components/module-grid";
import { dashboardContent } from "../../lib/dashboard-content";
import { getDashboardI18n } from "../../lib/locale";

const overviewRows = [
  { tenant: "Bodega Andes", status: "healthy", scans: "8,402", duplicates: "26", tamper: "3" },
  { tenant: "Cosmetica Norte", status: "active", scans: "5,910", duplicates: "18", tamper: "1" },
  { tenant: "Pharma Delta", status: "risk", scans: "3,221", duplicates: "42", tamper: "7" },
  { tenant: "Event Ops AR", status: "pending", scans: "1,040", duplicates: "2", tamper: "0" },
];

export default async function DashboardHome() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.overview} title={copy.pages.overview.title} description={copy.pages.overview.description} />

      <AnalyticsPanels kpis={t.dashboard.kpis} extra={copy.analytics} />

      <ModuleGrid
        actionLabel={copy.shell.openModule}
        modules={[
          { title: copy.pages.tenants.title, description: copy.pages.tenants.description, href: "/tenants", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.batches.title, description: copy.pages.batches.description, href: "/batches", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.tags.title, description: copy.pages.tags.description, href: "/tags", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.events.title, description: copy.pages.events.description, href: "/events", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.resellers.title, description: copy.pages.resellers.description, href: "/resellers", status: copy.statuses.active, tone: "green" },
          { title: copy.pages.apiKeys.title, description: copy.pages.apiKeys.description, href: "/api-keys", status: copy.statuses.pending, tone: "amber" },
        ]}
      />

      <DataTable
        title={copy.tables.tenants.title}
        columns={[
          { key: "tenant", label: copy.tables.tenants.tenant },
          { key: "status", label: copy.tables.tenants.status },
          { key: "scans", label: t.dashboard.kpis.scans },
          { key: "duplicates", label: t.dashboard.kpis.duplicates },
          { key: "tamper", label: t.dashboard.kpis.tamper },
        ]}
        rows={overviewRows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">{t.dashboard.roleBasedOps}</h2>
        <p className="mt-2 text-sm text-slate-400">{copy.pages.batches.description}</p>
      </Card>

      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} />
    </main>
  );
}
