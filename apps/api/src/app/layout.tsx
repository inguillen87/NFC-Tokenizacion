import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Identity Gateway API",
  description: "NFC SUN validation and admin operations API",
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat"),
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "nexID API · SUN + Tokenization",
    description: "NFC SUN validation and admin operations API",
    images: [{ url: "/og-image", width: 1200, height: 630, alt: "nexID API" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "nexID API · SUN + Tokenization",
    description: "NFC SUN validation and admin operations API",
    images: ["/twitter-image"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
