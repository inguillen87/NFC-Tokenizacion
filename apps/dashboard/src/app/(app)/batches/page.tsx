import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { batch: "WINE-AR-2026-03", type: "secure", status: "active", qty: "10,000" },
  { batch: "COS-BR-2026-01", type: "secure", status: "active", qty: "8,500" },
  { batch: "EVENT-AR-APRIL", type: "basic", status: "pending", qty: "3,000" },
  { batch: "PHARMA-CL-09", type: "secure", status: "revoked", qty: "1,200" },
];

export default async function BatchesPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <DataTable title="Batches" columns={[{ key: "batch", label: "Batch" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }, { key: "qty", label: "Quantity" }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} />
      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} />
    </main>
  );
}
