import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function TagsPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tags} title={copy.pages.tags.title} description={copy.pages.tags.description} />
      <DataTable title={copy.table.titles.tags} columns={[{ key: "profile", label: copy.table.columns.profile }, { key: "status", label: copy.table.columns.status }, { key: "inventory", label: copy.table.columns.inventory }, { key: "activation", label: copy.table.columns.activation }]} rows={copy.data.tags} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
    </main>
  );
}
