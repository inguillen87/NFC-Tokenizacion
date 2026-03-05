import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@product/config";
import { Button, LocaleSwitcher } from "@product/ui";
import {
  AuthenticityStatesSection,
  BulletSection,
  CardsSection,
  CtaSection,
  HeroSection,
  HowItWorksSection,
  PlansSection,
  ResellerSection,
  RoiCredibilitySection,
  TrustBarSection,
  UseCasesSection,
} from "../components/landing-sections";
import { CalculatorSection } from "../components/calculator-section";
import { RadarSection } from "../components/radar-section";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="container-shell flex h-20 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-mark.svg" alt={siteConfig.productName} width={36} height={36} />
            <div><div className="text-lg font-bold text-white">{siteConfig.productName}</div><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">by {siteConfig.parentBrand}</div></div>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/docs">{content.nav.docs}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LocaleSwitcher value={locale} options={[...locales]} />
            <a href="https://dashboard.tudominio.com/login">
              <Button>{content.nav.cta}</Button>
            </a>
          </div>
        </div>
      </header>

      <HeroSection content={content} stats={t.web.stats} />
      <TrustBarSection content={content} />
      <HowItWorksSection content={content} />
      <CardsSection content={content} />
      <PlansSection content={content} />
      <AuthenticityStatesSection content={content} />
      <BulletSection {...content.secure} />
      <UseCasesSection content={content} />
      <RadarSection radar={content.radar} />
      <BulletSection {...content.intelligence} />
      <ResellerSection content={content} />
      <CalculatorSection calculator={content.calculator} />
      <BulletSection {...content.api} />
      <BulletSection {...content.identity} />
      <RoiCredibilitySection content={content} />
      <CtaSection content={content} />
    </main>
  );
}
