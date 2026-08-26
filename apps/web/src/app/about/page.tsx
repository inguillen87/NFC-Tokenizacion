import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  FileBadge2,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandLockup } from "@product/ui";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { productUrls, schedulingUrls, type AppLocale } from "@product/config";
import { MarketingMegaNav } from "../../components/marketing-mega-nav";
import { getWebI18n } from "../../lib/locale";
import { buildPublicPageMetadata } from "../../lib/public-page-metadata";
import styles from "./about.module.css";

type AboutCopy = {
  home: string;
  skip: string;
  eyebrow: string;
  title: string;
  lead: string;
  nexidLabel: string;
  nexidTitle: string;
  nexidBody: string;
  inmovarLabel: string;
  inmovarTitle: string;
  inmovarBody: string;
  boundary: string;
  methodEyebrow: string;
  methodTitle: string;
  methodIntro: string;
  method: Array<{ title: string; body: string }>;
  founderEyebrow: string;
  founderRole: string;
  founderBody: string;
  portraitAlt: string;
  instagram: string;
  linkedin: string;
  portfolio: string;
  sourcesEyebrow: string;
  sourcesTitle: string;
  sourcesIntro: string;
  sources: Array<{ title: string; body: string }>;
  closeTitle: string;
  closeBody: string;
  meeting: string;
  docs: string;
};

const copyByLocale: Record<AppLocale, AboutCopy> = {
  "es-AR": {
    home: "Inicio de nexID",
    skip: "Ir al contenido",
    eyebrow: "Quiénes somos",
    title: "Tecnología para que cada producto abra una relación clara y útil.",
    lead:
      "nexID es una plataforma de identidad digital de producto y postventa del ecosistema Inmovar Latam. Conecta un toque NFC o un escaneo QR con la información disponible, los controles configurados y la próxima acción que cada marca habilita.",
    nexidLabel: "La plataforma",
    nexidTitle: "nexID",
    nexidBody:
      "Reúne la experiencia que ve el cliente, las herramientas de operación y las integraciones que necesita una empresa para acompañar cada producto después de la venta.",
    inmovarLabel: "El ecosistema",
    inmovarTitle: "Inmovar Latam",
    inmovarBody:
      "Es el ecosistema tecnológico desde el que se impulsa el desarrollo de nexID y se conectan producto, ingeniería e implementación empresarial.",
    boundary:
      "nexID verifica la etiqueta digital y aplica los controles configurados. Una lectura, por sí sola, no confirma la autenticidad del producto físico.",
    methodEyebrow: "Cómo trabajamos",
    methodTitle: "De una necesidad concreta a un piloto medible.",
    methodIntro:
      "Priorizamos una experiencia simple para las personas y una operación clara para los equipos que la administran.",
    method: [
      { title: "Entender el caso", body: "Definimos el producto, el recorrido del cliente y la acción de postventa que realmente aporta valor." },
      { title: "Delimitar la evidencia", body: "Acordamos qué información está disponible, qué controles se aplican y qué no puede afirmar la lectura digital." },
      { title: "Pilotear y aprender", body: "Lanzamos un alcance controlado, medimos el uso y ajustamos la experiencia antes de escalar." },
    ],
    founderEyebrow: "Fundador",
    founderRole: "Fundador y CEO de nexID · Ingeniero Informático",
    founderBody:
      "Marcelo Guillén lidera nexID como fundador y CEO. Es Ingeniero Informático y fundador de Inmovar Latam. Desde 2013 crea y lidera productos en fintech, SaaS, GovTech, automatización y trazabilidad.",
    portraitAlt: "Retrato institucional de Marcelo Guillén, fundador y CEO de nexID",
    instagram: "Marcelo Guillén en Instagram",
    linkedin: "Marcelo Guillén en LinkedIn",
    portfolio: "Portfolio oficial",
    sourcesEyebrow: "Información pública",
    sourcesTitle: "Conocé el ecosistema y nuestra documentación.",
    sourcesIntro: "Accesos directos para ampliar la información institucional y técnica sin cargar la portada.",
    sources: [
      { title: "Inmovar Latam", body: "Conocé el ecosistema tecnológico en el que nace y se desarrolla nexID." },
      { title: "Datos fiscales", body: "Consultá la inscripción digital pública disponible para validación institucional." },
      { title: "Descargar certificado MiPyME de Marcelo Guillén (PDF)", body: "Descargá el documento público disponible en formato PDF." },
    ],
    closeTitle: "Conversemos sobre un caso real.",
    closeBody: "Podemos revisar el producto, el recorrido de postventa y el alcance de un primer piloto sin sumar complejidad innecesaria.",
    meeting: "Agendar una reunión",
    docs: "Ver documentación",
  },
  "pt-BR": {
    home: "Início da nexID",
    skip: "Ir para o conteúdo",
    eyebrow: "Quem somos",
    title: "Tecnologia para que cada produto abra uma relação clara e útil.",
    lead:
      "A nexID é uma plataforma de identidade digital de produto e pós-venda do ecossistema Inmovar Latam. Ela conecta um toque NFC ou uma leitura QR às informações disponíveis, aos controles configurados e à próxima ação habilitada por cada marca.",
    nexidLabel: "A plataforma",
    nexidTitle: "nexID",
    nexidBody:
      "Reúne a experiência do cliente, as ferramentas de operação e as integrações de que uma empresa precisa para acompanhar cada produto após a venda.",
    inmovarLabel: "O ecossistema",
    inmovarTitle: "Inmovar Latam",
    inmovarBody:
      "É o ecossistema tecnológico que impulsiona o desenvolvimento da nexID e conecta produto, engenharia e implementação empresarial.",
    boundary:
      "A nexID verifica a etiqueta digital e aplica os controles configurados. Uma leitura, sozinha, não confirma a autenticidade do produto físico.",
    methodEyebrow: "Como trabalhamos",
    methodTitle: "De uma necessidade concreta a um piloto mensurável.",
    methodIntro:
      "Priorizamos uma experiência simples para as pessoas e uma operação clara para as equipes que a administram.",
    method: [
      { title: "Entender o caso", body: "Definimos o produto, a jornada do cliente e a ação de pós-venda que realmente entrega valor." },
      { title: "Delimitar a evidência", body: "Acordamos quais informações estão disponíveis, quais controles se aplicam e o que a leitura digital não pode afirmar." },
      { title: "Pilotar e aprender", body: "Lançamos um escopo controlado, medimos o uso e ajustamos a experiência antes de escalar." },
    ],
    founderEyebrow: "Fundador",
    founderRole: "Fundador e CEO da nexID · Engenheiro de Informática",
    founderBody:
      "Marcelo Guillén lidera a nexID como fundador e CEO. É Engenheiro de Informática e fundador da Inmovar Latam. Desde 2013 cria e lidera produtos em fintech, SaaS, GovTech, automação e rastreabilidade.",
    portraitAlt: "Retrato institucional de Marcelo Guillén, fundador e CEO da nexID",
    instagram: "Marcelo Guillén no Instagram",
    linkedin: "Marcelo Guillén no LinkedIn",
    portfolio: "Portfólio oficial",
    sourcesEyebrow: "Informação pública",
    sourcesTitle: "Conheça o ecossistema e nossa documentação.",
    sourcesIntro: "Acessos diretos para ampliar a informação institucional e técnica sem sobrecarregar a página inicial.",
    sources: [
      { title: "Inmovar Latam", body: "Conheça o ecossistema tecnológico no qual a nexID nasceu e se desenvolve." },
      { title: "Dados fiscais", body: "Consulte a inscrição digital pública disponível para validação institucional." },
      { title: "Baixar certificado MiPyME de Marcelo Guillén (PDF)", body: "Baixe o documento público disponível em formato PDF." },
    ],
    closeTitle: "Vamos conversar sobre um caso real.",
    closeBody: "Podemos revisar o produto, a jornada de pós-venda e o escopo de um primeiro piloto sem adicionar complexidade desnecessária.",
    meeting: "Agendar uma reunião",
    docs: "Ver documentação",
  },
  en: {
    home: "nexID home",
    skip: "Skip to content",
    eyebrow: "About us",
    title: "Technology that helps every product open a clear, useful relationship.",
    lead:
      "nexID is a digital product identity and after-sales platform within the Inmovar Latam ecosystem. It connects an NFC tap or QR scan with the available information, configured controls and the next action enabled by each brand.",
    nexidLabel: "The platform",
    nexidTitle: "nexID",
    nexidBody:
      "It brings together the customer experience, operating tools and integrations a company needs to support each product after the sale.",
    inmovarLabel: "The ecosystem",
    inmovarTitle: "Inmovar Latam",
    inmovarBody:
      "It is the technology ecosystem that supports nexID's development and connects product, engineering and enterprise implementation.",
    boundary:
      "nexID verifies the digital tag and applies the configured controls. A reading alone does not confirm the authenticity of the physical product.",
    methodEyebrow: "How we work",
    methodTitle: "From a specific need to a measurable pilot.",
    methodIntro:
      "We prioritize a simple experience for people and a clear operation for the teams managing it.",
    method: [
      { title: "Understand the case", body: "We define the product, customer journey and after-sales action that can deliver meaningful value." },
      { title: "Set the evidence boundary", body: "We agree on the available information, applied controls and what a digital reading cannot claim." },
      { title: "Pilot and learn", body: "We launch a controlled scope, measure usage and refine the experience before scaling." },
    ],
    founderEyebrow: "Founder",
    founderRole: "Founder and CEO of nexID · Computer Engineer",
    founderBody:
      "Marcelo Guillén leads nexID as its founder and CEO. He is a Computer Engineer and the founder of Inmovar Latam. Since 2013, he has created and led products across fintech, SaaS, GovTech, automation and traceability.",
    portraitAlt: "Institutional portrait of Marcelo Guillén, founder and CEO of nexID",
    instagram: "Marcelo Guillén on Instagram",
    linkedin: "Marcelo Guillén on LinkedIn",
    portfolio: "Official portfolio",
    sourcesEyebrow: "Public information",
    sourcesTitle: "Explore the ecosystem and our documentation.",
    sourcesIntro: "Direct paths to institutional and technical information without crowding the home page.",
    sources: [
      { title: "Inmovar Latam", body: "Learn about the technology ecosystem in which nexID was created and is developed." },
      { title: "Tax registration", body: "Open the public digital registration available for institutional review." },
      { title: "Download Marcelo Guillén's MiPyME certificate (PDF)", body: "Download the available public document in PDF format." },
    ],
    closeTitle: "Let's discuss a real use case.",
    closeBody: "We can review the product, the after-sales journey and the scope of a first pilot without adding unnecessary complexity.",
    meeting: "Book a meeting",
    docs: "View documentation",
  },
};

const methodIcons = [ScanLine, ShieldCheck, Sparkles] as const;

function InstagramBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 6.65A5.35 5.35 0 1 1 12 17.35 5.35 5.35 0 0 1 12 6.65Zm0 2A3.35 3.35 0 1 0 12 15.35 3.35 3.35 0 0 0 12 8.65Z"
      />
      <path fill="currentColor" d="M18.72 6.42a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
    </svg>
  );
}

function LinkedinBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9H7.12v11.452ZM20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.047c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286Z"
      />
    </svg>
  );
}

const instagramHref = "https://www.instagram.com/inguillen/";
const linkedinHref = "https://www.linkedin.com/in/marcelo-guill%C3%A9n-54876527/";
const portfolioHrefByLocale: Record<AppLocale, string> = {
  "es-AR": "https://www.inguillen.ar/?lang=es",
  "pt-BR": "https://www.inguillen.ar/?lang=pt",
  en: "https://www.inguillen.ar/?lang=en",
};
const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";
const inmovarHref = process.env.NEXT_PUBLIC_INMOVAR_URL?.trim() || "https://www.inmov.ar/";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return buildPublicPageMetadata("about", locale);
}

export default async function AboutPage() {
  const { locale, locales } = await getWebI18n();
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );
  const copy = copyByLocale[locale];
  const portfolioHref = portfolioHrefByLocale[locale];
  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;
  const meetingHref = schedulingUrls.meeting;
  const sourceLinks = [
    { href: inmovarHref, external: true, download: false, icon: Building2 },
    { href: afipDataFiscalHref, external: true, download: false, icon: ExternalLink },
    { href: mipymeCertificateHref, external: false, download: true, icon: FileBadge2 },
  ] as const;

  return (
    <div className="landing-root about-page">
      <a href="#about-content" className="landing-skip-link">{copy.skip}</a>
      <header className="site-header landing-mega-header sticky top-0 z-50 border-b">
        <div className="container-shell header-main-row flex items-center justify-between gap-4">
          <Link href="/" aria-label={copy.home} className="landing-brand-link inline-flex items-center">
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

      <main id="about-content" data-nav-inert className={styles.page}>
        <div className={styles.shell}>

        <section className={styles.hero} aria-labelledby="about-title">
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 id="about-title">{copy.title}</h1>
            <p className={styles.heroLead}>{copy.lead}</p>

            <div className={styles.relationship}>
              <article>
                <span>{copy.nexidLabel}</span>
                <h2>{copy.nexidTitle}</h2>
                <p>{copy.nexidBody}</p>
              </article>
              <article>
                <span>{copy.inmovarLabel}</span>
                <h2>{copy.inmovarTitle}</h2>
                <p>{copy.inmovarBody}</p>
              </article>
            </div>

            <p className={styles.boundary}>{copy.boundary}</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="about-method-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.methodEyebrow}</p>
              <h2 id="about-method-title">{copy.methodTitle}</h2>
            </div>
            <p className={styles.sectionIntro}>{copy.methodIntro}</p>
          </div>

          <div className={styles.methodGrid}>
            {copy.method.map((item, index) => {
              const Icon = methodIcons[index] ?? Sparkles;
              return (
                <article key={item.title} className={styles.methodCard}>
                  <span className={styles.methodIcon}><Icon aria-hidden="true" /></span>
                  <span className={styles.methodNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.founderSection} aria-labelledby="founder-title">
          <div className={styles.founderGrid}>
            <div className={styles.portrait}>
              <Image
                src="/team/marcelo-guillen.png"
                alt={copy.portraitAlt}
                fill
                sizes="(max-width: 360px) calc(100vw - 3rem), 312px"
                loading="lazy"
              />
            </div>

            <div className={styles.founderCopy}>
              <p className={styles.eyebrow}>{copy.founderEyebrow}</p>
              <h2 id="founder-title">Marcelo Guillén</h2>
              <p className={styles.founderRole}>{copy.founderRole}</p>
              <p>{copy.founderBody}</p>

              <a
                href={portfolioHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.portfolioLink}
              >
                <BriefcaseBusiness aria-hidden="true" />
                {copy.portfolio}
                <ExternalLink aria-hidden="true" />
              </a>

              <nav className={styles.socialLinks} aria-label={`${copy.founderEyebrow}: Marcelo Guillén`}>
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.instagram}
                  className={`${styles.socialLink} ${styles.instagram}`}
                >
                  <InstagramBrandIcon />
                  Instagram
                  <ExternalLink aria-hidden="true" />
                </a>
                <a
                  href={linkedinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.linkedin}
                  className={`${styles.socialLink} ${styles.linkedin}`}
                >
                  <LinkedinBrandIcon />
                  LinkedIn
                  <ExternalLink aria-hidden="true" />
                </a>
              </nav>
            </div>
          </div>
        </section>

        <section id="respaldo" className={styles.section} aria-labelledby="about-sources-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.sourcesEyebrow}</p>
              <h2 id="about-sources-title">{copy.sourcesTitle}</h2>
            </div>
            <p className={styles.sectionIntro}>{copy.sourcesIntro}</p>
          </div>

          <div className={styles.sourceGrid}>
            {copy.sources.map((source, index) => {
              const link = sourceLinks[index];
              const Icon = link.icon;
              return (
                <a
                  key={source.title}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  download={link.download || undefined}
                  className={styles.sourceCard}
                >
                  <div>
                    <strong><Icon aria-hidden="true" />{source.title}</strong>
                    <p>{source.body}</p>
                  </div>
                  <ArrowRight aria-hidden="true" className={styles.sourceArrow} />
                </a>
              );
            })}
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="about-close-title">
          <div>
            <p className={styles.eyebrow}>nexID</p>
            <h2 id="about-close-title">{copy.closeTitle}</h2>
            <p>{copy.closeBody}</p>
          </div>
          <div className={styles.actions}>
            <a href={meetingHref} target="_blank" rel="noopener noreferrer" className={styles.primaryAction}>
              {copy.meeting}
              <ExternalLink aria-hidden="true" />
            </a>
            <Link href="/docs" className={styles.secondaryAction}>
              <BookOpen aria-hidden="true" />
              {copy.docs}
            </Link>
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
