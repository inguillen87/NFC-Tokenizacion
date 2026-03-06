import { BackLink } from "../../components/back-link";
import { Badge, Button, Card, SectionHeading } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";
import { CalculatorSection } from "../../components/calculator-section";

export default async function PricingPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main className="container-shell py-16"><BackLink />
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan) => (
          <Card key={plan.name} className="p-6">
            <Badge tone={plan.name.includes("ENTERPRISE") ? "amber" : "cyan"}>{plan.badge}</Badge>
            <h3 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-3 text-sm text-slate-400">{plan.body}</p>
            <p className="mt-4 text-cyan-300">{plan.price}</p>
            <ul className="mt-4 space-y-1 text-sm text-slate-300">{plan.bullets.map((b) => <li key={b}>• {b}</li>)}</ul>
          </Card>
        ))}
      </div>

      <CalculatorSection calculator={content.calculator} />

      <Card className="mt-8 p-6">
        <SectionHeading eyebrow={content.roi.eyebrow} title={content.roi.title} description={content.roi.description} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {content.roi.metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{m.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{m.value}</p>
              <p className="mt-1 text-sm text-slate-400">{m.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-6"><Button>{content.cta.primary}</Button></div>
      </Card>
    </main>
  );
}
