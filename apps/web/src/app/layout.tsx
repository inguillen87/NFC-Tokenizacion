import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale, siteConfig } from "@product/config";
import { HelpBot } from "@product/ui";
import { PwaSetup } from "../components/pwa-setup";
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
      ? "nexID — Tap. Verify. Trust."
      : locale === "pt-BR"
      ? "nexID — Toque. Verifique. Confie."
      : "nexID — Tocá, verificá y vendé con confianza.";

  return {
    title: localizedTitle,
    description: siteConfig.description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nexid.lat"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "nexID",
    },
    formatDetection: {
      telephone: false,
    },
    applicationName: "nexID",
    icons: {
      icon: [
        { url: "/favicon.ico", type: "image/x-icon" },
        { url: "/nexid-favicon.svg", type: "image/svg+xml" },
        { url: "/nexid-mark-64.png", sizes: "64x64", type: "image/png" },
        { url: "/nexid-mark-256.png", sizes: "256x256", type: "image/png" },
      ],
      shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
      apple: [{ url: "/nexid-mark-light-512.png", sizes: "512x512", type: "image/png" }],
    },
    openGraph: {
      title: localizedTitle,
      description: siteConfig.description,
      images: [{ url: "/icon", width: 512, height: 512, alt: "nexID" }],
    },
    twitter: {
      card: "summary_large_image",
      title: localizedTitle,
      description: siteConfig.description,
      images: ["/icon"],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <MisconfigurationBanner />
        <PwaSetup />
        {children}
        <HelpBot locale={locale} mode="sales" />
      </body>
    </html>
  );
}
