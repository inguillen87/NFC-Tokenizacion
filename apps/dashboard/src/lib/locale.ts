import { cookies } from "next/headers";
import { locales, messages, resolveLocale, type AppLocale } from "@product/config";

export async function getDashboardI18n() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  return { locale, locales, t: messages[locale] } as { locale: AppLocale; locales: readonly AppLocale[]; t: (typeof messages)[AppLocale] };
}
