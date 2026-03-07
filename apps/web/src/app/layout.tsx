import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale, siteConfig } from "@product/config";
import { HelpBot } from "@product/ui";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  const localizedTitle =
    locale === "en"
      ? "nexID — Tap. Verify. Trust."
      : locale === "pt-BR"
      ? "nexID — Toque. Verifique. Confie."
      : "nexID — Tocá, verificá y vendé con confianza.";

  return {
    title: localizedTitle,
    description: siteConfig.description,
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);

  return (
    <html lang={locale}>
      <body>
        {children}
        <HelpBot locale={locale} mode="sales" />
      </body>
    </html>
  );
}
