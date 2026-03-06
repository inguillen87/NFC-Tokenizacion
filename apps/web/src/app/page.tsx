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

      <HeroSection content={content} stats={t.web.stats} />
      <TrustBarSection content={content} />
      <RadarSection radar={content.radar} locale={locale} />
      <InteractiveDemoSection locale={locale} />
      <PlansSection content={content} />
      <CalculatorSection calculator={content.calculator} locale={locale} />
      <CtaSection content={content} />

      <footer className="site-footer border-t">
        <div className="container-shell grid gap-4 py-10 md:grid-cols-[auto_1fr_auto] md:items-center">
          <BrandLockup size={32} variant="pulse" theme="dark" />
          <p className="text-sm site-muted">Inmovar Identity Rail combina tags codificados, API de autenticación, antifraude, trazabilidad y capa premium de identidad digital para vino, cosmética, pharma, eventos y redes reseller.</p>
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
