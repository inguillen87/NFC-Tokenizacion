import { cookies } from "next/headers";
import { productUrls, schedulingUrls } from "@product/config";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { getWebI18n } from "../lib/locale";
import { MarketingHeaderBrand } from "./marketing-header-brand";
import { MarketingMegaNav } from "./marketing-mega-nav";
import { PublicRouteContext } from "./public-route-context";
import styles from "./public-site-header.module.css";

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
      <a href="#main-content" className={styles.skipLink}>{skipLabel}</a>
      <header className={styles.header}>
        <div className={styles.row}>
          <MarketingHeaderBrand locale={locale} />
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
