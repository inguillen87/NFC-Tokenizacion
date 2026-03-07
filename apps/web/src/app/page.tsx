import Link from "next/link";
import { BrandLockup, Button, LocaleSwitcher, ThemeToggle } from "@product/ui";
import {
  BulletSection,
  CtaSection,
  EventsTagPositioningSection,
  HeroSection,
  PlansSection,
  ResellerSection,
} from "../components/landing-sections";
import { CalculatorSection } from "../components/calculator-section";
import { RadarSection } from "../components/radar-section";
import { InteractiveDemoSection } from "../components/interactive-demo-section";
import { SalesChatWidget } from "../components/sales-chat-widget";
import { DemoRequestSection } from "../components/demo-request-section";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { productUrls } from "@product/config";

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();
  const content = landingContent[locale];
  const labels = locale === "en"
    ? {
      demoJson: "Download seed JSON",
      demoCsv: "Download manifest CSV",
      launchLab: "Open Demo Lab",
      assetTitle: "Demo Pack Library",
      assetBody: "Use these files for technical pilots: JSON seeds simulate events and CSV manifests map UID/tag metadata per vertical.",
      whyJson: "Seed JSON: scenario events (tap/open/tamper) to preload demos",
      whyCsv: "Manifest CSV: UID/tag mapping for batch import and operational traceability",
      whyLab: "Demo Lab: controlled test console to simulate scans and verify end-to-end flow",
      forWho: "For agencies, investors, resellers, enterprise buyers and internal sales teams.",
    }
    : locale === "pt-BR"
    ? {
      demoJson: "Baixar seed JSON",
      demoCsv: "Baixar manifest CSV",
      launchLab: "Abrir Demo Lab",
      assetTitle: "Biblioteca de Demo Packs",
      assetBody: "Use estes arquivos em pilotos técnicos: JSON simula eventos e CSV mapeia UID/tag por vertical.",
      whyJson: "Seed JSON: eventos de cenário (tap/open/tamper) para pré-carregar demos",
      whyCsv: "Manifest CSV: mapeamento UID/tag para import de lote e rastreabilidade",
      whyLab: "Demo Lab: console controlado para simular scans e validar o fluxo completo",
      forWho: "Para agências, investidores, revendedores, compradores enterprise e times de vendas.",
    }
    : {
      demoJson: "Descargar seed JSON",
      demoCsv: "Descargar manifest CSV",
      launchLab: "Abrir Demo Lab",
      assetTitle: "Biblioteca de Demo Packs",
      assetBody: "Usá estos archivos para pilotos técnicos: JSON simula eventos y CSV mapea UID/tag por vertical.",
      whyJson: "Seed JSON: eventos de escenario (tap/open/tamper) para precargar demos",
      whyCsv: "Manifest CSV: mapeo UID/tag para importar lotes y trazabilidad operativa",
      whyLab: "Demo Lab: consola controlada para simular lecturas y validar el flujo end-to-end",
      forWho: "Para agencias, inversores, resellers, compradores enterprise y equipos comerciales.",
    };

  const demoPacks = [
    { key: "wine-secure", label: "Wine secure" },
    { key: "events-basic", label: "Events basic" },
    { key: "cosmetics-secure", label: "Cosmetics secure" },
    { key: "agro-secure", label: "Agro secure" },
    { key: "pharma-secure", label: "Pharma secure" },
  ];

  return (
    <main>
      <header className="site-header sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="container-shell flex h-24 items-center justify-between gap-6 lg:h-28">
          <BrandLockup size={64} variant="ripple" theme="dark" className="hero-brand site-main-brand" />

          <nav className="hidden gap-6 text-sm md:flex site-nav">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/docs">{content.nav.docs}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <LocaleSwitcher value={locale} options={[...locales]} />
            <ThemeToggle />
            <a href={`${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`}>
              <Button variant="secondary">{content.nav.cta}</Button>
            </a>
          </div>
        </div>
      </header>

      <HeroSection content={content} stats={t.web.stats} locale={locale} />
      <RadarSection radar={content.radar} locale={locale} />
      <InteractiveDemoSection locale={locale} />

      <PlansSection content={content} />
      <EventsTagPositioningSection locale={locale} />
      <CalculatorSection calculator={content.calculator} locale={locale} />

      <ResellerSection content={content} />
      <BulletSection eyebrow={content.identity.eyebrow} title={content.identity.title} description={content.identity.description} bullets={content.identity.bullets} />

      <section className="container-shell py-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{labels.assetTitle}</p>
          <p className="mt-2 text-sm text-slate-300">{labels.assetBody}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {demoPacks.map((pack) => (
              <div key={pack.key} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">{pack.label}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <a className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" href={`/demo/${pack.key}/seed.json`} download>{labels.demoJson}</a>
                  <a className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" href={`/demo/${pack.key}/manifest.csv`} download>{labels.demoCsv}</a>
                  <a className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200" href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || productUrls.app}/demo-lab`}>{labels.launchLab}</a>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate-300 md:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">{labels.whyJson}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">{labels.whyCsv}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">{labels.whyLab}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">{labels.forWho}</div>
          </div>
        </div>
      </section>

      <CtaSection content={content} />
      <DemoRequestSection locale={locale} />
      <SalesChatWidget locale={locale} />
      <CommercialContactModal />

      <footer className="site-footer border-t">
        <div className="container-shell grid gap-4 py-10 md:grid-cols-[auto_1fr_auto] md:items-center">
          <BrandLockup size={36} variant="ripple" theme="dark" className="hero-brand" />
          <p className="text-sm site-muted">nexID combina tags NFC, autenticación criptográfica, antifraude, trazabilidad y CRM comercial para vino, cosmética, pharma, eventos y canales reseller.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Arquitectura</Link>
            <Link href="/pricing" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Pricing</Link>
            <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">Demo</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
