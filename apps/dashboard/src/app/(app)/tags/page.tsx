import { Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function TagsPage() {
  const { t } = await getDashboardI18n();
  return (
    <main>
      <SectionHeading eyebrow={t.dashboard.tags} title={t.dashboard.tagsTitle} description={t.dashboard.tagsDescription} />
      <Card className="mt-8 p-6"><p className="text-sm text-slate-300">Activation queue, secure profile mix and throughput monitoring.</p></Card>
    </main>
  );
}
