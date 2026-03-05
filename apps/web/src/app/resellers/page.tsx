import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

export default async function ResellersPage() {
  const { t } = await getWebI18n();
  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow={t.web.sections.reseller} title="White-label channel program" description="Agency, converter and distributor enablement with enterprise controls and SLA-ready operations." />
      <div className="mt-10 grid gap-6 md:grid-cols-2"><Card className="p-6"><h3 className="text-white">Co-branded SaaS</h3><p className="mt-2 text-sm text-slate-400">Operate shared dashboards and analytics with controlled tenant boundaries.</p></Card><Card className="p-6"><h3 className="text-white">Private-label operations</h3><p className="mt-2 text-sm text-slate-400">Reseller-owned client lifecycle with your brand and our secure infrastructure.</p></Card></div>
    </main>
  );
}
