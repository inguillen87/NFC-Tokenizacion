import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const rows = [
  { tenant: "Bodega Andes", result: "valid", status: "active", geo: "AR-MDZ", time: "14:21" },
  { tenant: "Bodega Andes", result: "duplicate", status: "risk", geo: "AR-MDZ", time: "14:22" },
  { tenant: "Pharma Delta", result: "tamper", status: "risk", geo: "CL-SCL", time: "14:25" },
  { tenant: "Event Ops AR", result: "valid", status: "active", geo: "AR-CBA", time: "14:29" },
];

export default async function EventsPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.events} title={copy.pages.events.title} description={copy.pages.events.description} />
      <DataTable
        title={copy.tables.events.title}
        columns={[
          { key: "tenant", label: copy.tables.events.tenant },
          { key: "result", label: copy.tables.events.result },
          { key: "status", label: copy.tables.events.status },
          { key: "geo", label: copy.tables.events.geo },
          { key: "time", label: copy.tables.events.time },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
    </main>
  );
}
