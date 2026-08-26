import { ClearCatalogPage } from "../../components/marketing-clear/clear-catalog-page";
import { ClearSiteFrame } from "../../components/marketing-clear/clear-site-frame";
import { getSolutionCatalog } from "../../components/marketing-clear/marketing-clear.content";
import { getMarketingPageContext } from "../../components/marketing-clear/marketing-page-context";
import { getMarketingOverviewMetadata } from "../../components/marketing-clear/marketing-metadata";

export async function generateMetadata() {
  const { locale } = await getMarketingPageContext();
  return getMarketingOverviewMetadata(locale, "solutions");
}

export default async function SolutionsPage() {
  const { locale, locales, initialTheme } = await getMarketingPageContext();

  return (
    <ClearSiteFrame locale={locale} locales={locales} initialTheme={initialTheme}>
      <ClearCatalogPage locale={locale} kind="solutions" entries={getSolutionCatalog(locale)} />
    </ClearSiteFrame>
  );
}
