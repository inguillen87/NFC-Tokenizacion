import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale } from "@product/config";
import { HelpBot } from "@product/ui";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  const localizedTitle =
    locale === "en"
      ? "nexID Control Center"
      : locale === "pt-BR"
      ? "nexID Centro de Controle"
      : "nexID Centro de Control";

  return {
    title: localizedTitle,
    description: "Multi-tenant operations dashboard",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);

  return (
    <html lang={locale}>
      <body>
        {children}
        <HelpBot locale={locale} mode="support" />
      </body>
    </html>
  );
}
