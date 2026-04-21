import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale } from "@product/config";
import { HelpBot } from "@product/ui";
import { MisconfigurationBanner } from "../components/misconfiguration-banner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#f5f8ff" },
  ],
};

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_DASHBOARD_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.nexid.lat"),
    icons: {
      icon: [
        { url: "/favicon.ico", type: "image/x-icon" },
        { url: "/logo-mark.svg", type: "image/svg+xml" },
      ],
      shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    },
    openGraph: {
      title: localizedTitle,
      description: "Multi-tenant operations dashboard",
      images: [{ url: `/og-image?locale=${encodeURIComponent(locale)}`, width: 1200, height: 630, alt: "nexID Dashboard" }],
    },
    twitter: {
      card: "summary_large_image",
      title: localizedTitle,
      description: "Multi-tenant operations dashboard",
      images: [`/twitter-image?locale=${encodeURIComponent(locale)}`],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);

  return (
    <html lang={locale}>
      <body>
        <MisconfigurationBanner />
        {children}
        <HelpBot locale={locale} mode="support" />
      </body>
    </html>
  );
}
