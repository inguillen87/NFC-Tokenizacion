import Link from "next/link";
import { BrandLockup, BrandMark, Button, LocaleSwitcher, ThemeToggle } from "@product/ui";
import {
  BulletSection,
  CtaSection,
  EventsTagPositioningSection,
  HeroSection,
  PlansSection,
  ResellerSection,
} from "../components/landing-sections";
import { RadarSection } from "../components/radar-section";
import { InteractiveDemoSection } from "../components/interactive-demo-section";
import { SalesChatWidget } from "../components/sales-chat-widget";
import { DemoRequestSection } from "../components/demo-request-section";
import { MobileNavSheet } from "../components/mobile-nav-sheet";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { ProductExitLink } from "../components/product-exit-link";
import { PublicLinkChip } from "../components/public-link-chip";
import { productUrls } from "@product/config";
import { productExitHref } from "../components/product-exit-link";
import { ArrowRight, CirclePlay, FileJson, FileSpreadsheet, Layers3, Sparkles } from "lucide-react";

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
      quickDemoLab: "Demo Lab",
      quickInvestor: "Investor snapshot",
      rolloutDocs: "Read rollout docs",
      rolloutPricing: "See rollout pricing",
      mobileCtaDemo: "Book demo",
      mobileCtaDocs: "Docs",
      mobileCtaLogin: "Sign in",
      intentTitle: "Choose your path",
      intentCards: [
        { title: "Use it in my company", body: "See rollout, chip profiles and operating model.", href: "/?contact=sales&intent=company_rollout#contact-modal", type: "lead" },
        { title: "See my buyer profile", body: "Match the pitch to brand, reseller, government or operator.", href: "/?contact=sales&intent=buyer_profile#contact-modal", type: "lead" },
        { title: "Open Demo Lab", body: "Jump directly into the product surface and simulate the flow.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", type: "lead" },
        { title: "Investor angle", body: "Review the platform story, moat and rollout narrative.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", type: "lead" },
      ],
      rolloutTitle: "Pilot → rollout flow",
      rolloutBullets: [
        "1. Define batch_id, SKU, expected volume and security profile before production.",
        "2. Send supplier the URL template, key ownership rules and manifest CSV format.",
        "3. Import only manifests that match the created batch and compare planned vs imported tags.",
        "4. Activate only audited units before opening the rollout to consumers or partners.",
      ],
      investorTitle: "Investor-ready narrative",
      investorBody: "Enterprise anti-fraud + traceability SaaS first. Optional blockchain-ready layer only for premium use cases with clear ROI.",
      investorCards: [
        "Revenue now: hardware, setup, dashboard SaaS, API, support, reseller channel.",
        "Moat: authenticity + risk data graph (batch, claims, ownership, geography, tamper).",
        "Upside: optional ownership, provenance, warranty and tokenization-ready anchoring.",
      ],
      investorCta: "Open investor snapshot",
      sunCta: "Open SUN validation center",
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
      quickDemoLab: "Demo Lab",
      quickInvestor: "Investor snapshot",
      rolloutDocs: "Ver docs de rollout",
      rolloutPricing: "Ver pricing rollout",
      mobileCtaDemo: "Agendar demo",
      mobileCtaDocs: "Docs",
      mobileCtaLogin: "Entrar",
      intentTitle: "Escolha seu caminho",
      intentCards: [
        { title: "Usar na minha empresa", body: "Veja rollout, perfis de chip e operação.", href: "/?contact=sales&intent=company_rollout#contact-modal", type: "lead" },
        { title: "Ver meu perfil comprador", body: "Adapte o pitch para marca, revenda, governo ou operador.", href: "/?contact=sales&intent=buyer_profile#contact-modal", type: "lead" },
        { title: "Abrir Demo Lab", body: "Entre direto na superfície do produto e simule o fluxo.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", type: "lead" },
        { title: "Ângulo investidor", body: "Revise a narrativa de plataforma, moat e rollout.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", type: "lead" },
      ],
      rolloutTitle: "Fluxo piloto → rollout",
      rolloutBullets: [
        "1. Defina batch_id, SKU, volume esperado e perfil de segurança antes da produção.",
        "2. Envie ao fornecedor o URL template, ownership das keys e o formato CSV do manifest.",
        "3. Importe apenas manifests que coincidam com o batch criado e compare planned vs imported tags.",
        "4. Ative somente unidades auditadas antes de abrir o rollout a consumidores ou parceiros.",
      ],
      investorTitle: "Narrativa pronta para investidor",
      investorBody: "SaaS enterprise de anti-fraude + rastreabilidade primeiro. Camada blockchain-ready opcional apenas para casos premium com ROI claro.",
      investorCards: [
        "Receita hoje: hardware, setup, dashboard SaaS, API, suporte e canal reseller.",
        "Moat: grafo de dados de autenticidade + risco (batch, claims, ownership, geografia, tamper).",
        "Upside: ownership, provenance, warranty e tokenization-ready opcionais.",
      ],
      investorCta: "Abrir investor snapshot",
      sunCta: "Abrir SUN validation center",
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
      quickDemoLab: "Demo Lab",
      quickInvestor: "Investor snapshot",
      rolloutDocs: "Ver docs de rollout",
      rolloutPricing: "Ver pricing rollout",
      mobileCtaDemo: "Agendar demo",
      mobileCtaDocs: "Docs",
      mobileCtaLogin: "Ingresar",
      intentTitle: "Elegí tu camino",
      intentCards: [
        { title: "Usarlo en mi empresa", body: "Mirá rollout, perfiles de chip y modelo operativo.", href: "/?contact=sales&intent=company_rollout#contact-modal", type: "lead" },
        { title: "Ver mi tipo de comprador", body: "Adaptá el pitch para marca, reseller, gobierno u operador.", href: "/?contact=sales&intent=buyer_profile#contact-modal", type: "lead" },
        { title: "Abrir Demo Lab", body: "Entrá directo a la superficie de producto y simulá el flujo.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", type: "lead" },
        { title: "Ángulo inversor", body: "Revisá la narrativa de plataforma, moat y rollout.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", type: "lead" },
      ],
      rolloutTitle: "Flujo piloto → rollout",
      rolloutBullets: [
        "1. Definí batch_id, SKU, volumen esperado y perfil de seguridad antes de fabricar.",
        "2. Entregá al proveedor URL template, ownership de keys y formato CSV del manifest.",
        "3. Importá solo manifests que coincidan con el batch creado y compará planned vs imported tags.",
        "4. Activá únicamente unidades auditadas antes de abrir el rollout a clientes o partners.",
      ],
      investorTitle: "Narrativa lista para inversores",
      investorBody: "Primero SaaS enterprise anti-fraude + trazabilidad. La capa blockchain-ready es opcional para casos premium con ROI real.",
      investorCards: [
        "Revenue hoy: hardware, setup, dashboard SaaS, API, soporte y canal reseller.",
        "Moat: grafo de datos de autenticidad + riesgo (lotes, claims, ownership, geografía, tamper).",
        "Upside: ownership, provenance, warranty y tokenización opcional anclable.",
      ],
      investorCta: "Abrir investor snapshot",
      sunCta: "Abrir SUN validation center",
    };

  const demoPacks = [
    { key: "wine-secure", label: "Wine secure", tag: "NTAG 424 DNA TT", sim: "Bottle passport + uncork/tamper flow" },
    { key: "events-basic", label: "Events basic", tag: "NTAG215", sim: "Wristband access + duplicate gate control" },
    { key: "cosmetics-secure", label: "Cosmetics secure", tag: "NTAG 424 DNA TT", sim: "Cap opening + authenticity state" },
    { key: "agro-secure", label: "Agro secure", tag: "NTAG 424 DNA TT", sim: "Bag tear + lot/origin validation" },
    { key: "pharma-secure", label: "Docs & presence secure", tag: "NTAG 424 DNA", sim: "Certificates + contractor credential + proof-of-presence" },
    { key: "luxury-basic", label: "Luxury basic", tag: "NTAG215", sim: "Brand story + ownership activation" },
  ];

  const techMatrix = locale === "en"
    ? {
      title: "Tag strategy: QR + NTAG212/213/215 + NTAG424 DNA TagTamper",
      body: "Enterprise rollout combines accessibility (QR/basic tags) with anti-fraud cryptographic proof (424 TT) according to product risk and margin.",
      rows: [
        { tech: "QR + NTAG212/213", fit: "Entry SKU / broad campaigns", proof: "Fast adoption, lower security", mobile: "Landing + lead capture + basic provenance" },
        { tech: "NTAG215", fit: "Events, memberships, loyalty", proof: "UID allowlist + anti-duplicate ops", mobile: "Access/control experience with CTA" },
        { tech: "NTAG424 DNA / TagTamper", fit: "Wine, pharma, cosmetics, agro", proof: "Encrypted SUN + anti-tamper + anti-clone", mobile: "Premium authenticity passport + ownership/warranty" },
      ],
    }
    : locale === "pt-BR"
      ? {
        title: "Estratégia de tags: QR + NTAG212/213/215 + NTAG424 DNA TagTamper",
        body: "Rollout enterprise combina acessibilidade (QR/tags básicas) com prova anti-fraude criptográfica (424 TT) conforme risco e margem.",
        rows: [
          { tech: "QR + NTAG212/213", fit: "SKU de entrada / campanhas massivas", proof: "Adoção rápida, segurança menor", mobile: "Landing + captura de lead + provenance básico" },
          { tech: "NTAG215", fit: "Eventos, memberships, loyalty", proof: "UID allowlist + operação anti-duplicação", mobile: "Experiência de acesso/controle com CTA" },
          { tech: "NTAG424 DNA / TagTamper", fit: "Vinho, pharma, cosméticos, agro", proof: "SUN criptográfico + anti-tamper + anti-clone", mobile: "Passport premium de autenticidade + ownership/garantia" },
        ],
      }
      : {
        title: "Estrategia de tags: QR + NTAG212/213/215 + NTAG424 DNA TagTamper",
        body: "El rollout enterprise combina accesibilidad (QR/tags básicos) con prueba antifraude criptográfica (424 TT) según riesgo y margen de producto.",
        rows: [
          { tech: "QR + NTAG212/213", fit: "SKU de entrada / campañas masivas", proof: "Adopción rápida, seguridad menor", mobile: "Landing + captura de lead + provenance básico" },
          { tech: "NTAG215", fit: "Eventos, memberships, loyalty", proof: "UID allowlist + operación anti-duplicado", mobile: "Experiencia de acceso/control con CTA" },
          { tech: "NTAG424 DNA / TagTamper", fit: "Vino, pharma, cosmética, agro", proof: "SUN cifrado + anti-tamper + anti-clon", mobile: "Passport premium de autenticidad + ownership/garantía" },
        ],
      };

  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;

  const mobileNavItems = [
    { label: content.nav.product, href: "/" },
    { label: content.nav.pricing, href: "/pricing" },
    { label: content.nav.reseller, href: "/resellers" },
    { label: content.nav.docs, href: "/docs" },
    { label: labels.quickDemoLab, href: productExitHref.demoLab },
    { label: labels.quickInvestor, href: productExitHref.investorSnapshot },
    { label: labels.quickAudiences, href: "/audiences" },
    { label: labels.quickGlossary, href: "/glossary" },
    { label: labels.quickStack, href: "/stack" },
    { label: labels.quickFaq, href: "/docs#faq" },
    { label: labels.sunCta, href: "/sun" },
  ];

  return (
    <main>
      <header className="site-header mobile-optimized-header sticky top-0 z-50 border-b backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/70">
        <div className="container-shell header-main-row flex h-16 items-center justify-between gap-3 sm:h-16 lg:h-16">
          <Link href="/" aria-label="nexID home" className="inline-flex items-center">
            <span className="inline-flex items-center gap-2 px-1 py-1">
              <BrandMark
                size={28}
                variant="ripple"
                theme="dark"
                className="lg:hidden text-white [--brand-mark-bg:transparent] [--brand-mark-border:transparent] [--brand-mark-plate:transparent]"
              />
              <span className="hidden items-center gap-2 lg:inline-flex">
                <BrandMark
                  size={28}
                  variant="ripple"
                  theme="dark"
                  className="text-white [--brand-mark-bg:transparent] [--brand-mark-border:transparent] [--brand-mark-plate:transparent]"
                />
                <span className="text-base font-semibold tracking-tight text-white">nex<span className="text-cyan-300">ID</span></span>
              </span>
            </span>
          </Link>

          <nav className="hidden gap-6 text-sm lg:flex site-nav">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/docs">{content.nav.docs}</Link>
            <Link href="/stack">{labels.quickStack}</Link>
            <Link href="/docs#faq">{labels.quickFaq}</Link>
          </nav>

          <div className="header-actions flex items-center gap-2">
            <MobileNavSheet
              items={mobileNavItems}
              loginHref={loginHref}
              loginLabel={content.nav.cta}
              primaryCtaHref="/?contact=demo#contact-modal"
              primaryCtaLabel={labels.mobileCtaDemo}
            />
            <div className="hidden lg:inline-flex">
              <LocaleSwitcher value={locale} options={[...locales]} />
            </div>
            <div className="hidden lg:inline-flex">
              <ThemeToggle />
            </div>
            <ProductExitLink kind="demoLab" className="hidden sm:inline-flex">
              <Button variant="secondary">{labels.quickDemoLab}</Button>
            </ProductExitLink>
            <a href={loginHref} className="hidden sm:inline-flex">
              <Button variant="secondary">{content.nav.cta}</Button>
            </a>
          </div>
        </div>
      </header>



      <section className="container-shell quick-links-section hidden py-3 md:block">
        <div className="quick-links-wrap rounded-xl border border-white/10 bg-slate-900/55 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_45px_rgba(8,15,30,0.35)]">
          <div className="quick-links-scroll flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 font-semibold text-cyan-300"><Sparkles className="h-3.5 w-3.5" />{labels.quickNavTitle}</span>
            <PublicLinkChip href="/docs#faq" variant="cyan" className="quick-link-chip">{labels.quickFaq}</PublicLinkChip>
            <PublicLinkChip href="/stack" variant="indigo" icon={<Layers3 className="h-3.5 w-3.5" />} className="quick-link-chip">{labels.quickStack}</PublicLinkChip>
            <PublicLinkChip href="/glossary" variant="emerald" className="quick-link-chip">{labels.quickGlossary}</PublicLinkChip>
            <PublicLinkChip href={productExitHref.investorSnapshot} variant="amber" className="quick-link-chip">{labels.quickInvestor}</PublicLinkChip>
            <PublicLinkChip href="/audiences" variant="violet" className="quick-link-chip">{labels.quickAudiences}</PublicLinkChip>
            <PublicLinkChip href={productExitHref.demoLab} variant="amber" icon={<CirclePlay className="h-3.5 w-3.5" />} className="quick-link-chip">{labels.quickDemoLab}</PublicLinkChip>
          </div>
        </div>
      </section>

      <section className="container-shell pb-2 md:hidden">
        <div className="grid grid-cols-3 gap-2">
          <Link href="/docs" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-medium text-slate-100">{labels.mobileCtaDocs}</Link>
          <Link href="/pricing" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-medium text-slate-100">{content.nav.pricing}</Link>
          <Link href="/?contact=demo#contact-modal" className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-center text-xs font-medium text-cyan-100">{labels.mobileCtaDemo}</Link>
        </div>
      </section>

      <HeroSection content={content} stats={t.web.stats} locale={locale} />

      <section className="container-shell py-8 md:py-10">
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_12%_18%,rgba(6,182,212,.24),transparent_36%),radial-gradient(circle_at_90%_80%,rgba(99,102,241,.24),transparent_40%),linear-gradient(160deg,#050b1f,#0b1633_55%,#101536)] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Premium tokenization + blockchain-ready trust layer</p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold text-white md:text-3xl">
              Diseñada para marcas premium, resellers y equipos enterprise que necesitan antifraude, trazabilidad y fidelización en la misma experiencia.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Cada tap en una etiqueta NFC NTAG424 DNA TagTamper puede abrir el portal del usuario, activar ownership, registrar eventos de riesgo y conectar con marketplace, club premium y campañas.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Wine & spirits</p>
                <p className="mt-2 text-sm text-slate-200">Evento de descorche + sello alterado + validación geográfica en tiempo real.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-violet-200">Events & hospitality</p>
                <p className="mt-2 text-sm text-slate-200">Pulseras NFC con acceso inteligente, anti-duplicado y upgrades VIP.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Pharma, agro, cosmetics</p>
                <p className="mt-2 text-sm text-slate-200">Cadena de custodia, lote/origen y estado de empaque para compliance comercial.</p>
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[linear-gradient(165deg,#030b1f,#081a38_55%,#10163a)] p-6">
            <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-violet-500/20 blur-3xl" />
            <p className="relative z-10 text-xs uppercase tracking-[0.16em] text-cyan-300">Cómo funciona end-to-end</p>
            <h3 className="relative z-10 mt-3 text-xl font-semibold text-white">De la etiqueta física al portal del cliente en 3 pasos claros.</h3>
            <div className="relative z-10 mt-4 space-y-3 text-sm text-slate-200">
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">01 · Tap & verificación</p>
                <p className="mt-1">El NFC TagTamper valida autenticidad, detecta replay/opened y registra geoseñal en tiempo real.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-violet-200">02 · SUN mobile + acciones</p>
                <p className="mt-1">El usuario accede al passport, provenance, garantías y tokenización opcional según estado de riesgo.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">03 · Club & marketplace</p>
                <p className="mt-1">Registro al portal, asociación al tenant y acceso a recompensas/promos desde el marketplace del club.</p>
              </div>
            </div>
            <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2"><p className="text-cyan-200">Fraude</p><p className="font-semibold text-white">↓ Replay</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2"><p className="text-violet-200">Operación</p><p className="font-semibold text-white">↑ Trazabilidad</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2"><p className="text-emerald-200">Revenue</p><p className="font-semibold text-white">↑ Club/CRM</p></div>
            </div>
          </article>
        </div>
      </section>

      <section className="container-shell py-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{labels.intentTitle}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {labels.intentCards.map((card) => {
              const body = (
                <>
                  <p className="text-sm font-semibold text-white">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{card.body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-200">Explorar<ArrowRight className="h-4 w-4" /></span>
                </>
              );

              return (
                <Link key={card.title} href={card.href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
                  {body}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <RadarSection radar={content.radar} locale={locale} />
      <InteractiveDemoSection locale={locale} />

      <PlansSection content={content} />
      <EventsTagPositioningSection locale={locale} />

      <ResellerSection content={content} />
      <BulletSection eyebrow={content.identity.eyebrow} title={content.identity.title} description={content.identity.description} bullets={content.identity.bullets} />

      <section className="container-shell py-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{labels.assetTitle}</p>
          <p className="mt-2 text-sm text-slate-300">{labels.assetBody}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {demoPacks.map((pack) => (
              <div key={pack.key} className="group rounded-xl border border-white/10 bg-slate-950/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-slate-950 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
                <p className="text-sm font-semibold text-white">{pack.label} <span className="text-cyan-300">· {pack.tag}</span></p>
                <p className="mt-1 text-xs text-slate-300">{pack.sim}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <a className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white transition-colors duration-200 group-hover:border-white/20" href={`/demo/${pack.key}/seed.json`} download><FileJson className="h-3.5 w-3.5" />{labels.demoJson}</a>
                  <a className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white transition-colors duration-200 group-hover:border-white/20" href={`/demo/${pack.key}/manifest.csv`} download><FileSpreadsheet className="h-3.5 w-3.5" />{labels.demoCsv}</a>
                  <ProductExitLink kind="demoLab" className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 transition-transform duration-200 group-hover:translate-x-0.5"><CirclePlay className="h-3.5 w-3.5" />{labels.launchLab}</ProductExitLink>
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
          <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">{labels.rolloutTitle}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {labels.rolloutBullets.map((item) => (
                <div key={item} className="rounded-lg border border-cyan-300/15 bg-slate-950/50 p-3 text-xs text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-slate-950/70">{item}</div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/docs" className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-slate-950/60 px-3 py-2 text-xs text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">{labels.rolloutDocs}<ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link href="/pricing" className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-slate-950/60 px-3 py-2 text-xs text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">{labels.rolloutPricing}<ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-shell py-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{techMatrix.title}</p>
          <p className="mt-2 text-sm text-slate-300">{techMatrix.body}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {techMatrix.rows.map((row) => (
              <article key={row.tech} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">{row.tech}</p>
                <p className="mt-2 text-xs text-slate-300">Fit: <span className="text-white">{row.fit}</span></p>
                <p className="mt-1 text-xs text-slate-300">Security: <span className="text-white">{row.proof}</span></p>
                <p className="mt-1 text-xs text-cyan-100">Mobile UX: {row.mobile}</p>
              </article>
            ))}
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
            <BrandLockup size={42} variant="ripple" theme="dark" className="hero-brand brand-surface-footer" />
          </Link>
          <p className="text-sm site-muted">nexID es una plataforma de identidad física verificable: une carriers como NFC/QR con verificación, estado y derechos digitales para empresas y gobiernos.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Arquitectura</Link>
            <Link href="/pricing" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Pricing</Link>
            <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">Demo</Link>
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-3 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0px)] md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-[0_18px_50px_rgba(2,8,23,0.45)] backdrop-blur-xl">
          <Link href="/docs" className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-xs font-medium text-slate-100">{labels.mobileCtaDocs}</Link>
          <Link href="/?contact=demo#contact-modal" className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-xs font-medium text-cyan-100">{labels.mobileCtaDemo}<ArrowRight className="h-4 w-4" /></Link>
          <a href={loginHref} className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 py-2 text-center text-xs font-semibold text-emerald-100">{labels.mobileCtaLogin}</a>
        </div>
      </div>
      <PwaInstallPrompt />
    </main>
  );
}
