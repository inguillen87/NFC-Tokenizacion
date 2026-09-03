import Link from "next/link";
import { cookies } from "next/headers";
import {
  HeroSection,
  SimpleTrustFlowSection,
  CommercialValueSection,
} from "../components/home-sections";
import { BrandHomeLink } from "../components/brand-home-link";
import { MarketingMegaNav } from "../components/marketing-mega-nav";
import { landingContent } from "../lib/landing-content";
import { getWebI18n } from "../lib/locale";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { ConnectedProductIndustryProvider } from "../components/connected-product-industry-context";
import { productUrls, schedulingUrls } from "@product/config";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { Building2, Facebook, Globe2, Instagram, Linkedin } from "lucide-react";

export default async function HomePage() {
  const { locale, locales } = await getWebI18n();
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );
  const content = landingContent[locale];

  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;
  const meetingHref = schedulingUrls.meeting;
  const skipLabel = locale === "en" ? "Skip to content" : locale === "pt-BR" ? "Ir para o conteúdo" : "Ir al contenido";
  const footerCopy = locale === "en"
    ? {
        home: "nexID home",
        summary: "Connected products. Closer brands.",
        product: "Product",
        how: "How it works",
        demoLab: "Demo Lab",
        about: "About us",
        company: "Company",
        resellers: "Partners and resellers",
        institutional: "Institutional information",
        resources: "Resources",
        docs: "Documentation",
        architecture: "Architecture",
        verify: "Verify public evidence",
        plans: "Plans and pilots",
        contact: "Contact",
        schedule: "Book a demo",
        ecosystem: "A platform within the Inmovar Latam ecosystem.",
        ecosystemTitle: "nexID ecosystem",
        inmovarBody: "The technology ecosystem where nexID is built.",
        aboutBody: "Meet the people, purpose and institutional background behind nexID.",
        website: "Website",
      }
    : locale === "pt-BR"
    ? {
        home: "Início da nexID",
        summary: "Produtos conectados. Marcas mais próximas.",
        product: "Produto",
        how: "Como funciona",
        demoLab: "Demo Lab",
        about: "Quem somos",
        company: "Empresa",
        resellers: "Parceiros e revendedores",
        institutional: "Informações institucionais",
        resources: "Recursos",
        docs: "Documentação",
        architecture: "Arquitetura",
        verify: "Verificar evidência pública",
        plans: "Planos e pilotos",
        contact: "Contato",
        schedule: "Agendar demo",
        ecosystem: "Uma plataforma do ecossistema Inmovar Latam.",
        ecosystemTitle: "Ecossistema nexID",
        inmovarBody: "O ecossistema tecnológico onde a nexID é desenvolvida.",
        aboutBody: "Conheça as pessoas, o propósito e o respaldo institucional por trás da nexID.",
        website: "Site",
      }
    : {
        home: "Inicio de nexID",
        summary: "Productos conectados. Marcas más cerca.",
        product: "Producto",
        how: "Cómo funciona",
        demoLab: "Demo Lab",
        about: "Quiénes somos",
        company: "Empresa",
        resellers: "Partners y resellers",
        institutional: "Información institucional",
        resources: "Recursos",
        docs: "Documentación",
        architecture: "Arquitectura",
        verify: "Verificar evidencia pública",
        plans: "Planes y pilotos",
        contact: "Contacto",
        schedule: "Agendar demo",
        ecosystem: "Una plataforma del ecosistema Inmovar Latam.",
        ecosystemTitle: "Ecosistema nexID",
        inmovarBody: "El ecosistema tecnológico donde se desarrolla nexID.",
        aboutBody: "Conocé a quienes impulsan la plataforma, su propósito y el respaldo institucional de nexID.",
        website: "Sitio web",
      };

  return (
    <div className="landing-root">
      <a href="#main-content" className="landing-skip-link">{skipLabel}</a>
      <header className="site-header landing-mega-header sticky top-0 z-50 border-b">
        <div className="container-shell header-main-row flex items-center justify-between gap-4">
          <BrandHomeLink
            ariaLabel={footerCopy.home}
            locale={locale}
            size={56}
            variant="static"
            theme="light"
            brandClassName="site-brand-lockup"
            className="landing-brand-link"
          />
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
        <HeroSection content={content} locale={locale} />

        <ConnectedProductIndustryProvider>
          <SimpleTrustFlowSection locale={locale} />
          <CommercialValueSection locale={locale} />
        </ConnectedProductIndustryProvider>
        <CommercialContactModal initialLocale={locale} />
      </main>

      <footer data-nav-inert className="site-footer border-t">
        <div className="container-shell site-footer-primary py-12">
          <div className="site-footer-intro">
            <BrandHomeLink
              ariaLabel={footerCopy.home}
              locale={locale}
              size={42}
              variant="ripple"
              theme="dark"
              brandClassName="hero-brand brand-surface-footer"
              className="site-footer-brand"
            />
            <p className="site-footer-summary text-sm site-muted">{footerCopy.summary}</p>
          </div>
          <nav className="site-footer-columns" aria-label={locale === "en" ? "Footer links" : locale === "pt-BR" ? "Links do rodapé" : "Enlaces del pie de página"}>
            <section>
              <h2>{footerCopy.product}</h2>
              <Link href="#como-funciona">{footerCopy.how}</Link>
              <Link href="/demo-lab">{footerCopy.demoLab}</Link>
              <Link href="/pricing">{footerCopy.plans}</Link>
            </section>
            <section>
              <h2>{footerCopy.company}</h2>
              <Link href="/about">{footerCopy.about}</Link>
              <Link href="/resellers">{footerCopy.resellers}</Link>
              <Link href="/about#respaldo">{footerCopy.institutional}</Link>
            </section>
            <section>
              <h2>{footerCopy.resources}</h2>
              <Link href="/docs">{footerCopy.docs}</Link>
              <Link href="/stack">{footerCopy.architecture}</Link>
              <Link href="/proof/verify">{footerCopy.verify}</Link>
              <Link href="/sdk">SDK</Link>
            </section>
            <section>
              <h2>{footerCopy.contact}</h2>
              <a href="mailto:info@nexid.lat">info@nexid.lat</a>
              <a href="https://api.whatsapp.com/send?phone=5492613168608" target="_blank" rel="noreferrer">WhatsApp Argentina</a>
              <a href="https://api.whatsapp.com/send?phone=56988689095" target="_blank" rel="noreferrer">WhatsApp Chile</a>
              <a href={meetingHref} target="_blank" rel="noreferrer" className="site-footer-demo-link">{footerCopy.schedule}</a>
            </section>
          </nav>
        </div>
        <section className="container-shell site-footer-ecosystem" aria-labelledby="footer-ecosystem-title">
          <h2 id="footer-ecosystem-title">{footerCopy.ecosystemTitle}</h2>
          <div className="site-footer-ecosystem-grid">
            <article>
              <div>
                <strong>Inmovar Latam</strong>
                <p>{footerCopy.inmovarBody}</p>
              </div>
              <nav aria-label="Inmovar Latam">
                <a href="https://www.inmov.ar/" target="_blank" rel="noreferrer"><Globe2 aria-hidden="true" />{footerCopy.website}</a>
                <a href="https://www.instagram.com/inmov.ar/" target="_blank" rel="noreferrer"><Instagram aria-hidden="true" />Instagram</a>
                <a href="https://www.linkedin.com/company/inmovar/" target="_blank" rel="noreferrer"><Linkedin aria-hidden="true" />LinkedIn</a>
                <a href="https://www.facebook.com/inmovar.oficial/" target="_blank" rel="noreferrer"><Facebook aria-hidden="true" />Facebook</a>
              </nav>
            </article>
            <article className="site-footer-about-card">
              <div>
                <strong>nexID</strong>
                <p>{footerCopy.aboutBody}</p>
              </div>
              <nav aria-label={footerCopy.about}>
                <Link href="/about"><Building2 aria-hidden="true" />{footerCopy.about}</Link>
              </nav>
            </article>
          </div>
        </section>
        <div className="container-shell site-footer-meta">
          <span>{footerCopy.ecosystem}</span>
          <Link href="/about">{footerCopy.institutional}</Link>
        </div>
      </footer>
    </div>
  );
}
