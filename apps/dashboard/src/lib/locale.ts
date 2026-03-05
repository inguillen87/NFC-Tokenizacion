import { cookies } from "next/headers";
import { locales, resolveLocale, type AppLocale } from "@product/config";
import { dashboardI18n } from "../i18n";

export async function getDashboardI18n() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  return {
    locale,
    locales,
    copy: dashboardI18n[locale],
  } as {
    locale: AppLocale;
    locales: readonly AppLocale[];
    copy: (typeof dashboardI18n)[AppLocale];
  };
}
