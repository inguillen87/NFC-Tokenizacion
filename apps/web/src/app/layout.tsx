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
import { StructuredData } from "../components/structured-data";
import { getClerkPublishableKey } from "../lib/clerk-env";

const DEFAULT_SITE_URL = "https://nexid.lat";

const socialCopyByLocale = {
  "es-AR": {
    title: "nexID | Evidencia NFC/SUN, pasaportes y derechos digitales",
    description:
      "Validá mensajes NFC/SUN, registrá eventos reportados, organizá lote y origen declarados, y activá pasaportes o derechos digitales bajo política. No es una prueba autónoma del objeto físico.",
    imageAlt: "nexID - Evidencia NFC/SUN, datos declarados y pasaportes digitales",
    keywords: ["Validación NFC SUN", "NFC", "Pasaporte Digital", "Cadena de Suministro Empresarial", "Trazabilidad Declarada", "Derechos Digitales", "nexID"]
  },
  "pt-BR": {
    title: "nexID | Evidência NFC/SUN, passaportes e direitos digitais",
    description:
      "Valide mensagens NFC/SUN, registre eventos reportados, organize lote e origem declarados e ative passaportes ou direitos digitais por política. Não é prova autônoma do objeto físico.",
    imageAlt: "nexID - Evidência NFC/SUN, dados declarados e passaportes digitais",
    keywords: ["Validação NFC SUN", "NFC", "Passaporte Digital", "Cadeia de Suprimentos Corporativa", "Rastreabilidade Declarada", "Direitos Digitais", "nexID"]
  },
  en: {
    title: "nexID | NFC/SUN evidence, passports and digital rights",
    description:
      "Validate NFC/SUN messages, record reported events, organize declared batch and origin, and activate digital passports or rights under policy. This is not standalone proof of the physical object.",
    imageAlt: "nexID - NFC/SUN evidence, declared data and digital passports",
    keywords: ["NFC SUN Validation", "NFC", "Digital Product Passport", "Enterprise Supply Chain", "Declared Traceability", "Digital Rights", "nexID"]
  }
};

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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
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
    keywords: socialCopy.keywords,
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
  const theme = themeCookie === "dark" ? "dark" : "light";
  const socialCopy = getSocialCopy(locale);
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
  const clerkKey = getClerkPublishableKey();
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
        <StructuredData />
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
