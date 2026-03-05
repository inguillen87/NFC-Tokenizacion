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
      <SectionHeading
        eyebrow={copy.nav.overview}
        title={copy.pages.overview.title}
        description={copy.pages.overview.description}
      />

      <AnalyticsPanels kpis={t.dashboard.kpis} />

      <ModuleGrid
        modules={[
          { title: copy.pages.tenants.title, description: copy.pages.tenants.description, href: "/tenants", status: "active" },
          { title: copy.pages.batches.title, description: copy.pages.batches.description, href: "/batches", status: "active" },
          { title: copy.pages.tags.title, description: copy.pages.tags.description, href: "/tags", status: "active" },
          { title: copy.pages.events.title, description: copy.pages.events.description, href: "/events", status: "active" },
          { title: copy.pages.resellers.title, description: copy.pages.resellers.description, href: "/resellers", status: "active" },
          { title: copy.pages.apiKeys.title, description: copy.pages.apiKeys.description, href: "/api-keys", status: "pending" },
        ]}
      />

      <DataTable
        title="Tenant health snapshot"
        columns={[
          { key: "tenant", label: "Tenant" },
          { key: "status", label: "Status" },
          { key: "scans", label: "Scans" },
          { key: "duplicates", label: "Duplicates" },
          { key: "tamper", label: "Tamper" },
        ]}
        rows={overviewRows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
      />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">{t.dashboard.roleBasedOps}</h2>
        <p className="mt-2 text-sm text-slate-400">Forms stay wired to deployed admin API routes for import manifest, activation flow and revoke batch operations.</p>
      </Card>

      <AdminActionForms copy={t.dashboard.forms} />
    </main>
  );
}
