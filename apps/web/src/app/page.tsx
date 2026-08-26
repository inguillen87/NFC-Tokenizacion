import { ClearHome } from "../components/marketing-clear/clear-home";
import { ClearSiteFrame } from "../components/marketing-clear/clear-site-frame";
import { getMarketingPageContext } from "../components/marketing-clear/marketing-page-context";

export default async function HomePage() {
  const { locale, locales, initialTheme } = await getMarketingPageContext();

  return (
    <ClearSiteFrame locale={locale} locales={locales} initialTheme={initialTheme}>
      <ClearHome locale={locale} initialTheme={initialTheme} />
    </ClearSiteFrame>
  );
}
