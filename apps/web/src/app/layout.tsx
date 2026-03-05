import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale, siteConfig } from "@product/config";

export const metadata: Metadata = {
  title: `${siteConfig.productName} | Product landing`,
  description: siteConfig.description,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
