import { ClearCatalogPage } from "../../components/marketing-clear/clear-catalog-page";
import { ClearSiteFrame } from "../../components/marketing-clear/clear-site-frame";
import { getIndustryCatalog } from "../../components/marketing-clear/marketing-clear.content";
import { getMarketingPageContext } from "../../components/marketing-clear/marketing-page-context";
import { getMarketingOverviewMetadata } from "../../components/marketing-clear/marketing-metadata";

export async function generateMetadata() {
  const { locale } = await getMarketingPageContext();
  return getMarketingOverviewMetadata(locale, "industries");
}

export default async function IndustriesPage() {
  const { locale, locales, initialTheme } = await getMarketingPageContext();

  return (
    <ClearSiteFrame locale={locale} locales={locales} initialTheme={initialTheme}>
      <ClearCatalogPage locale={locale} kind="industries" entries={getIndustryCatalog(locale)} />
    </ClearSiteFrame>
  );
}
