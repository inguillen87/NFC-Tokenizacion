import { productUrls } from "@product/config";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CommercialContactModal } from "../components/commercial-contact-modal";
import { NexidHomeV4 } from "../components/marketing-v4";
import { getWebI18n } from "../lib/locale";

export default async function HomePage() {
  const { locale, locales } = await getWebI18n();
  const cookieStore = await cookies();
  const hasCurrentThemePreference = cookieStore.get("nexid-theme-preference-version")?.value === "light-default-v1";
  const initialTheme = hasCurrentThemePreference && cookieStore.get("theme")?.value === "dark" ? "dark" : "light";
  const loginHref = `${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`;

  return (
    <>
      <NexidHomeV4
        locale={locale}
        locales={locales}
        loginHref={loginHref}
        initialTheme={initialTheme}
      />
      <Suspense fallback={null}>
        <CommercialContactModal initialLocale={locale} />
      </Suspense>
    </>
  );
}
