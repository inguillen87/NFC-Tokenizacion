import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { getDashboardI18n } from "../../lib/locale";

export default async function DashboardHome() {
  const { t } = await getDashboardI18n();
  return <main className="space-y-8"><SectionHeading eyebrow={t.dashboard.overview} title={t.dashboard.title} description="Enterprise KPI and anti-fraud telemetry for secure NFC operations." /><AnalyticsPanels title="Scan, duplicate and tamper trend" /><Card className="p-6"><h2 className="text-lg font-semibold text-white">Admin actions</h2><p className="mt-2 text-sm text-slate-400">Wired to current API contracts.</p></Card><AdminActionForms title="Role-based operations" /></main>;
}
