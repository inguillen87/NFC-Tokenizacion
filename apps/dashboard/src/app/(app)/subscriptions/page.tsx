import { Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function SubscriptionsPage() {
  const { t } = await getDashboardI18n();
  return (
    <main>
      <SectionHeading eyebrow={t.dashboard.subscriptions} title={t.dashboard.subscriptionsTitle} description={t.dashboard.subscriptionsDescription} />
      <Card className="mt-8 p-6"><p className="text-sm text-slate-300">MRR trends, plan migration and contract risk visibility.</p></Card>
    </main>
  );
}
