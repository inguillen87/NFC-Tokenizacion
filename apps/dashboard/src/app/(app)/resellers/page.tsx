import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { reseller: "Agency South", status: "active", clients: "14", revenue: "USD 18,200" },
  { reseller: "Pack Converter One", status: "active", clients: "8", revenue: "USD 12,900" },
  { reseller: "Regional Dist LATAM", status: "pending", clients: "5", revenue: "USD 9,100" },
];

export default async function ResellersPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.resellers} title={copy.pages.resellers.title} description={copy.pages.resellers.description} />
      <DataTable title="Reseller performance" columns={[{ key: "reseller", label: "Reseller" }, { key: "status", label: "Status" }, { key: "clients", label: "Clients" }, { key: "revenue", label: "Revenue" }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} />
    </main>
  );
}
