import { Badge, Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";

export default async function PricingPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan) => (
          <Card key={plan.name} className="p-6">
            <Badge tone={plan.name.includes("ENTERPRISE") ? "amber" : "cyan"}>{plan.badge}</Badge>
            <h3 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-3 text-sm text-slate-400">{plan.body}</p>
            <p className="mt-4 text-cyan-300">{plan.price}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
