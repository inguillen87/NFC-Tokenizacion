import { pricingPlans } from "@product/config";
import { Badge, Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

export default async function PricingPage() {
  const { t } = await getWebI18n();
  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow={t.web.sections.pricing} title="BASIC, SECURE, ENTERPRISE / RESELLER" description="Packaging for campaign scale, anti-fraud deployments and channel-led growth." />
      <div className="mt-10 grid gap-6 xl:grid-cols-3">{pricingPlans.map((plan) => <Card key={plan.slug} className="p-6"><Badge tone={plan.slug === "enterprise" ? "amber" : "cyan"}>{plan.badge}</Badge><h3 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h3><p className="mt-3 text-sm text-slate-400">{plan.description}</p><p className="mt-4 text-cyan-300">{plan.monthlyLabel}</p></Card>)}</div>
    </main>
  );
}
