import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClearDetailPage } from "../../../components/marketing-clear/clear-detail-page";
import { ClearSiteFrame } from "../../../components/marketing-clear/clear-site-frame";
import {
  INDUSTRY_SLUGS,
  getIndustry,
} from "../../../components/marketing-clear/marketing-clear.content";
import { getMarketingPageContext } from "../../../components/marketing-clear/marketing-page-context";
import { getMarketingDetailMetadata } from "../../../components/marketing-clear/marketing-metadata";

type IndustryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: IndustryDetailPageProps): Promise<Metadata> {
  const [{ slug }, { locale }] = await Promise.all([params, getMarketingPageContext()]);
  const entry = getIndustry(locale, slug);

  if (!entry) return {};

  return getMarketingDetailMetadata(locale, entry, "industries");
}

export default async function IndustryDetailPage({ params }: IndustryDetailPageProps) {
  const [{ slug }, { locale, locales, initialTheme }] = await Promise.all([
    params,
    getMarketingPageContext(),
  ]);
  const entry = getIndustry(locale, slug);

  if (!entry) notFound();

  return (
    <ClearSiteFrame locale={locale} locales={locales} initialTheme={initialTheme}>
      <ClearDetailPage locale={locale} kind="industries" entry={entry} />
    </ClearSiteFrame>
  );
}
