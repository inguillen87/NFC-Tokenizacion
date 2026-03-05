import { Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function TenantsPage() {
  const { t } = await getDashboardI18n();
  return (
    <main>
      <SectionHeading eyebrow={t.dashboard.tenants} title={t.dashboard.tenantsTitle} description={t.dashboard.tenantsDescription} />
      <Card className="mt-8 p-6"><p className="text-sm text-slate-300">Tenant directory, plan assignment and governance policy insights.</p></Card>
    </main>
  );
}
