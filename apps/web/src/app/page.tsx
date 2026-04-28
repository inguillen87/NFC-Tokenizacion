import Link from "next/link";
import { BrandLockup, BrandMark, Button, LocaleSwitcher, ThemeToggle } from "@product/ui";
import {
  BulletSection,
  CtaSection,
  EventsTagPositioningSection,
  HeroSection,
  PlansSection,
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
import { productUrls } from "@product/config";
import { productExitHref } from "../components/product-exit-link";
import { ArrowRight } from "lucide-react";
import { LandingProofSection, type ProofSummary } from "../components/landing-proof-section";


const EMPTY_PROOF_SUMMARY: ProofSummary = {
  tapsToday: 0,
  validRate: 0,
  riskBlocked: 0,
  activeRegions: 0,
  demoMode: false,
  latestPublicEvents: [],
};

function parsePublicProofSummary(input: unknown): ProofSummary {
  if (!input || typeof input !== "object") {
    return EMPTY_PROOF_SUMMARY;
  }

  const payload = input as Record<string, unknown>;
  const toNumber = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const toBoolean = (value: unknown): boolean => typeof value === "boolean" ? value : false;
  const toString = (value: unknown): string => (typeof value === "string" ? value : "");

  const latestPublicEvents = Array.isArray(payload.latestPublicEvents)
    ? payload.latestPublicEvents.flatMap((event) => {
      if (!event || typeof event !== "object") return [];
      const eventRecord = event as Record<string, unknown>;
      const city = toString(eventRecord.city);
      const country = toString(eventRecord.country);
      const verdict = toString(eventRecord.verdict);
      const tenant = toString(eventRecord.tenant);
      const occurredAt = toString(eventRecord.occurredAt);
      const uidMasked = toString(eventRecord.uidMasked);

      if (!city || !country || !verdict || !tenant || !occurredAt || !uidMasked) return [];

      return [{ city, country, verdict, tenant, occurredAt, uidMasked }];
    })
    : [];

  return {
    tapsToday: toNumber(payload.tapsToday),
    validRate: toNumber(payload.validRate),
    riskBlocked: toNumber(payload.riskBlocked),
    activeRegions: toNumber(payload.activeRegions),
    demoMode: toBoolean(payload.demoMode),
    latestPublicEvents,
  };
}

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();
  const content = landingContent[locale];

  let proofSummary = EMPTY_PROOF_SUMMARY;
  try {
    const proofSummaryResponse = await fetch(`${productUrls.api}/public/proof/summary`, { cache: "no-store" });
    if (proofSummaryResponse.ok) {
      const proofSummaryJson: unknown = await proofSummaryResponse.json();
      proofSummary = parsePublicProofSummary(proofSummaryJson);
    }
  } catch {
    proofSummary = EMPTY_PROOF_SUMMARY;
  }

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

  const premiumExplainer = locale === "en"
    ? {
      eyebrow: "Premium tokenization + blockchain-ready trust layer",
      title: "Built for premium brands, resellers, and enterprise teams that need anti-fraud, traceability, and loyalty in one flow.",
      body: "Each tap validates authenticity, activates the digital passport, and opens tenant-aware commercial actions.",
      points: [
        "Tap & verify: SUN/NFC authenticity and trust outcome in seconds.",
        "Passport & provenance: product context, status, and guided consumer actions.",
        "Club & marketplace: ownership activation, loyalty and contextual offers.",
      ],
    }
    : locale === "pt-BR"
      ? {
        eyebrow: "Premium tokenization + blockchain-ready trust layer",
        title: "Projetado para marcas premium, revendedores e equipes enterprise que precisam de antifraude, rastreabilidade e fidelização no mesmo fluxo.",
        body: "Cada tap valida autenticidade, ativa o passport digital e abre ações comerciais por tenant.",
        points: [
          "Tap & verificação: autenticidade SUN/NFC e resultado de confiança em segundos.",
          "Passport & provenance: contexto do produto, estado e ações guiadas ao consumidor.",
          "Clube & marketplace: ativação de ownership, loyalty e ofertas contextuais.",
        ],
      }
      : {
        eyebrow: "Premium tokenization + blockchain-ready trust layer",
        title: "Diseñada para marcas premium, resellers y equipos enterprise que necesitan antifraude, trazabilidad y fidelización en la misma experiencia.",
        body: "Cada tap valida autenticidad, activa el passport digital y habilita acciones comerciales por tenant.",
        points: [
          "Tap & verificación: autenticidad SUN/NFC y estado de confianza en segundos.",
          "Passport & provenance: contexto de producto, estado y acciones guiadas al consumidor.",
          "Club & marketplace: activación de ownership, loyalty y ofertas contextuales.",
        ],
      };

  return (
    <main className="landing-root">
      <header className="site-header mobile-optimized-header sticky top-0 z-50 border-b backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/70">
        <div className="container-shell header-main-row flex h-16 items-center justify-between gap-3 sm:h-16 lg:h-16">
          <Link href="/" aria-label="nexID home" className="inline-flex items-center">
            <span className="inline-flex items-center gap-2 px-1 py-1">
              <BrandMark
                size={34}
                variant="ripple"
                theme="dark"
                className="lg:hidden text-white [--brand-mark-bg:transparent] [--brand-mark-border:transparent] [--brand-mark-plate:transparent]"
              />
              <span className="hidden items-center gap-2 lg:inline-flex">
                <BrandMark
                  size={40}
                  variant="ripple"
                  theme="dark"
                  className="text-white [--brand-mark-bg:transparent] [--brand-mark-border:transparent] [--brand-mark-plate:transparent]"
                />
                <span className="text-xl font-bold tracking-tight text-white">nex<span className="text-cyan-300">ID</span></span>
              </span>
            </span>
          </Link>

          <nav className="hidden gap-6 text-sm lg:flex site-nav">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/docs">{content.nav.docs}</Link>
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



      <HeroSection content={content} stats={t.web.stats} locale={locale} />
      <LandingProofSection proof={proofSummary} />
      <RadarSection radar={content.radar} locale={locale} />
      <InteractiveDemoSection locale={locale} />

      <PlansSection content={content} />
      <EventsTagPositioningSection locale={locale} />

      <BulletSection eyebrow={content.identity.eyebrow} title={content.identity.title} description={content.identity.description} bullets={content.identity.bullets} />

      <section className="container-shell py-10">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Canal y arquitectura comercial</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Una sola propuesta clara: autenticación + trazabilidad + operación reseller</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">
            Diseñado para imprentas de seguridad, integradores, agencias, distribuidores y operadores que revenden soluciones a bodegas,
            productores de eventos, organizadores de conferencias y marcas premium. Implementamos un modelo white-label con gobierno central de
            autenticación para que cada partner venda con su marca y opere con estándares enterprise.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-sm font-semibold text-cyan-200">Programa reseller / white-label</p>
              <p className="mt-2 text-sm text-slate-300">Onboarding operativo, playbooks comerciales y soporte para acelerar ventas B2B desde el día uno.</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-sm font-semibold text-cyan-200">Stacks por nivel de riesgo</p>
              <p className="mt-2 text-sm text-slate-300">Desde activaciones con QR/NFC hasta SUN criptográfico con anti-clonado y trazabilidad para sectores críticos.</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-sm font-semibold text-cyan-200">Identidad digital y lifecycle</p>
              <p className="mt-2 text-sm text-slate-300">Cada producto conecta autenticidad, ownership, garantías y marketplace en un flujo continuo y auditable.</p>
            </article>
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
