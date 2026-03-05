import { Card, SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../components/analytics-panels";
import { AdminActionForms } from "../../components/admin-action-forms";

export default function DashboardHome() {
  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Control tower"
        title="Enterprise NFC authentication operations"
        description="Multi-tenant SaaS UX for onboarding, secure batch lifecycle and anti-fraud observability."
      />
      <AnalyticsPanels />
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Operational forms</h2>
        <p className="mt-2 text-sm text-slate-400">All write actions target existing admin API contracts without changing SUN backend behavior.</p>
      </Card>
      <AdminActionForms />
    </main>
  );
}
