import type { Metadata } from "next";
import { siteConfig, type AppLocale } from "@product/config";
import type { MarketingCatalogEntry } from "./marketing-clear.content";
import { getMarketingCopy } from "./marketing-clear.content";

type MarketingKind = "solutions" | "industries";

const socialLocale: Record<AppLocale, string> = {
  "es-AR": "es_AR",
  en: "en_US",
  "pt-BR": "pt_BR",
};

const imageAlt: Record<AppLocale, string> = {
  "es-AR": "nexID - Identidad digital para productos conectados",
  en: "nexID - Digital identity for connected products",
  "pt-BR": "nexID - Identidade digital para produtos conectados",
};

function localizedMetadata(locale: AppLocale, title: string, description: string, canonical: string): Metadata {
  const fullTitle = `${title} | nexID`;
  const openGraphLocale = socialLocale[locale];
  const socialImage = `/social-image?${new URLSearchParams({
    locale,
    surface: "home",
    campaign: "default",
  }).toString()}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: fullTitle,
      description,
      url: canonical,
      siteName: siteConfig.productName,
      locale: openGraphLocale,
      alternateLocale: ["es_AR", "pt_BR", "en_US"].filter((item) => item !== openGraphLocale),
      images: [{ url: socialImage, width: 1200, height: 630, type: "image/png", alt: imageAlt[locale] }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: socialImage, width: 1200, height: 630, type: "image/png", alt: imageAlt[locale] }],
    },
  };
}

export function getMarketingOverviewMetadata(locale: AppLocale, kind: MarketingKind): Metadata {
  const copy = getMarketingCopy(locale);
  const isSolutions = kind === "solutions";
  const title = isSolutions ? copy.nav.solutions[0] : copy.nav.industries[0];
  const description = isSolutions ? copy.catalog.solutionsBody : copy.catalog.industriesBody;

  return localizedMetadata(locale, title, description, `/${kind}`);
}

export function getMarketingDetailMetadata(
  locale: AppLocale,
  entry: MarketingCatalogEntry,
  kind: MarketingKind,
): Metadata {
  return localizedMetadata(locale, entry.title, entry.short, `/${kind}/${entry.slug}`);
}
