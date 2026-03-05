import { SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { getDashboardI18n } from "../../../lib/locale";

export default async function AnalyticsPage() {
  const { t } = await getDashboardI18n();
  return <main><SectionHeading eyebrow={t.dashboard.analytics} title="Scan intelligence" description="Valid/invalid, duplicate and tamper trends with geo footprint." /><div className="mt-8"><AnalyticsPanels title="Security telemetry" /></div></main>;
}
