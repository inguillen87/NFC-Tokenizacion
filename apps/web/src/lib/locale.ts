import { cookies, headers } from "next/headers";
import { messages, resolveLocale, locales, type AppLocale } from "@product/config";

function inferLocaleFromHeaders(country: string, acceptLanguage: string): AppLocale {
  const c = country.toUpperCase();
  if (["BR"].includes(c)) return "pt-BR";
  if (["AR", "CL", "UY", "PY", "BO", "PE", "EC", "CO", "VE", "MX", "DO", "PA", "CR", "GT", "HN", "SV", "NI"].includes(c)) {
    return "es-AR";
  }

  const accept = acceptLanguage.toLowerCase();
  if (accept.includes("pt")) return "pt-BR";
  if (accept.includes("es")) return "es-AR";
  return "en";
}

export async function getWebI18n() {
  const cookieStore = await cookies();
  const saved = resolveLocale(cookieStore.get("locale")?.value);

  let locale: AppLocale = saved;
  if (!cookieStore.get("locale")?.value) {
    const h = await headers();
    const country = h.get("x-vercel-ip-country") || h.get("x-country") || "";
    const acceptLanguage = h.get("accept-language") || "";
    locale = inferLocaleFromHeaders(country, acceptLanguage);
  }

  return { locale, locales, t: messages[locale] } as { locale: AppLocale; locales: readonly AppLocale[]; t: (typeof messages)[AppLocale] };
}
