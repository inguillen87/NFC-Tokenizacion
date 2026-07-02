import Link from "next/link";
import { cookies } from "next/headers";
import { BrandLockup, Button, LocaleSwitcher, ThemeToggle } from "@product/ui";
import {
  CtaSection,
  EnterpriseTrustLayersSection,
  HeroSection,
  OfflineFieldOperationsSection,
  SimpleTrustFlowSection,
} from "../components/landing-sections";
import { BrandSynergySimulator } from "../components/brand-synergy-simulator";
import { SalesChatWidget } from "../components/sales-chat-widget";
import { DemoRequestSection } from "../components/demo-request-section";
import { MobileNavSheet } from "../components/mobile-nav-sheet";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { ProductExitLink } from "../components/product-exit-link";
import { productUrls, schedulingUrls } from "@product/config";
import { productExitHref } from "../components/product-exit-link";
import { ArrowRight, Download, ExternalLink, ShieldCheck, BookOpen, BadgeDollarSign, Layers3, Smartphone, Zap } from "lucide-react";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
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
      mobileCtaMeeting: "Meeting",
      scheduleMeeting: "Schedule meeting",
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
      consumerPortal: "Consumer Portal",
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
      mobileCtaMeeting: "Reuniao",
      scheduleMeeting: "Agendar reuniao",
      intentTitle: "Escolha seu caminho",
      intentCards: [
        { title: "Usar na minha empresa", body: "Veja rollout, perfis de chip e operação.", href: "/?contact=sales&intent=company_rollout#contact-modal", type: "lead" },
        { title: "Ver meu perfil comprador", body: "Adapte o pitch para marca, revenda, governo ou operador.", href: "/?contact=sales&intent=buyer_profile#contact-modal", type: "lead" },
        { title: "Abrir Demo Lab", body: "Entre direto na superfície do produto e simule o fluxo.", href: "/?contact=demo&intent=demo_lab&vertical=events#contact-modal", type: "lead" },
        { title: "Angulo investidor", body: "Revise a narrativa de plataforma, moat e rollout.", href: "/?contact=quote&intent=investor_snapshot#contact-modal", type: "lead" },
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
      consumerPortal: "Portal do Consumidor",
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
      mobileCtaMeeting: "Reunion",
      scheduleMeeting: "Agendar reunion",
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
      consumerPortal: "Portal Consumidor",
    };

  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;
  const meetingHref = schedulingUrls.meeting;

  const mobileNavItems = [
    { label: content.nav.product, href: "/" },
    { label: "Portal Consumidor Demo", href: "/login?next=/me" },
    { label: content.nav.pricing, href: "/pricing" },
    { label: content.nav.reseller, href: "/resellers" },
    { label: "SDK", href: "/sdk" },
    { label: content.nav.docs, href: "/docs" },
    { label: labels.quickDemoLab, href: productExitHref.demoLab },
    { label: labels.scheduleMeeting, href: meetingHref, external: true },
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
      body: "Each tap runs the configured trust checks, updates the digital passport, and opens tenant-aware actions only when policy allows it.",
      points: [
        "Tap & verify: SUN/NFC evidence and trust outcome in seconds.",
        "Passport & provenance: product context, status, and guided consumer actions.",
        "Club & marketplace: gated ownership activation, loyalty and contextual offers.",
      ],
    }
    : locale === "pt-BR"
      ? {
        eyebrow: "Premium tokenization + blockchain-ready trust layer",
        title: "Projetado para marcas premium, revendedores e equipes enterprise que precisam de antifraude, rastreabilidade e fidelização no mesmo fluxo.",
        body: "Cada tap executa as validações configuradas, atualiza o passport digital e abre ações comerciais somente quando a política permite.",
        points: [
          "Tap & verificação: evidência SUN/NFC e resultado de confiança em segundos.",
          "Passport & provenance: contexto do produto, estado e ações guiadas ao consumidor.",
          "Clube & marketplace: ativação de ownership, loyalty e ofertas contextuais com regras de aprovação.",
        ],
      }
      : {
        eyebrow: "Premium tokenization + blockchain-ready trust layer",
        title: "Diseñada para marcas premium, resellers y equipos enterprise que necesitan antifraude, trazabilidad y fidelización en la misma experiencia.",
        body: "Cada tap ejecuta las validaciones configuradas, actualiza el pasaporte digital y habilita acciones comerciales solo cuando la política lo permite.",
        points: [
          "Tap & verificación: evidencia SUN/NFC y estado de confianza en segundos.",
          "Passport & provenance: contexto de producto, estado y acciones guiadas al consumidor.",
          "Club & marketplace: activación de ownership, loyalty y ofertas contextuales con reglas de aprobación.",
        ],
      };

  return (
    <main className="landing-root">
      <header className="site-header mobile-optimized-header sticky top-0 z-50 border-b backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/70">
        <div className="container-shell header-main-row flex h-16 items-center justify-between gap-3 sm:h-16 lg:h-16">
          <Link href="/" aria-label="nexID home" className="inline-flex items-center">
            <BrandLockup size={52} variant="ripple" theme="dark" className="site-brand-lockup" />
          </Link>

          <nav className="hidden gap-6 text-sm xl:flex site-nav">
            <Link href="/">{content.nav.product}</Link>
            <Link href="/pricing">{content.nav.pricing}</Link>
            <Link href="/resellers">{content.nav.reseller}</Link>
            <Link href="/sdk">SDK</Link>
            <Link href="/docs">{content.nav.docs}</Link>
          </nav>

          <div className="header-actions flex items-center gap-2">
            <MobileNavSheet
              items={mobileNavItems}
              loginHref={loginHref}
              loginLabel={content.nav.cta}
              primaryCtaHref="/?contact=demo#contact-modal"
              primaryCtaLabel={labels.mobileCtaDemo}
              meetingHref={meetingHref}
              meetingLabel={labels.scheduleMeeting}
              locale={locale}
              locales={[...locales]}
            />
            <div className="hidden lg:inline-flex">
              <LocaleSwitcher value={locale} options={[...locales]} />
            </div>
            <div className="hidden lg:inline-flex">
              <ThemeToggle />
            </div>
            <a href={meetingHref} target="_blank" rel="noreferrer" className="hidden xl:inline-flex">
              <Button variant="secondary">{labels.scheduleMeeting}</Button>
            </a>
            <ProductExitLink kind="demoLab" className="hidden lg:inline-flex">
              <Button variant="secondary">{labels.quickDemoLab}</Button>
            </ProductExitLink>
            <Link href="/login?next=/me" className="hidden xl:inline-flex">
              <Button variant="secondary" className="border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20">
                {labels.consumerPortal}
              </Button>
            </Link>
            <a href={loginHref} className="inline-flex">
              <Button variant="secondary">{content.nav.cta}</Button>
            </a>
          </div>
        </div>
      </header>

      <HeroSection content={content} stats={t.web.stats} locale={locale} radar={content.radar} initialTheme={initialTheme} />

      <SimpleTrustFlowSection locale={locale} />
      <EnterpriseTrustLayersSection locale={locale} />
      <OfflineFieldOperationsSection locale={locale} />
      {/* nexID Cognitive AI & Brand Synergy Section */}
      <section className="container-shell my-16">
        <div className="landing-brand-synergy-shell relative overflow-hidden rounded-3xl border border-purple-500/25 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.15),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-8 shadow-2xl md:p-10">
          <BrandSynergySimulator locale={locale} />
        </div>
      </section>

      {/* Quick-Jump Hub Directory */}
      <section className="container-shell my-16">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
            {locale === "en" ? "Explore nexID Platform Depth" : "Explorá la Búsqueda de Soluciones"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {locale === "en" 
              ? "Zero fluff. Jump directly into technical specifications, live simulators, ROI math, or operational vocabulary."
              : "Sin redundancia ni rodeos. Navegá directo a las especificaciones técnicas, simuladores en vivo, calculadora de ROI o glosario."
            }
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Demo Lab */}
          <div className="group rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-slate-900/60">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
              <Zap className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-bold text-white">🧪 Demo Lab & Sandbox</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === "en" 
                ? "Simulate physical NFC scans, read-location risk signals, verification logs, and tamper events in real-time."
                : "Simulá escaneos físicos de chips, señales de riesgo por ubicación de lectura, logs de auditoría y tamper en tiempo real."
              }
            </p>
            <Link href="/demo-lab" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
              {locale === "en" ? "Open Sandbox" : "Abrir Sandbox"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Card 2: Docs & APIs */}
          <div className="group rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
              <BookOpen className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-bold text-white">📖 Documentación & APIs</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === "en" 
                ? "Step-by-step developer guides, operational manifests format, and technical API reference."
                : "Guías de desarrollo paso a paso, formato de manifiestos operativos de lotes y referencia técnica de API."
              }
            </p>
            <Link href="/docs" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
              {locale === "en" ? "Read Docs" : "Ver Documentos"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Card 3: Pricing & ROI */}
          <div className="group rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:bg-slate-900/60">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
              <BadgeDollarSign className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-bold text-white">💳 Planes y Calculadora ROI</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === "en" 
                ? "Estimate hardware setup costs, SaaS usage fees, and commercial business value by industry."
                : "Estimá costos de hardware/setup, licencias mensuales de SaaS y calculadora de retorno de inversión por sector."
              }
            </p>
            <Link href="/pricing" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-300 group-hover:text-amber-200">
              {locale === "en" ? "Calculate Costs" : "Calcular Costos"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Card 4: Verify Centre (SUN) */}
          <div className="group rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900/60">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-bold text-white">🛡️ Verify Centre (SUN)</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === "en" 
                ? "Public verification portal for cryptographic tags (SUN/SDM) to prove physical presence."
                : "Portal público de validación criptográfica SUN/SDM para constatar procedencia y firmas físicas."
              }
            </p>
            <Link href="/sun" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-300 group-hover:text-blue-200">
              {locale === "en" ? "Verify Tag" : "Validar Tag"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Card 5: Billetera Consumidor */}
          <div className="group rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 hover:bg-slate-900/60">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
              <Smartphone className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-bold text-white">🍇 Portal & Billetera /me</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === "en" 
                ? "The digital home for consumer assets, claimed NFTs, certificates, and P2P trade market."
                : "El hogar digital de activos del comprador: pasaportes reclamados, certificados de procedencia y P2P trades."
              }
            </p>
            <Link href="/login?next=/me" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-purple-300 group-hover:text-purple-200">
              {locale === "en" ? "Open Wallet" : "Ver Billetera"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Card 6: Glosario & Pitch */}
          <div className="group rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-pink-500/30 hover:bg-slate-900/60">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300">
              <Layers3 className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-bold text-white">🎓 Glosario y Audiencias</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {locale === "en" 
                ? "Key terms explained and tailored pitches for brands, resellers, or governments."
                : "Glosario de conceptos físicos/digitales y pitch comercial adaptado para marcas o resellers."
              }
            </p>
            <Link href="/glossary" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-pink-300 group-hover:text-pink-200">
              {locale === "en" ? "View Glossary" : "Ver Glosario"} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      <CtaSection content={content} locale={locale} />
      <DemoRequestSection locale={locale} />
      <SalesChatWidget locale={locale} />
      <CommercialContactModal />

      <footer className="site-footer border-t">
        <div className="container-shell grid gap-4 py-10 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Link href="/" aria-label="nexID home" className="inline-flex items-center">
            <BrandLockup size={42} variant="ripple" theme="dark" className="hero-brand brand-surface-footer" />
          </Link>
          <p className="text-sm site-muted">nexID ayuda a marcas y organizaciones a verificar evidencia de autenticidad, contar la historia del producto y activar garantía, beneficios, certificado digital y postventa desde un toque NFC o QR.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Arquitectura</Link>
            <Link href="/sdk" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">SDK</Link>
            <Link href="/pricing" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">Pricing</Link>
            <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">Demo</Link>
            <a href="mailto:info@nexid.lat" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">info@nexid.lat</a>
            <a href="https://api.whatsapp.com/send?phone=5492613168608" target="_blank" rel="noreferrer" className="rounded-lg border border-green-500/40 px-3 py-2 text-xs text-green-400">WhatsApp AR</a>
            <a href="https://api.whatsapp.com/send?phone=56988689095" target="_blank" rel="noreferrer" className="rounded-lg border border-green-500/40 px-3 py-2 text-xs text-green-400">WhatsApp CL</a>
            <a href={meetingHref} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/40 px-3 py-2 text-xs text-emerald-300">{labels.scheduleMeeting}</a>
          </div>
        </div>

        <div className="container-shell grid gap-3 pb-10 md:grid-cols-2">
          <a
            href={afipDataFiscalHref}
            target="_F960AFIPInfo"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-slate-200 bg-white/90 p-4 text-left text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-cyan-300/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">Data fiscal</p>
                <p className="mt-1 text-sm font-black">Inscripcion digital AFIP</p>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Acceso publico a informacion fiscal para clientes, partners e inversores.</p>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 text-slate-400 transition group-hover:text-cyan-600 dark:text-slate-500 dark:group-hover:text-cyan-300" />
            </div>
            <span className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10">
              <img src="https://www.afip.gob.ar/images/f960/DATAWEB.jpg" alt="Formulario 960 Data Fiscal AFIP" className="h-10 w-auto" />
            </span>
          </a>

          <a
            href={mipymeCertificateHref}
            download
            className="group rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-left text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-white dark:hover:border-emerald-300/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Certificado MiPyME</p>
                <p className="mt-1 text-sm font-black">Respaldo institucional SEPyME</p>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Documento oficial descargable para validacion institucional, comercial y regional.</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition group-hover:bg-emerald-700 dark:bg-white dark:text-slate-950 dark:group-hover:bg-emerald-100">
              <Download className="h-4 w-4" />
              Descargar certificado
            </span>
          </a>
        </div>
      </footer>

      <div className="px-3 py-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+1rem)] md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-[0_18px_50px_rgba(2,8,23,0.45)] backdrop-blur-xl">
          <Link href="/docs" className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-xs font-medium text-slate-100">{labels.mobileCtaDocs}</Link>
          <Link href="/?contact=demo#contact-modal" className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-xs font-medium text-cyan-100">{labels.mobileCtaDemo}<ArrowRight className="h-4 w-4" /></Link>
          <a href={meetingHref} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/15 px-2 py-2 text-center text-xs font-semibold text-violet-100">{labels.mobileCtaMeeting}</a>
          <a href={loginHref} className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-2 py-2 text-center text-xs font-semibold text-emerald-100">{labels.mobileCtaLogin}</a>
        </div>
      </div>
      <PwaInstallPrompt />
    </main>
  );
}
