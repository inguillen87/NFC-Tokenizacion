import { cookies } from "next/headers";
import { productUrls, schedulingUrls } from "@product/config";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { getWebI18n } from "../lib/locale";
import { BrandHomeLink } from "./brand-home-link";
import { MarketingMegaNav } from "./marketing-mega-nav";
import { PublicRouteContext } from "./public-route-context";

export async function PublicSiteHeader() {
  const { locale, locales } = await getWebI18n();
  const cookieStore = await cookies();
  const initialTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );
  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;
  const skipLabel = locale === "en"
    ? "Skip to content"
    : locale === "pt-BR"
      ? "Ir para o conteúdo"
      : "Ir al contenido";

  return (
    <>
      <a href="#main-content" className="landing-skip-link">{skipLabel}</a>
      <header className="site-header landing-mega-header public-site-header sticky top-0 z-50 border-b">
        <div className="container-shell header-main-row flex items-center justify-between gap-4">
          <BrandHomeLink
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
            meetingHref={schedulingUrls.meeting}
          />
        </div>
      </header>
      <PublicRouteContext locale={locale} />
    </>
  );
}
