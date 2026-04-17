import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Identity Gateway API",
  description: "NFC SUN validation and admin operations API",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/logo-mark.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
