import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClearDetailPage } from "../../../components/marketing-clear/clear-detail-page";
import { ClearSiteFrame } from "../../../components/marketing-clear/clear-site-frame";
import {
  SOLUTION_SLUGS,
  getSolution,
} from "../../../components/marketing-clear/marketing-clear.content";
import { getMarketingPageContext } from "../../../components/marketing-clear/marketing-page-context";
import { getMarketingDetailMetadata } from "../../../components/marketing-clear/marketing-metadata";

type SolutionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SolutionDetailPageProps): Promise<Metadata> {
  const [{ slug }, { locale }] = await Promise.all([params, getMarketingPageContext()]);
  const entry = getSolution(locale, slug);

  if (!entry) return {};

  return getMarketingDetailMetadata(locale, entry, "solutions");
}

export default async function SolutionDetailPage({ params }: SolutionDetailPageProps) {
  const [{ slug }, { locale, locales, initialTheme }] = await Promise.all([
    params,
    getMarketingPageContext(),
  ]);
  const entry = getSolution(locale, slug);

  if (!entry) notFound();

  return (
    <ClearSiteFrame locale={locale} locales={locales} initialTheme={initialTheme}>
      <ClearDetailPage locale={locale} kind="solutions" entry={entry} />
    </ClearSiteFrame>
  );
}
