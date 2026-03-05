import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { tenant: "Bodega Andes", plan: "secure", status: "active", renewal: "2026-08-01" },
  { tenant: "Cosmetica Norte", plan: "enterprise", status: "active", renewal: "2026-05-15" },
  { tenant: "Event Ops AR", plan: "basic", status: "pending", renewal: "2026-04-10" },
];

export default async function SubscriptionsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.subscriptions} title={copy.pages.subscriptions.title} description={copy.pages.subscriptions.description} />
      <DataTable title={copy.tables.subscriptions.title} columns={[{ key: "tenant", label: copy.tables.subscriptions.tenant }, { key: "plan", label: copy.tables.subscriptions.plan }, { key: "status", label: copy.tables.subscriptions.status }, { key: "renewal", label: copy.tables.subscriptions.renewal }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
    </main>
  );
}
