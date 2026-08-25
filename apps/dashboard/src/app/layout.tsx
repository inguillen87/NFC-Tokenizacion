import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { ClerkProvider } from "@clerk/nextjs";
import { resolveLocale } from "@product/config";
import { HelpBot } from "@product/ui";
import { MisconfigurationBanner } from "../components/misconfiguration-banner";
import { PwaSetup } from "../components/pwa-setup";
import { getClerkProxyUrl, getClerkPublishableKey } from "../lib/clerk-env";

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

const staleDashboardRuntimeCleanupScript = `
(() => {
  if (!("serviceWorker" in navigator) || window.__nexidDashboardRuntimeCleanup) return;
  window.__nexidDashboardRuntimeCleanup = true;

  const reloadKey = "nexid-dashboard-runtime-cleared-v7";
  const dashboardCachePrefix = "nexid-dash-";
  const registrationsPromise = navigator.serviceWorker.getRegistrations().catch(() => []);
  const cacheKeysPromise = "caches" in window ? caches.keys().catch(() => []) : Promise.resolve([]);

  Promise.all([registrationsPromise, cacheKeysPromise]).then(async ([registrations, cacheKeys]) => {
    const dashboardCacheKeys = cacheKeys.filter((key) => key.startsWith(dashboardCachePrefix));
    const hadLegacyRuntime = registrations.length > 0 || dashboardCacheKeys.length > 0;
    if (!hadLegacyRuntime) return;

    await Promise.all([
      ...registrations.map((registration) => registration.unregister().catch(() => false)),
      ...dashboardCacheKeys.map((key) => caches.delete(key).catch(() => false)),
    ]);

    if (sessionStorage.getItem(reloadKey) === "1") return;
    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();
  }).catch(() => {
    // Cache cleanup must never block the dashboard.
  });
})();
`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfdfb",
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
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "nexID Control",
    },
    icons: {
      icon: [
        { url: "/logo-mark.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", type: "image/x-icon" },
      ],
      shortcut: [{ url: "/logo-mark.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    },
    openGraph: {
      title: localizedTitle,
      description: "Multi-tenant operations dashboard",
      images: [{ url: `/opengraph-image?locale=${encodeURIComponent(locale)}`, width: 1200, height: 630, alt: "nexID Dashboard" }],
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
  const themeCookie = cookieStore.get("theme")?.value;
  const hasCurrentThemePreference = cookieStore.get("nexid-theme-preference-version")?.value === "light-default-v1";
  const theme = hasCurrentThemePreference && themeCookie === "dark" ? "dark" : "light";
  const clerkKey = getClerkPublishableKey();
  const clerkProxyUrl = getClerkProxyUrl();

  return (
    <html lang={locale} suppressHydrationWarning className={theme === "light" ? "theme-light" : undefined} data-theme={theme}>
      <body suppressHydrationWarning>
        {process.env.NODE_ENV !== "production" ? <script dangerouslySetInnerHTML={{ __html: extensionConsoleShieldScript }} /> : null}
        {process.env.NEXT_PUBLIC_ENABLE_PWA !== "true" ? (
          <script data-nexid-runtime-cleanup="v7" dangerouslySetInnerHTML={{ __html: staleDashboardRuntimeCleanupScript }} />
        ) : null}
        <MisconfigurationBanner />
        <PwaSetup />
        {clerkKey ? (
          <ClerkProvider publishableKey={clerkKey} proxyUrl={clerkProxyUrl || undefined}>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
        <HelpBot locale={locale} mode="support" />
      </body>
    </html>
  );
}
