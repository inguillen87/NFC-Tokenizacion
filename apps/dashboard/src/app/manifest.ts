import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nexID Control Center — NFC operations and CRM",
    short_name: "nexID Control",
    description: "Multi-tenant NFC operations, source-labelled analytics and tenant CRM console.",
    start_url: "/?source=pwa",
    id: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#020617",
    theme_color: "#06b6d4",
    lang: "es-AR",
    categories: ["business", "productivity", "security"],
    icons: [
      { src: "/nexid-mark-64.png", sizes: "64x64", type: "image/png" },
      { src: "/nexid-mark-128.png", sizes: "128x128", type: "image/png" },
      { src: "/nexid-mark-256.png", sizes: "256x256", type: "image/png" },
      { src: "/nexid-mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/nexid-mark-pulse-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/nexid-mark-pulse-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
