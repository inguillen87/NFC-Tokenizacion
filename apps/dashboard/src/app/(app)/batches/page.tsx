import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { batch: "WINE-AR-2026-03", type: "secure", status: "active", quantity: "10,000" },
  { batch: "COS-BR-2026-01", type: "secure", status: "active", quantity: "8,500" },
  { batch: "EVENT-AR-APRIL", type: "basic", status: "pending", quantity: "3,000" },
  { batch: "PHARMA-CL-09", type: "secure", status: "revoked", quantity: "1,200" },
];

export default async function BatchesPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <DataTable title={copy.tables.batches.title} columns={[{ key: "batch", label: copy.tables.batches.batch }, { key: "type", label: copy.tables.batches.type }, { key: "status", label: copy.tables.batches.status }, { key: "quantity", label: copy.tables.batches.quantity }]} rows={rows} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh} statusMap={copy.statuses} />
      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} />
    </main>
  );
}
