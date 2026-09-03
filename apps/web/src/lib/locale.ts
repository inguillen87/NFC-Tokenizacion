import { cookies, headers } from "next/headers";
import { messages, locales, type AppLocale } from "@product/config";

function requestedLocale(value?: string | null): AppLocale | null {
  const normalized = String(value || "").trim();
  return locales.includes(normalized as AppLocale) ? normalized as AppLocale : null;
}

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

export async function getWebI18n(queryLocale?: string | null) {
  const cookieStore = await cookies();
  const query = requestedLocale(queryLocale);
  const cookieValue = cookieStore.get("locale")?.value;
  const saved = requestedLocale(cookieValue);

  let locale: AppLocale;
  if (query) {
    locale = query;
  } else if (saved) {
    locale = saved;
  } else {
    const h = await headers();
    const country = h.get("x-vercel-ip-country") || h.get("x-country") || "";
    const acceptLanguage = h.get("accept-language") || "";
    locale = inferLocaleFromHeaders(country, acceptLanguage);
  }

  return { locale, locales, t: messages[locale] } as { locale: AppLocale; locales: readonly AppLocale[]; t: (typeof messages)[AppLocale] };
}
