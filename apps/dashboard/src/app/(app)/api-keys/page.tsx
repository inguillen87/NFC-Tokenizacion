import { Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function ApiKeysPage() {
  const { t } = await getDashboardI18n();
  return (
    <main>
      <SectionHeading eyebrow={t.dashboard.apiKeys} title={t.dashboard.apiKeysTitle} description={t.dashboard.apiKeysDescription} />
      <Card className="mt-8 p-6"><p className="text-sm text-slate-300">Key inventory, rotation status and role-based issuance controls.</p></Card>
    </main>
  );
}
