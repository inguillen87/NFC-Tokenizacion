import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../components/admin-action-forms";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { getDashboardI18n } from "../../lib/locale";

export default async function DashboardHome() {
  const { t } = await getDashboardI18n();

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow={t.dashboard.overview}
        title={t.dashboard.title}
        description={t.dashboard.overviewDescription}
      />

      <AnalyticsPanels kpis={t.dashboard.kpis} />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">{t.dashboard.roleBasedOps}</h2>
        <p className="mt-2 text-sm text-slate-400">Admin contracts remain compatible with the deployed API.</p>
      </Card>

      <AdminActionForms copy={t.dashboard.forms} />
    </main>
  );
}
