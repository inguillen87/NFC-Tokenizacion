import Link from "next/link";
import { cookies } from "next/headers";
import { BrandLockup } from "@product/ui";
import {
  CtaSection,
  HeroSection,
  SimpleTrustFlowSection,
} from "../components/landing-sections";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";
import { MarketingMegaNav } from "../components/marketing-mega-nav";
import { SalesChatWidget } from "../components/sales-chat-widget";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { productUrls, schedulingUrls } from "@product/config";
import { Download, ExternalLink, ShieldCheck } from "lucide-react";

const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";

export default async function HomePage() {
  const { locale, locales } = await getWebI18n();
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  const content = landingContent[locale];

  const scheduleMeetingLabel = locale === "en" ? "Schedule meeting" : locale === "pt-BR" ? "Agendar reunião" : "Agendar reunión";
  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;
  const meetingHref = schedulingUrls.meeting;
  const skipLabel = locale === "en" ? "Skip to content" : locale === "pt-BR" ? "Ir para o conteúdo" : "Ir al contenido";
  const footerCopy = locale === "en"
    ? {
        home: "nexID home",
        summary: "nexID helps brands and organizations verify available evidence, tell each product's story, and activate warranties, benefits, digital certificates and after-sales journeys from an NFC tap or QR scan.",
        architecture: "Architecture",
        plans: "Plans",
        taxEyebrow: "Tax registration",
        taxTitle: "AFIP digital registration",
        taxBody: "Public access to tax information for customers, partners and investors.",
        certificateEyebrow: "MiPyME certificate",
        certificateTitle: "SEPyME institutional backing",
        certificateBody: "Official document available for institutional, commercial and regional validation.",
        download: "Download certificate",
      }
    : locale === "pt-BR"
    ? {
        home: "Início da nexID",
        summary: "A nexID ajuda marcas e organizações a verificar a evidência disponível, contar a história do produto e ativar garantia, benefícios, certificado digital e pós-venda por NFC ou QR.",
        architecture: "Arquitetura",
        plans: "Planos",
        taxEyebrow: "Dados fiscais",
        taxTitle: "Inscrição digital AFIP",
        taxBody: "Acesso público a informações fiscais para clientes, parceiros e investidores.",
        certificateEyebrow: "Certificado MiPyME",
        certificateTitle: "Respaldo institucional SEPyME",
        certificateBody: "Documento oficial para validação institucional, comercial e regional.",
        download: "Baixar certificado",
      }
    : {
        home: "Inicio de nexID",
        summary: "nexID ayuda a marcas y organizaciones a verificar la evidencia disponible, contar la historia del producto y activar garantía, beneficios, certificado digital y postventa desde un toque NFC o QR.",
        architecture: "Arquitectura",
        plans: "Planes",
        taxEyebrow: "Datos fiscales",
        taxTitle: "Inscripción digital AFIP",
        taxBody: "Acceso público a información fiscal para clientes, partners e inversores.",
        certificateEyebrow: "Certificado MiPyME",
        certificateTitle: "Respaldo institucional SEPyME",
        certificateBody: "Documento oficial descargable para validación institucional, comercial y regional.",
        download: "Descargar certificado",
      };

  return (
    <div className="landing-root">
      <a href="#main-content" className="landing-skip-link">{skipLabel}</a>
      <header className="site-header landing-mega-header sticky top-0 z-50 border-b">
        <div className="container-shell header-main-row flex items-center justify-between gap-4">
          <Link href="/" aria-label="nexID home" className="landing-brand-link inline-flex items-center">
            <BrandLockup size={40} variant="static" theme="light" className="site-brand-lockup" />
          </Link>
          <MarketingMegaNav
            locale={locale}
            locales={locales}
            initialTheme={initialTheme}
            loginHref={loginHref}
            meetingHref={meetingHref}
          />
        </div>
      </header>

      <main id="main-content" data-nav-inert>
        <HeroSection content={content} locale={locale} initialTheme={initialTheme} />

        <SimpleTrustFlowSection locale={locale} />
        <CtaSection content={content} locale={locale} />
        <SalesChatWidget locale={locale} deferUntilScroll />
        <CommercialContactModal initialLocale={locale} />
      </main>

      <footer data-nav-inert className="site-footer border-t">
        <div className="container-shell grid gap-4 py-10 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Link href="/" aria-label={footerCopy.home} className="inline-flex items-center">
            <BrandLockup size={42} variant="ripple" theme="dark" className="hero-brand brand-surface-footer" />
          </Link>
          <p className="text-sm site-muted">{footerCopy.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">{footerCopy.architecture}</Link>
            <Link href="/proof/verify" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">Proof Verify</Link>
            <Link href="/sdk" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">SDK</Link>
            <Link href="/pricing" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">{footerCopy.plans}</Link>
            <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs text-cyan-300">Demo</Link>
            <a href="mailto:info@nexid.lat" className="rounded-lg border border-white/15 px-3 py-2 text-xs site-muted">info@nexid.lat</a>
            <a href="https://api.whatsapp.com/send?phone=5492613168608" target="_blank" rel="noreferrer" className="site-footer-whatsapp-link rounded-lg border border-green-500/40 px-3 py-2 text-xs text-green-400">WhatsApp AR</a>
            <a href="https://api.whatsapp.com/send?phone=56988689095" target="_blank" rel="noreferrer" className="site-footer-whatsapp-link rounded-lg border border-green-500/40 px-3 py-2 text-xs text-green-400">WhatsApp CL</a>
            <a href={meetingHref} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/40 px-3 py-2 text-xs text-emerald-300">{scheduleMeetingLabel}</a>
          </div>
        </div>

        <div className="container-shell grid gap-3 pb-10 md:grid-cols-2">
          <a
            href={afipDataFiscalHref}
            target="_F960AFIPInfo"
            rel="noopener noreferrer"
            className="site-footer-data-card group rounded-2xl border border-slate-200 bg-white/90 p-4 text-left text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-cyan-300/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">{footerCopy.taxEyebrow}</p>
                <p className="mt-1 text-sm font-black">{footerCopy.taxTitle}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{footerCopy.taxBody}</p>
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
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">{footerCopy.certificateEyebrow}</p>
                <p className="mt-1 text-sm font-black">{footerCopy.certificateTitle}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{footerCopy.certificateBody}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition group-hover:bg-emerald-700 dark:bg-white dark:text-slate-950 dark:group-hover:bg-emerald-100">
              <Download className="h-4 w-4" />
              {footerCopy.download}
            </span>
          </a>
        </div>
      </footer>
      <div data-nav-inert><PwaInstallPrompt /></div>
    </div>
  );
}
