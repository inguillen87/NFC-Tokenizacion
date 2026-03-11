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
      quickNavTitle: "Quick access",
      quickFaq: "FAQ",
      quickStack: "Stack",
      quickGlossary: "Glossary",
      quickAudiences: "Audience pitch",
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
      quickNavTitle: "Acesso rápido",
      quickFaq: "FAQ",
      quickStack: "Stack",
      quickGlossary: "Glossário",
      quickAudiences: "Pitch por audiência",
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
      quickNavTitle: "Acceso rápido",
      quickFaq: "FAQ",
      quickStack: "Stack",
      quickGlossary: "Glosario",
      quickAudiences: "Pitch por audiencia",
    };

  const demoPacks = [
    { key: "wine-secure", label: "Wine secure", tag: "NTAG 424 DNA TT", sim: "Bottle passport + uncork/tamper flow" },
    { key: "events-basic", label: "Events basic", tag: "NTAG215", sim: "Wristband access + duplicate gate control" },
    { key: "cosmetics-secure", label: "Cosmetics secure", tag: "NTAG 424 DNA TT", sim: "Cap opening + authenticity state" },
    { key: "agro-secure", label: "Agro secure", tag: "NTAG 424 DNA TT", sim: "Bag tear + lot/origin validation" },
    { key: "pharma-secure", label: "Docs & presence secure", tag: "NTAG 424 DNA", sim: "Certificates + contractor credential + proof-of-presence" },
    { key: "luxury-basic", label: "Luxury basic", tag: "NTAG215", sim: "Brand story + ownership activation" },
  ];

  return (
    <main>
      <header className="site-header mobile-optimized-header sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="container-shell header-main-row flex h-24 items-center justify-between gap-6 lg:h-28">
          <Link href="/" aria-label="nexID home" className="inline-flex items-center">
            <BrandLockup size={64} variant="ripple" theme="dark" className="hero-brand site-main-brand" />
          </Link>

          <nav className="hidden gap-6 text-sm md:flex site-nav">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/docs">{content.nav.docs}</Link>
            <Link href="/stack">{labels.quickStack}</Link>
            <Link href="/docs#faq">{labels.quickFaq}</Link>
          </nav>

          <div className="header-actions flex items-center gap-2">
            <LocaleSwitcher value={locale} options={[...locales]} />
            <ThemeToggle />
            <a href={`${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`}>
              <Button variant="secondary">{content.nav.cta}</Button>
            </a>
          </div>
        </div>
      </header>



      <section className="container-shell quick-links-section py-3">
        <div className="quick-links-wrap rounded-xl border border-white/10 bg-slate-900/55 p-2">
          <div className="quick-links-scroll flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs">
            <span className="px-2 py-1 font-semibold text-cyan-300">{labels.quickNavTitle}</span>
            <Link href="/docs#faq" className="quick-link-chip rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">{labels.quickFaq}</Link>
            <Link href="/stack" className="quick-link-chip rounded-full border border-indigo-300/30 bg-indigo-500/10 px-3 py-1.5 text-indigo-100">{labels.quickStack}</Link>
            <Link href="/glossary" className="quick-link-chip rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-100">{labels.quickGlossary}</Link>
            <Link href="/audiences" className="quick-link-chip rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-violet-100">{labels.quickAudiences}</Link>
          </div>
        </div>
      </section>

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
                <p className="text-sm font-semibold text-white">{pack.label} <span className="text-cyan-300">· {pack.tag}</span></p>
                <p className="mt-1 text-xs text-slate-300">{pack.sim}</p>
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
          <Link href="/" aria-label="nexID home" className="inline-flex items-center">
            <BrandLockup size={36} variant="ripple" theme="dark" className="hero-brand" />
          </Link>
          <p className="text-sm site-muted">nexID es una plataforma de identidad física verificable: une carriers como NFC/QR con verificación, estado y derechos digitales para empresas y gobiernos.</p>
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
