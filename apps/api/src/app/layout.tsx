import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "nexID API Gateway",
    template: "%s | nexID API",
  },
  description: "SUN validation, tenant operations and Polygon tokenization for verified physical products.",
  applicationName: "nexID API",
  authors: [{ name: "nexID" }],
  creator: "nexID",
  publisher: "nexID",
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat"),
  manifest: "/manifest.webmanifest",
  themeColor: "#020617",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
      { url: "/nexid-favicon.svg", type: "image/svg+xml" },
      { url: "/nexid-mark-32.png", type: "image/png", sizes: "32x32" },
      { url: "/nexid-mark-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icon", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "nexID API",
    title: "nexID API Gateway - SUN + Tokenization",
    description: "Production gateway for NFC SUN validation, anti-replay diagnostics, tenant operations and Polygon Amoy tokenization.",
    images: [{ url: "/og-image", width: 1200, height: 630, alt: "nexID API Gateway" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "nexID API Gateway - SUN + Tokenization",
    description: "SUN validation, tenant operations and Polygon tokenization for verified physical products.",
    images: ["/twitter-image"],
  },
  appleWebApp: {
    capable: true,
    title: "nexID API",
    statusBarStyle: "black-translucent",
  },
  other: {
    "msapplication-TileColor": "#020617",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
