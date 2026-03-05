import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { profile: "NTAG215", status: "active", inventory: "54,200", activation: "92%" },
  { profile: "NTAG 424 DNA TT", status: "active", inventory: "21,400", activation: "87%" },
  { profile: "TagTamper Seal", status: "pending", inventory: "8,000", activation: "0%" },
];

export default async function TagsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.tags} title={copy.pages.tags.title} description={copy.pages.tags.description} />
      <DataTable title="Tag profiles" columns={[{ key: "profile", label: "Profile" }, { key: "status", label: "Status" }, { key: "inventory", label: "Inventory" }, { key: "activation", label: "Activation" }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} />
    </main>
  );
}
