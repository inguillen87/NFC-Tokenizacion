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
      <DataTable title={copy.tables.tags.title} columns={[{ key: "profile", label: copy.tables.tags.profile }, { key: "status", label: copy.tables.tags.status }, { key: "inventory", label: copy.tables.tags.inventory }, { key: "activation", label: copy.tables.tags.activation }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
