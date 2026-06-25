import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { resolveLocale, siteConfig } from "@product/config";
import { ContextualHelpBot } from "../components/contextual-helpbot";
import { PwaSetup } from "../components/pwa-setup";
import { MisconfigurationBanner } from "../components/misconfiguration-banner";
import { WalletExtensionGuard } from "../components/wallet-extension-guard";

const DEFAULT_SITE_URL = "https://nexid.lat";

const socialCopyByLocale = {
  "es-AR": {
    title: "nexID | Autenticidad NFC para productos premium",
    description:
      "Protegé cada unidad con NFC seguro: autenticidad, trazabilidad, garantía, ownership y ventas post-compra desde un solo toque.",
    imageAlt: "nexID - autenticidad NFC, trazabilidad y producto verificado para marcas premium",
  },
  "pt-BR": {
    title: "nexID | Autenticidade NFC para produtos premium",
    description:
      "Proteja cada unidade com NFC seguro: autenticidade, rastreabilidade, ownership e vendas pós-compra em um toque.",
    imageAlt: "nexID - autenticidade NFC, rastreabilidade e produto verificado para marcas premium",
  },
  en: {
    title: "nexID | NFC authenticity for premium products",
    description:
      "Protect every unit with secure NFC: authenticity, traceability, ownership and post-purchase sales from one tap.",
    imageAlt: "nexID - NFC authenticity, traceability and verified products for premium brands",
  },
} as const;

function getSocialCopy(locale: string) {
  return locale === "en" ? socialCopyByLocale.en : locale === "pt-BR" ? socialCopyByLocale["pt-BR"] : socialCopyByLocale["es-AR"];
}

function toOpenGraphLocale(locale: string) {
  return locale === "en" ? "en_US" : locale === "pt-BR" ? "pt_BR" : "es_AR";
}

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
  const socialCopy = getSocialCopy(locale);
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
  const imageParams = new URLSearchParams({
    locale,
    surface: "home",
    campaign: "default",
  });
  const ogImageUrl = new URL(`/opengraph-image?${imageParams.toString()}`, siteUrl);
  const twitterImageUrl = new URL(`/twitter-image?${imageParams.toString()}`, siteUrl);

  return {
    title: socialCopy.title,
    description: socialCopy.description,
    metadataBase: siteUrl,
    alternates: {
      canonical: siteUrl,
    },
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
      type: "website",
      url: siteUrl,
      title: socialCopy.title,
      description: socialCopy.description,
      siteName: siteConfig.productName,
      locale: toOpenGraphLocale(locale),
      alternateLocale: ["es_AR", "pt_BR", "en_US"].filter((item) => item !== toOpenGraphLocale(locale)),
      images: [
        {
          url: ogImageUrl,
          secureUrl: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: socialCopy.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialCopy.title,
      description: socialCopy.description,
      images: [
        {
          url: twitterImageUrl,
          secureUrl: twitterImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: socialCopy.imageAlt,
        },
      ],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("locale")?.value);
  const themeCookie = cookieStore.get("theme")?.value;
  const theme = themeCookie === "light" ? "light" : "dark";
  const socialCopy = getSocialCopy(locale);
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const content = (
    <>
      <MisconfigurationBanner />
      <PwaSetup />
      <WalletExtensionGuard />
      {children}
      <ContextualHelpBot locale={locale} />
    </>
  );

  return (
    <html lang={locale} suppressHydrationWarning className={theme === "light" ? "theme-light" : undefined} data-theme={theme}>
      <head>
        <meta property="og:image:alt" content={socialCopy.imageAlt} />
        <meta name="twitter:image:alt" content={socialCopy.imageAlt} />
        {facebookAppId ? <meta property="fb:app_id" content={facebookAppId} /> : null}
      </head>
      <body>
        {process.env.NODE_ENV !== "production" ? <script dangerouslySetInnerHTML={{ __html: extensionConsoleShieldScript }} /> : null}
        {clerkKey ? (
          <ClerkProvider publishableKey={clerkKey}>
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
