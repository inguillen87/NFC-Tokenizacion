import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { keyName: "tenant-bodega-prod", status: "active", scope: "tenant", lastUsed: "2026-03-03" },
  { keyName: "reseller-agency-stg", status: "pending", scope: "reseller", lastUsed: "never" },
  { keyName: "legacy-pharma", status: "revoked", scope: "tenant", lastUsed: "2025-12-14" },
];

export default async function ApiKeysPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.apiKeys} title={copy.pages.apiKeys.title} description={copy.pages.apiKeys.description + " (ⓘ API keys permiten integrar validación, webhooks y automatización externa.)"} />
      <DataTable title={copy.tables.apiKeys.title} columns={[{ key: "keyName", label: copy.tables.apiKeys.keyName }, { key: "status", label: copy.tables.apiKeys.status }, { key: "scope", label: copy.tables.apiKeys.scope }, { key: "lastUsed", label: copy.tables.apiKeys.lastUsed }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
