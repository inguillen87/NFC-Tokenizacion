import type { Metadata } from "next";
import { productUrls } from "@product/config";
import { ConnectedProductIndustryProvider } from "../../components/connected-product-industry-context";
import { AudienceSection, ControlCenterSection, ReadingOutcomesSection } from "../../components/home-extra-sections";
import { CommercialValueSection, SimpleTrustFlowSection } from "../../components/home-sections";
import homeStyles from "../../components/home-sections.module.css";
import { LandingMotion } from "../../components/landing-motion";
import { PublicSiteHeader } from "../../components/public-site-header";
import { getWebI18n } from "../../lib/locale";

const metadataByLocale = {
  "es-AR": {
    title: "Cómo funciona la plataforma | nexID",
    description: "El recorrido completo de nexID: del producto a su pasaporte por rubro, qué muestra cada lectura, qué ve cada participante y cómo lo configura la marca.",
  },
  "pt-BR": {
    title: "Como a plataforma funciona | nexID",
    description: "O percurso completo da nexID: do produto ao passaporte por setor, o que cada leitura mostra, o que cada participante vê e como a marca configura.",
  },
  en: {
    title: "How the platform works | nexID",
    description: "The complete nexID journey: from product to passport by industry, what each reading shows, what every participant sees and how the brand sets it up.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  const copy = metadataByLocale[locale];
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: "/platform" },
    openGraph: { title: copy.title, description: copy.description, url: "/platform" },
  };
}

// The detailed explanation that the short home links to.
export default async function PlatformPage() {
  const { locale } = await getWebI18n();
  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;

  return (
    <>
      <PublicSiteHeader />
      <main id="main-content" tabIndex={-1} data-nav-inert className={`landing-root ${homeStyles.landing}`}>
        <LandingMotion />
        <ConnectedProductIndustryProvider>
          <SimpleTrustFlowSection locale={locale} />
          <ReadingOutcomesSection locale={locale} />
          <CommercialValueSection locale={locale} />
          <ControlCenterSection locale={locale} />
        </ConnectedProductIndustryProvider>
        <AudienceSection locale={locale} loginHref={loginHref} />
      </main>
    </>
  );
}
