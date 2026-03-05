import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { tenant: "Bodega Andes", plan: "secure", status: "active", region: "AR" },
  { tenant: "Cosmetica Norte", plan: "enterprise", status: "active", region: "BR" },
  { tenant: "Pharma Delta", plan: "secure", status: "risk", region: "CL" },
  { tenant: "Event Ops AR", plan: "basic", status: "pending", region: "AR" },
];

export default async function TenantsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tenants} title={copy.pages.tenants.title} description={copy.pages.tenants.description} />
      <DataTable title={copy.tables.tenants.title} columns={[{ key: "tenant", label: copy.tables.tenants.tenant }, { key: "plan", label: copy.tables.tenants.plan }, { key: "status", label: copy.tables.tenants.status }, { key: "region", label: copy.tables.tenants.region }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
