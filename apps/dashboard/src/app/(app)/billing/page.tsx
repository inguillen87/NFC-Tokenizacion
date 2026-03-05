import { pricingPlans } from "@product/config";
import { Badge, Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function BillingPage() {
  const { copy } = await getDashboardI18n();

  return (
    <main>
      <SectionHeading eyebrow={copy.nav.subscriptions} title={copy.pages.subscriptions.title} description={copy.pages.subscriptions.description} />
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        {pricingPlans.map((p) => (
          <Card key={p.slug} className="p-6">
            <Badge tone={p.slug === "enterprise" ? "amber" : "cyan"}>{p.badge}</Badge>
            <h3 className="mt-3 text-xl text-white">{p.name}</h3>
            <p className="mt-2 text-sm text-slate-400">{p.monthlyLabel}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
