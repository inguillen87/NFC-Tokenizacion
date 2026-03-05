import Link from "next/link";
import { pricingPlans } from "@product/config";
import { Badge, Button, Card, SectionHeading } from "@product/ui";

export default function PricingPage() {
  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow="Pricing" title="BASIC, SECURE and ENTERPRISE / RESELLER" description="Enterprise-ready packages for events, anti-fraud and channel-led deployments." />
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {pricingPlans.map((plan) => (
          <Card key={plan.slug} className="p-6">
            <Badge tone={plan.slug === "enterprise" ? "amber" : "cyan"}>{plan.badge}</Badge>
            <h3 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-3 text-sm text-slate-400">{plan.description}</p>
            <p className="mt-4 text-cyan-300">{plan.monthlyLabel}</p>
          </Card>
        ))}
      </div>
      <div className="mt-10">
        <Link href="/"><Button variant="secondary">Back to landing</Button></Link>
      </div>
    </main>
  );
}
