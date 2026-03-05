import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { getDashboardI18n } from "../../../lib/locale";

export default async function ApiKeysPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.apiKeys} title={copy.pages.apiKeys.title} description={copy.pages.apiKeys.description} />
      <DataTable title={copy.table.titles.apiKeys} columns={[{ key: "keyName", label: copy.table.columns.keyName }, { key: "status", label: copy.table.columns.status }, { key: "scope", label: copy.table.columns.scope }, { key: "lastUsed", label: copy.table.columns.lastUsed }]} rows={copy.data.apiKeys} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} labels={copy.table} />
    </main>
  );
}
