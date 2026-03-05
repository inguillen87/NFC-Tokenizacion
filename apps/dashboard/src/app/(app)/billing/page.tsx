import { pricingPlans } from "@product/config";
import { Badge, Card, SectionHeading } from "@product/ui";

export default function BillingPage() {
  return (
    <main>
      <SectionHeading eyebrow="Plans" title="BASIC, SECURE and ENTERPRISE / RESELLER" description="Commercial packaging for direct customers and channel partners." />
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        {pricingPlans.map((plan) => (
          <Card key={plan.slug} className="p-6">
            <Badge tone={plan.slug === "enterprise" ? "amber" : "cyan"}>{plan.badge}</Badge>
            <h3 className="mt-3 text-xl font-bold text-white">{plan.name.toUpperCase()}</h3>
            <p className="mt-2 text-sm text-slate-400">{plan.description}</p>
            <p className="mt-4 text-sm text-cyan-300">{plan.monthlyLabel}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
