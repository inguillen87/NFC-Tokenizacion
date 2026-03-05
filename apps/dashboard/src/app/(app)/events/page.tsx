import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function EventsPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
      <DataTable title={copy.table.titles.events} columns={[{ key: "tenant", label: copy.table.columns.tenant }, { key: "result", label: copy.table.columns.result }, { key: "status", label: copy.table.columns.status }, { key: "geo", label: copy.table.columns.geo }, { key: "time", label: copy.table.columns.time }]} rows={copy.data.events} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
    </main>
  );
}
