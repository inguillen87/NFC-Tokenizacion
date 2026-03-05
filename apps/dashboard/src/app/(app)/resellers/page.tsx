import { Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function ResellersPage() {
  const { t } = await getDashboardI18n();

  return (
    <main>
      <SectionHeading
        eyebrow={t.common.resellers}
        title={t.dashboard.resellersTitle}
        description={t.dashboard.resellersDescription}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6"><h3 className="text-white">Agency channel</h3><p className="mt-2 text-sm text-slate-400">Campaign-focused premium onboarding.</p></Card>
        <Card className="p-6"><h3 className="text-white">Packaging converter</h3><p className="mt-2 text-sm text-slate-400">Secure-tag manufacturing integration.</p></Card>
        <Card className="p-6"><h3 className="text-white">Regional distributor</h3><p className="mt-2 text-sm text-slate-400">Enterprise anti-fraud rollouts by geography.</p></Card>
      </div>
    </main>
  );
}
