import { cookies } from "next/headers";
import { messages, resolveLocale, locales, type AppLocale } from "@product/config";

export async function getWebI18n() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  return { locale, locales, t: messages[locale] } as { locale: AppLocale; locales: readonly AppLocale[]; t: (typeof messages)[AppLocale] };
}
