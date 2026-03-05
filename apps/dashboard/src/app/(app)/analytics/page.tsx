import { SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { getDashboardI18n } from "../../../lib/locale";

export default async function AnalyticsPage() {
  const { t } = await getDashboardI18n();

  return (
    <main>
      <SectionHeading
        eyebrow={t.dashboard.analytics}
        title={t.dashboard.analyticsTitle}
        description={t.dashboard.analyticsDescription}
      />
      <div className="mt-8">
        <AnalyticsPanels kpis={t.dashboard.kpis} />
      </div>
    </main>
  );
}
