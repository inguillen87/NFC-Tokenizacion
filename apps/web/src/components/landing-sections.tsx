import { Badge, Button, Card, SectionHeading, StatCard, WorldMapPlaceholder } from "@product/ui";
import Link from "next/link";
import type { LandingContent } from "../lib/landing-content";

type Content = LandingContent;

export function HeroSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-20 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <Badge tone="cyan">{content.hero.badge}</Badge>
          <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">{content.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">{content.hero.body}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button>{content.hero.primary}</Button>
            <a href="#platform"><Button variant="secondary">{content.hero.secondary}</Button></a>
            <Link href="/pricing"><Button variant="secondary">{content.hero.tertiary}</Button></Link>
          </div>
        </div>

        <Card className="hero-glow animate-card-shift p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {content.hero.stats.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} delta={item.delta} tone={item.tone} />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

export function CardsSection({ content }: { content: Content }) {
  return (
    <section id="platform" className="container-shell py-16">
      <SectionHeading eyebrow={content.what.eyebrow} title={content.what.title} description={content.what.description} />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {content.what.cards.map((card) => (
          <Card key={card.title} className="animate-card-shift p-6">
            <div className="text-base font-semibold text-white">{card.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{card.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function PlansSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />
      <div className="mt-10 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan) => (
          <Card key={plan.name} className="animate-card-shift p-6">
            <Badge tone={plan.tone}>{plan.badge}</Badge>
            <div className="mt-4 text-2xl font-bold text-white">{plan.name}</div>
            <p className="mt-2 text-sm text-cyan-300">{plan.price}</p>
            <p className="mt-3 text-sm leading-7 text-slate-400">{plan.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {plan.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function BulletSection({ eyebrow, title, description, bullets }: { eyebrow: string; title: string; description: string; bullets: string[] }) {
  return (
    <section className="container-shell py-16">
      <Card className="p-8">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{bullet}</div>
          ))}
        </div>
      </Card>
    </section>
  );
}

export function UseCasesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.useCases.eyebrow} title={content.useCases.title} description={content.useCases.description} />
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {content.useCases.cards.map((item) => (
          <Card key={item.title} className="animate-card-shift p-6">
            <div className="text-base font-semibold text-white">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ResellerSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.reseller.eyebrow} title={content.reseller.title} description={content.reseller.description} />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {content.reseller.cards.map((item) => (
          <Card key={item.title} className="animate-card-shift p-6">
            <div className="text-lg font-bold text-white">{item.title}</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function RoiCredibilitySection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeading eyebrow={content.roi.eyebrow} title={content.roi.title} description={content.roi.description} />
          <div className="mt-6 space-y-4">
            {content.roi.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{metric.value}</p>
                <p className="mt-1 text-sm text-slate-400">{metric.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeading eyebrow={content.credibility.eyebrow} title={content.credibility.title} description={content.credibility.description} />
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            {content.credibility.items.map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <div className="mt-6"><WorldMapPlaceholder /></div>
        </Card>
      </div>
    </section>
  );
}

export function CtaSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-20">
      <Card className="hero-glow p-8 text-center">
        <h2 className="text-3xl font-bold text-white">{content.cta.title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">{content.cta.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button>{content.cta.primary}</Button>
          <Button variant="secondary">{content.cta.secondary}</Button>
        </div>
      </Card>
    </section>
  );
}
