import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function BatchesPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <DataTable title={copy.table.titles.batches} columns={[{ key: "batch", label: copy.table.columns.batch }, { key: "type", label: copy.table.columns.type }, { key: "status", label: copy.table.columns.status }, { key: "qty", label: copy.table.columns.qty }]} rows={copy.data.batches} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
      <AdminActionForms copy={copy.forms} roles={copy.roles} />
    </main>
  );
}
