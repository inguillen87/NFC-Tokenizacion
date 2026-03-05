import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { name: "Bodega Andes", plan: "secure", status: "active", country: "AR" },
  { name: "Cosmetica Norte", plan: "enterprise", status: "active", country: "BR" },
  { name: "Pharma Delta", plan: "secure", status: "risk", country: "CL" },
  { name: "Event Ops AR", plan: "basic", status: "pending", country: "AR" },
];

export default async function TenantsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tenants} title={copy.pages.tenants.title} description={copy.pages.tenants.description} />
      <DataTable title="Tenants" columns={[{ key: "name", label: "Name" }, { key: "plan", label: "Plan" }, { key: "status", label: "Status" }, { key: "country", label: "Country" }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} />
    </main>
  );
}
