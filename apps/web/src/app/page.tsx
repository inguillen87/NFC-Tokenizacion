import Image from "next/image";
import Link from "next/link";
import { pricingPlans, siteConfig, useCases } from "@product/config";
import {
  Badge,
  Button,
  Card,
  LocaleSwitcher,
  SectionHeading,
  StatCard,
  WorldMapPlaceholder,
} from "@product/ui";
import { getWebI18n } from "../lib/locale";

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();

  return (
    <main>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="container-shell flex h-20 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-mark.svg" alt="logo" width={36} height={36} />
            <div><div className="text-lg font-bold text-white">{siteConfig.productName}</div><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">by {siteConfig.parentBrand}</div></div>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <Link href="/">{t.web.navProduct}</Link>
            <Link href="/pricing">{t.common.pricing}</Link>
            <Link href="/resellers">{t.common.resellers}</Link>
            <Link href="/docs">{t.common.docs}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LocaleSwitcher value={locale} options={[...locales]} />
            <a href="https://dashboard.tudominio.com/login">
              <Button>{t.common.dashboard}</Button>
            </a>
          </div>
        </div>
      </header>

      <section className="container-shell py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <Badge tone="cyan">{t.web.heroBadge}</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">{t.web.heroTitle}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">{t.web.heroBody}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button>{t.web.heroPrimaryCta}</Button>
              <Link href="/pricing">
                <Button variant="secondary">{t.web.heroSecondaryCta}</Button>
              </Link>
              <Link href="/resellers">
                <Button variant="secondary">{t.web.heroResellerCta}</Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <StatCard label={t.web.stats.latency} value="<150ms" delta={t.web.stats.latencyDelta} />
              <StatCard label={t.web.stats.unitEconomics} value="USD 0.02" delta={t.web.stats.economicsDelta} tone="good" />
              <StatCard label={t.web.stats.businessModel} value="HW + SaaS" delta={t.web.stats.businessDelta} />
            </div>
          </div>

          <Card className="hero-glow p-6">
            <SectionHeading
              eyebrow={t.web.sections.architectureEyebrow}
              title={t.web.sections.architectureTitle}
              description={t.web.sections.architectureDescription}
            />
          </Card>
        </div>
      </section>

      <section className="container-shell py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {t.web.rails.map((rail) => (
            <Card key={rail.title} className="p-6">
              <div className="text-base font-semibold text-white">{rail.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">{rail.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow={t.web.sections.useCasesEyebrow}
          title={t.web.sections.useCasesTitle}
          description={t.web.sections.useCasesDescription}
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {useCases.map((item) => (
            <Card key={item.title} className="p-6">
              <div className="text-base font-semibold text-white">{item.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">{item.summary}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow={t.web.sections.pricingEyebrow}
          title={t.web.sections.pricingTitle}
          description={t.web.sections.pricingDescription}
        />
        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card key={plan.slug} className="p-6">
              <Badge tone={plan.slug === "enterprise" ? "amber" : "cyan"}>{plan.badge}</Badge>
              <div className="mt-4 text-2xl font-bold text-white">{plan.name}</div>
              <p className="mt-2 text-sm leading-7 text-slate-400">{plan.description}</p>
              <div className="mt-6 text-lg font-semibold text-cyan-300">{plan.monthlyLabel}</div>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow={t.web.sections.resellerEyebrow}
          title={t.web.sections.resellerTitle}
          description={t.web.sections.resellerDescription}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {t.web.resellerCards.map((item) => (
            <Card key={item.title} className="p-6">
              <div className="text-lg font-bold text-white">{item.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-shell py-16">
        <WorldMapPlaceholder />
      </section>
    </main>
  );
}
