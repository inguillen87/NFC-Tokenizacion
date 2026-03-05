import { SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { getDashboardI18n } from "../../../lib/locale";

export default async function AnalyticsPage() {
  const { copy } = await getDashboardI18n();
  return (
    <main>
      <SectionHeading eyebrow={copy.nav.analytics} title={copy.pages.analytics.title} description={copy.pages.analytics.description} />
      <div className="mt-8"><AnalyticsPanels kpis={copy.kpis} trend={copy.data.trend} batchStatus={copy.data.batchStatusChart} /></div>
    </main>
  );
}
