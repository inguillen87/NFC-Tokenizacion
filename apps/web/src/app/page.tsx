import Link from "next/link";
import { siteConfig } from "@product/config";
import { BrandLockup, Button, LocaleSwitcher, ThemeToggle } from "@product/ui";
import {
  CtaSection,
  HeroSection,
  PlansSection,
  TrustBarSection,
} from "../components/landing-sections";
import { CalculatorSection } from "../components/calculator-section";
import { RadarSection } from "../components/radar-section";
import { InteractiveDemoSection } from "../components/interactive-demo-section";
import { SalesChatWidget } from "../components/sales-chat-widget";
import { LiveDemoSurfaces } from "../components/live-demo-surfaces";
import { VerticalDemoLibrary } from "../components/vertical-demo-library";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main>
      <header className="site-header sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="container-shell flex h-20 items-center justify-between gap-4">
          <BrandLockup size={36} variant="ripple" theme="dark" />

          <nav className="hidden gap-6 text-sm md:flex site-nav">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/docs">{content.nav.docs}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LocaleSwitcher value={locale} options={[...locales]} />
            <ThemeToggle />
            <a href="https://app.nexid.lat/login">
              <Button>{content.nav.cta}</Button>
            </a>
          </div>
        </div>
      </header>

      <HeroSection content={content} stats={t.web.stats} locale={locale} />

      <section className="container-shell py-8">
        <div className="grid gap-3 md:grid-cols-3">
          <a className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-white" href="/demo/demobodega_seed.json" download>Download demo JSON</a>
          <a className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-white" href="/demo/demobodega_manifest.csv" download>Download demo CSV</a>
          <a className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-white" href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3002"}/demo-lab`}>Launch Demo Lab</a>
        </div>
      </section>
      <TrustBarSection content={content} />
      <RadarSection radar={content.radar} locale={locale} />
      <InteractiveDemoSection locale={locale} />
      <VerticalDemoLibrary locale={locale} />
      <LiveDemoSurfaces />
      <PlansSection content={content} />
      <CalculatorSection calculator={content.calculator} locale={locale} />
      <CtaSection content={content} />

      <SalesChatWidget locale={locale} />

      <footer className="site-footer border-t">
        <div className="container-shell grid gap-4 py-10 md:grid-cols-[auto_1fr_auto] md:items-center">
          <BrandLockup size={32} variant="pulse" theme="dark" />
          <p className="text-sm site-muted">nexID Product Identity Cloud combina tags codificados, API de autenticación, antifraude, trazabilidad y capa premium de identidad digital para vino, cosmética, pharma, eventos y redes reseller.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Arquitectura</Link>
            <Link href="/pricing" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Pricing</Link>
            <a href="https://wa.me/5492613168608" target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">Demo</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
