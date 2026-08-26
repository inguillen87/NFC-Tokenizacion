import type { AppLocale } from "@product/config";
import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://nexid.lat";
const SOCIAL_IMAGE_PATH = "/images/visual_storyboard.jpeg";
const SOCIAL_IMAGE_WIDTH = 1376;
const SOCIAL_IMAGE_HEIGHT = 768;

export type PublicPageKey = "about" | "audiences" | "glossary" | "resellers" | "stack";

type LocalizedMetadataCopy = {
  title: string;
  description: string;
  imageAlt: string;
};

type PublicPageConfig = {
  path: `/${string}`;
  copy: Record<AppLocale, LocalizedMetadataCopy>;
};

const publicPageConfig: Record<PublicPageKey, PublicPageConfig> = {
  about: {
    path: "/about",
    copy: {
      "es-AR": {
        title: "Quiénes somos | nexID e Inmovar Latam",
        description:
          "Conocé nexID, la plataforma de identidad digital de producto y postventa del ecosistema Inmovar Latam, su método de trabajo y a su fundador Marcelo Guillén.",
        imageAlt: "nexID, plataforma del ecosistema tecnológico Inmovar Latam.",
      },
      "pt-BR": {
        title: "Quem somos | nexID e Inmovar Latam",
        description:
          "Conheça a nexID, plataforma de identidade digital de produto e pós-venda do ecossistema Inmovar Latam, seu método de trabalho e o fundador Marcelo Guillén.",
        imageAlt: "nexID, plataforma do ecossistema tecnológico Inmovar Latam.",
      },
      en: {
        title: "About us | nexID and Inmovar Latam",
        description:
          "Meet nexID, the digital product identity and after-sales platform within the Inmovar Latam ecosystem, its working method and founder Marcelo Guillén.",
        imageAlt: "nexID, a platform within the Inmovar Latam technology ecosystem.",
      },
    },
  },
  audiences: {
    path: "/audiences",
    copy: {
      "es-AR": {
        title: "Soluciones de identidad de producto por audiencia | nexID",
        description:
          "Explorá cómo nexID conecta validación de mensajes NFC/SUN, datos declarados, pasaportes y derechos digitales para marcas, integradores, sector público y clientes finales.",
        imageAlt: "Recorrido nexID desde el mensaje NFC/SUN y los datos declarados hasta el pasaporte digital.",
      },
      "pt-BR": {
        title: "Soluções de identidade de produto por público | nexID",
        description:
          "Veja como a nexID conecta validação de mensagens NFC/SUN, dados declarados, passaportes e direitos digitais para marcas, integradores, setor público e consumidores.",
        imageAlt: "Jornada nexID da mensagem NFC/SUN e dos dados declarados ao passaporte digital.",
      },
      en: {
        title: "Product identity solutions by audience | nexID",
        description:
          "See how nexID connects NFC/SUN message validation, declared data, digital passports and digital rights for brands, integrators, public sector teams and end customers.",
        imageAlt: "The nexID journey from NFC/SUN message evidence and declared data to a digital passport.",
      },
    },
  },
  glossary: {
    path: "/glossary",
    copy: {
      "es-AR": {
        title: "Glosario de identidad de producto | nexID",
        description:
          "Guía de lenguaje para explicar evidencia NFC/SUN, pasaportes digitales, trazabilidad declarada y tokenización con claridad en ventas, demos y documentación.",
        imageAlt: "Referencia visual nexID para evidencia NFC/SUN y pasaportes digitales.",
      },
      "pt-BR": {
        title: "Glossário de identidade de produto | nexID",
        description:
          "Guia de linguagem para explicar evidência NFC/SUN, passaportes digitais, rastreabilidade declarada e tokenização em vendas, demos e documentação.",
        imageAlt: "Referência visual nexID para evidência NFC/SUN e passaportes digitais.",
      },
      en: {
        title: "Product identity glossary | nexID",
        description:
          "A practical language guide for explaining NFC/SUN evidence, digital passports, declared traceability and tokenization across sales, demos and documentation.",
        imageAlt: "A nexID visual reference for NFC/SUN evidence and digital passports.",
      },
    },
  },
  resellers: {
    path: "/resellers",
    copy: {
      "es-AR": {
        title: "Programa reseller e integradores | nexID",
        description:
          "Conocé el programa de canal nexID para agencias, distribuidores e integradores: identidad de producto, despliegue white-label y operación recurrente.",
        imageAlt: "Experiencia de canal nexID que conecta mensajes NFC/SUN, referencias declaradas y relación con clientes.",
      },
      "pt-BR": {
        title: "Programa para revendedores e integradores | nexID",
        description:
          "Conheça o programa de canais nexID para agências, distribuidores e integradores: identidade de produto, implantação white-label e operação recorrente.",
        imageAlt: "Experiência de canal nexID conectando mensagens NFC/SUN, referências declaradas e relacionamento com clientes.",
      },
      en: {
        title: "Reseller and integrator program | nexID",
        description:
          "Explore the nexID channel program for agencies, distributors and integrators: product identity, white-label rollout and recurring operations.",
        imageAlt: "The nexID channel experience connecting NFC/SUN messages, declared references and customer engagement.",
      },
    },
  },
  stack: {
    path: "/stack",
    copy: {
      "es-AR": {
        title: "Stack de identidad y confianza de producto | nexID",
        description:
          "Entendé cómo NFC o QR, identidad por unidad, validación, pasaporte digital y derechos programables se conectan en la arquitectura nexID.",
        imageAlt: "Stack nexID desde la validación del mensaje NFC/SUN hasta el pasaporte y los derechos digitales.",
      },
      "pt-BR": {
        title: "Stack de identidade e confiança do produto | nexID",
        description:
          "Entenda como NFC ou QR, identidade por unidade, validação, passaporte digital e direitos programáveis se conectam na arquitetura nexID.",
        imageAlt: "Stack nexID da validação da mensagem NFC/SUN ao passaporte e aos direitos digitais.",
      },
      en: {
        title: "Product identity and trust stack | nexID",
        description:
          "Understand how NFC or QR, unit identity, validation, digital product passports and programmable rights connect in the nexID architecture.",
        imageAlt: "The nexID stack from NFC/SUN message validation to a digital passport and digital rights.",
      },
    },
  },
};

function resolveSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

function toOpenGraphLocale(locale: AppLocale) {
  if (locale === "en") return "en_US";
  if (locale === "pt-BR") return "pt_BR";
  return "es_AR";
}

export function buildPublicPageMetadata(page: PublicPageKey, locale: AppLocale): Metadata {
  const config = publicPageConfig[page];
  const copy = config.copy[locale];
  const siteUrl = resolveSiteUrl();
  const pageUrl = new URL(config.path, siteUrl);
  const imageUrl = new URL(SOCIAL_IMAGE_PATH, siteUrl);
  const openGraphLocale = toOpenGraphLocale(locale);

  return {
    metadataBase: siteUrl,
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: copy.title,
      description: copy.description,
      siteName: "nexID",
      locale: openGraphLocale,
      alternateLocale: ["es_AR", "pt_BR", "en_US"].filter((item) => item !== openGraphLocale),
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: SOCIAL_IMAGE_WIDTH,
          height: SOCIAL_IMAGE_HEIGHT,
          type: "image/jpeg",
          alt: copy.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: SOCIAL_IMAGE_WIDTH,
          height: SOCIAL_IMAGE_HEIGHT,
          type: "image/jpeg",
          alt: copy.imageAlt,
        },
      ],
    },
  };
}
