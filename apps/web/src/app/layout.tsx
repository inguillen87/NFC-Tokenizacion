import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { resolveLocale, siteConfig } from "@product/config";
import { HelpBot } from "@product/ui";
import { PwaSetup } from "../components/pwa-setup";
import { MisconfigurationBanner } from "../components/misconfiguration-banner";
import { WalletExtensionGuard } from "../components/wallet-extension-guard";

const extensionConsoleShieldScript = `
(() => {
  if (!/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(window.location.hostname)) return;
  if (window.__nexidExtensionShield) return;
  window.__nexidExtensionShield = true;
  const tokens = [
    "fdprocessedid",
    "chrome-extension://",
    "evmask.js",
    "inpage.js",
    "contentscript.js",
    "lockdown-install.js",
    "ses removing unpermitted intrinsics",
    "no matching tab found",
    "polkadot{.js}",
    "[phantom] failed to send message",
    "attempting to use a disconnected port object"
  ];
  const normalize = (value) => {
    if (!value) return "";
    if (value instanceof Error) return String(value.message || "") + " " + String(value.stack || "");
    if (typeof value === "object" && "message" in value) return String(value.message || "");
    return String(value);
  };
  const isNoiseText = (text) => {
    const normalized = String(text || "").toLowerCase();
    return tokens.some((token) => normalized.includes(token)) ||
      (normalized.includes("a tree hydrated") && normalized.includes("fdprocessedid"));
  };
  const isNoiseArgs = (args) => isNoiseText(args.map(normalize).join(" "));
  ["error", "warn"].forEach((name) => {
    const original = console[name];
    if (typeof original !== "function") return;
    console[name] = function(...args) {
      if (isNoiseArgs(args)) return;
      return original.apply(console, args);
    };
  });
  window.addEventListener("error", (event) => {
    const text = [event.message, event.filename, normalize(event.error)].join(" ");
    if (!isNoiseText(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    if (!isNoiseText(normalize(event.reason))) return;
    event.preventDefault();
  });
})();
`;

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
      images: [{ url: `/opengraph-image?locale=${encodeURIComponent(locale)}&surface=home&campaign=default`, width: 1200, height: 630, alt: "nexID" }],
    },
    twitter: {
      card: "summary_large_image",
      title: localizedTitle,
      description: siteConfig.description,
      images: [`/twitter-image?locale=${encodeURIComponent(locale)}&surface=home&campaign=default`],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  const themeCookie = cookieStore.get("theme")?.value;
  const theme = themeCookie === "light" ? "light" : "dark";

  return (
    <html lang={locale} suppressHydrationWarning className={theme === "light" ? "theme-light" : undefined} data-theme={theme}>
      <body>
        {process.env.NODE_ENV !== "production" ? <script dangerouslySetInnerHTML={{ __html: extensionConsoleShieldScript }} /> : null}
        <MisconfigurationBanner />
        <PwaSetup />
        <WalletExtensionGuard />
        {children}
        <HelpBot locale={locale} mode="sales" />
      </body>
    </html>
  );
}
