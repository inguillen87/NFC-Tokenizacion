import { Badge, BrandDot, Button, Card, SectionHeading, StatCard, WorldMapPlaceholder } from "@product/ui";
import Link from "next/link";

import type { AppLocale } from "@product/config";
import type { LandingContent } from "../lib/landing-content";

type Content = LandingContent;
type StatsCopy = {
  latency: string;
  unitEconomics: string;
  businessModel: string;
  latencyDelta: string;
  economicsDelta: string;
  businessDelta: string;
};

const proofByLocale: Record<AppLocale, string[]> = {
  "es-AR": ["SaaS trazable", "SaaS tokenizable", "SaaS para vender con chips NFC"],
  "pt-BR": ["SaaS rastreável", "SaaS tokenizável", "SaaS para vender com chips NFC"],
  en: ["Traceable SaaS", "Tokenizable SaaS", "SaaS that sells with NFC chips"],
};

export function HeroSection({ content, stats, locale }: { content: Content; stats: StatsCopy; locale: AppLocale }) {
  const proofItems = [...new Set(proofByLocale[locale] || proofByLocale["es-AR"])]
  const pipelineTitle = locale === "en" ? "What happens after each tap" : locale === "pt-BR" ? "O que acontece após cada tap" : "Qué pasa después de cada tap";
  const pipelineBody = locale === "en" ? "We verify, show value, and suggest the next sale action." : locale === "pt-BR" ? "Validamos, mostramos valor e sugerimos a próxima ação comercial." : "Validamos, mostramos valor y sugerimos la próxima acción comercial.";
  return (
    <section className="container-shell py-16 md:py-24">
      <div className="hero-shell grid gap-10 rounded-[2rem] p-6 md:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {content.hero.badge}
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <BrandDot size={10} variant="ripple" theme="dark" />
            <span>{locale === "en" ? "Live product OS" : locale === "pt-BR" ? "Sistema vivo de produto" : "Sistema vivo de producto"}</span>
          </div>

          <h1 className="mt-6 text-balance text-5xl font-black tracking-tight text-white md:text-7xl">{content.hero.title}</h1>
          <p className="hero-subtitle mt-6 max-w-2xl text-lg leading-8 text-slate-300">{content.hero.body}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href="https://wa.me/5492613168608?text=Hola%20quiero%20una%20demo%20enterprise%20de%20nexID" target="_blank" rel="noreferrer"><Button>{content.hero.primary}</Button></a>
            <a href="#demo"><Button variant="secondary">{content.hero.secondary}</Button></a>
            <Link href="/resellers"><Button variant="secondary">{content.hero.tertiary}</Button></Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {proofItems.map((item) => (
              <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {item}
              </span>
            ))}
          </div>
        </div>

        <Card className="hero-panel hero-glow p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label={stats.latency} value="<150ms" delta={stats.latencyDelta} tone="good" />
            <StatCard label={stats.unitEconomics} value="2.4M" delta={locale === "en" ? "Active tags" : locale === "pt-BR" ? "Tags ativos" : "Tags activos"} />
            <StatCard label={stats.businessModel} value="5 countries / 9 provinces" delta={locale === "en" ? "Fraud alerts: 12/day" : locale === "pt-BR" ? "Alertas fraude: 12/dia" : "Alertas fraude: 12/día"} tone="good" />
            <div className="hero-spark rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">{pipelineTitle}</p>
              <div className="mt-3 space-y-2">
                <div className="hero-meter"><span style={{ width: "82%" }} /></div>
                <div className="hero-meter"><span style={{ width: "68%" }} /></div>
                <div className="hero-meter"><span style={{ width: "91%" }} /></div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{pipelineBody}</p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function TrustBarSection({ content }: { content: Content }) {
  return (
    <section className="container-shell pb-10">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5">
        {content.trustBar.map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-center text-xs uppercase tracking-[0.14em] text-cyan-200">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorksSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.howItWorks.eyebrow} title={content.howItWorks.title} description={content.howItWorks.description} />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {content.howItWorks.steps.map((step) => (
          <Card key={step.title} className="p-5">
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="mt-2 text-sm leading-7 text-slate-400">{step.body}</p>
          </Card>
        ))}
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
            <Badge tone={plan.name.includes("ENTERPRISE") ? "amber" : "cyan"}>{plan.badge}</Badge>
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

export function AuthenticityStatesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.authenticity.eyebrow} title={content.authenticity.title} description={content.authenticity.description} />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {content.authenticity.cards.map((item) => (
          <Card key={item.state} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.state}</p>
            <p className={`mt-3 text-lg font-semibold ${item.tone === "good" ? "text-emerald-300" : item.tone === "warn" ? "text-amber-300" : "text-rose-300"}`}>
              {item.tone === "good" ? content.authenticity.badges.good : item.tone === "warn" ? content.authenticity.badges.warn : content.authenticity.badges.risk}
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-400">{item.detail}</p>
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
