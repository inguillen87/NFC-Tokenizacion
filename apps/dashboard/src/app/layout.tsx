import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale, siteConfig } from "@product/config";
import { HelpBot } from "@product/ui";

export const metadata: Metadata = {
  title: `${siteConfig.productName} | Dashboard`,
  description: "Multi-tenant operations dashboard",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);

  return (
    <html lang={locale}>
      <body>{children}<HelpBot locale={locale} mode="support" /></body>
    </html>
  );
}
