import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function SubscriptionsPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.subscriptions} title={copy.pages.subscriptions.title} description={copy.pages.subscriptions.description} />
      <DataTable title={copy.table.titles.subscriptions} columns={[{ key: "tenant", label: copy.table.columns.tenant }, { key: "plan", label: copy.table.columns.plan }, { key: "status", label: copy.table.columns.status }, { key: "renewal", label: copy.table.columns.renewal }]} rows={copy.data.subscriptions} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
    </main>
  );
}
