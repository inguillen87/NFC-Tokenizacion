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
      <SectionHeading eyebrow={copy.nav.apiKeys} title={copy.pages.apiKeys.title} description={copy.pages.apiKeys.description} />
      <DataTable title="API keys" columns={[{ key: "keyName", label: "Key" }, { key: "status", label: "Status" }, { key: "scope", label: "Scope" }, { key: "lastUsed", label: "Last used" }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} />
    </main>
  );
}
