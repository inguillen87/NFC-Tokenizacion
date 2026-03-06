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
      <RadarSection radar={content.radar} />
      <InteractiveDemoSection locale={locale} />
      <PlansSection content={content} />
      <CalculatorSection calculator={content.calculator} />
      <CtaSection content={content} />

      <footer className="site-footer border-t">
        <div className="container-shell flex flex-wrap items-center justify-between gap-4 py-8">
          <BrandLockup size={30} variant="pulse" theme="dark" />
          <p className="text-xs uppercase tracking-[0.18em] site-muted">{siteConfig.productName} · Identity Product Platform</p>
          <p className="text-[11px] site-muted">Powered by Inmovar Latam SAS</p>
        </div>
      </footer>
    </main>
  );
}
