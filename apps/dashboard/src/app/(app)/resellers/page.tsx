import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function ResellersPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.resellers} title={copy.pages.resellers.title} description={copy.pages.resellers.description} />
      <DataTable title={copy.table.titles.resellers} columns={[{ key: "reseller", label: copy.table.columns.reseller }, { key: "status", label: copy.table.columns.status }, { key: "clients", label: copy.table.columns.clients }, { key: "revenue", label: copy.table.columns.revenue }]} rows={copy.data.resellers} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
    </main>
  );
}
