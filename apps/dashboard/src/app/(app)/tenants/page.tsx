import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function TenantsPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tenants} title={copy.pages.tenants.title} description={copy.pages.tenants.description} />
      <DataTable title={copy.table.titles.tenants} columns={[{ key: "name", label: copy.table.columns.name }, { key: "plan", label: copy.table.columns.plan }, { key: "status", label: copy.table.columns.status }, { key: "country", label: copy.table.columns.country }]} rows={copy.data.tenants} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
    </main>
  );
}
