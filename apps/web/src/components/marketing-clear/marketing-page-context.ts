import { cookies } from "next/headers";
import { getWebI18n } from "../../lib/locale";

export async function getMarketingPageContext() {
  const [{ locale, locales }, cookieStore] = await Promise.all([getWebI18n(), cookies()]);
  const initialTheme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  return { locale, locales, initialTheme } as const;
}
