import Link from "next/link";
import { cookies } from "next/headers";
import { BrandLockup } from "@product/ui";
import { productUrls, schedulingUrls } from "@product/config";
import { ArrowRight, Download, ExternalLink, ShieldCheck } from "lucide-react";
import {
  CtaSection,
  HeroSection,
  PremiumVerticalShowcaseSection,
  SimpleTrustFlowSection,
} from "../components/landing-sections";
import { BrandSynergySimulator } from "../components/brand-synergy-simulator";
import { InstitutionalVideoPanel } from "../components/institutional-video-panel";
import { DemoRequestSection } from "../components/demo-request-section";
import { SalesChatWidget } from "../components/sales-chat-widget";
import { EnterpriseSiteHeader } from "../components/enterprise-site-header";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";
import styles from "./home-landing.module.css";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

export default async function HomePage() {
  const { locale, locales, t } = await getWebI18n();
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  const content = landingContent[locale];
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;
  const meetingHref = schedulingUrls.meeting;

  const labels = isEn
    ? {
        demo: "View demonstration",
        sales: "Talk to sales",
        login: "Sign in",
        product: "Product",
        solutions: "Solutions",
        industries: "Industries",
        demonstrations: "Demonstrations",
        resources: "Resources",
        footer: "A product by Inmovar Latam SAS connecting products, operations and people through digital identity and evidence.",
      }
    : isBr
      ? {
          demo: "Ver demonstracao",
          sales: "Falar com vendas",
          login: "Entrar",
          product: "Produto",
          solutions: "Solucoes",
          industries: "Setores",
          demonstrations: "Demonstracoes",
          resources: "Recursos",
          footer: "Um produto da Inmovar Latam SAS que conecta produtos, operacoes e pessoas com identidade e evidencia digital.",
        }
      : {
          demo: "Ver demostración",
          sales: "Hablar con ventas",
          login: "Ingresar",
          product: "Producto",
          solutions: "Soluciones",
          industries: "Rubros",
          demonstrations: "Demostraciones",
          resources: "Recursos",
          footer: "Un producto de Inmovar Latam SAS para conectar productos, operaciones y personas con identidad y evidencia digital.",
        };

  return (
    <main className={`${styles.root} landing-root landing-root--original-clean`}>
      <EnterpriseSiteHeader
        locale={locale}
        locales={locales}
        initialTheme={initialTheme}
        loginHref={loginHref}
      />

      <div id="producto">
        <HeroSection content={content} stats={t.web.stats} locale={locale} radar={content.radar} initialTheme={initialTheme} />
      </div>

      <div id="como-funciona" className="scroll-mt-24">
        <SimpleTrustFlowSection locale={locale} />
      </div>

      <div id="rubros" className="scroll-mt-24">
        <PremiumVerticalShowcaseSection locale={locale} />
      </div>

      <section className="landing-video-band container-shell py-14 md:py-20" aria-label={isEn ? "nexID institutional video" : isBr ? "Vídeo institucional da nexID" : "Video institucional de nexID"}>
        <InstitutionalVideoPanel locale={locale} variant="landing" className="landing-video-panel--compact" initialTheme={initialTheme} />
      </section>

      <section id="activacion" className="landing-brand-synergy-band scroll-mt-24 py-14 md:py-20">
        <div className="landing-brand-synergy-shell container-shell">
          <BrandSynergySimulator locale={locale} />
        </div>
      </section>

      <CtaSection content={content} locale={locale} />
      <DemoRequestSection locale={locale} />
      <SalesChatWidget locale={locale} />
      <CommercialContactModal initialLocale={locale} />

      <footer className="site-footer border-t">
        <div className="container-shell grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Link href="/" aria-label="nexID" className="inline-flex items-center">
              <BrandLockup size={48} variant="ripple" theme="dark" className="brand-surface-footer" />
            </Link>
            <p className="site-muted mt-5 max-w-xl text-sm leading-6">{labels.footer}</p>
            <p className="site-muted mt-5 text-xs">© 2026 nexID · Inmovar Latam SAS. Todos los derechos reservados.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <nav className="site-footer-links" aria-label={isEn ? "Product links" : "Enlaces del producto"}>
              <Link href="/demo-lab">{labels.demonstrations}</Link>
              <Link href="/proof/verify">{isEn ? "Public verifier" : isBr ? "Verificador publico" : "Verificador público"}</Link>
              <Link href="/docs">{isEn ? "Documentation" : isBr ? "Documentacao" : "Documentación"}</Link>
              <Link href="/pricing">{isEn ? "Pricing" : isBr ? "Planos" : "Planes"}</Link>
              <a href="mailto:info@nexid.lat">info@nexid.lat</a>
            </nav>
            <div className="site-footer-actions">
              <a href={meetingHref} target="_blank" rel="noreferrer">{labels.sales}</a>
              <a href={afipDataFiscalHref} target="_F960AFIPInfo" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Información fiscal</a>
              <a href={mipymeCertificateHref} download><Download className="h-4 w-4" /> Certificado MiPyME</a>
            </div>
          </div>
        </div>

        <div className="container-shell grid gap-3 pb-10 md:grid-cols-2">
          <a href={afipDataFiscalHref} target="_F960AFIPInfo" rel="noopener noreferrer" className="site-footer-data-card group rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-800 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Información fiscal</p>
                <p className="mt-1 text-sm font-black">Constancia pública de Inmovar Latam SAS</p>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 text-slate-400" />
            </div>
            <span className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <img src="https://www.afip.gob.ar/images/f960/DATAWEB.jpg" alt="Formulario 960 Data Fiscal AFIP" className="h-10 w-auto" />
            </span>
          </a>

          <a href={mipymeCertificateHref} download className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-slate-900 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Certificado MiPyME</p>
                <p className="mt-1 text-sm font-black">Documento institucional descargable</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm"><ShieldCheck className="h-4 w-4" /></span>
            </div>
            <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"><Download className="h-4 w-4" /> Descargar certificado</span>
          </a>
        </div>
      </footer>

      <div className="landing-mobile-action-dock md:hidden" aria-label={isEn ? "Quick actions" : "Acciones rápidas"}>
        <div className="landing-mobile-action-dock__inner">
          <Link href="/demo-lab" className="landing-mobile-action-dock__link">{labels.demo}</Link>
          <Link href="/?contact=demo#contact-modal" className="landing-mobile-action-dock__link landing-mobile-action-dock__link--primary">
            <span>{isEn ? "Pilot" : "Piloto"}</span><ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <a href={loginHref} className="landing-mobile-action-dock__link landing-mobile-action-dock__link--login">{labels.login}</a>
        </div>
      </div>
      <PwaInstallPrompt />
    </main>
  );
}
