import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nexID — NFC Authentication & Product Identity",
    short_name: "nexID",
    description: "Enterprise-grade NFC authentication, traceability and product identity cloud.",
    start_url: "/?source=pwa",
    id: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#06b6d4",
    lang: "es-AR",
    categories: ["business", "productivity", "security"],
    shortcuts: [
      {
        name: "Docs",
        short_name: "Docs",
        description: "Abrir documentación comercial y técnica.",
        url: "/docs",
      },
      {
        name: "Pricing",
        short_name: "Pricing",
        description: "Abrir pricing y rollout checklist.",
        url: "/pricing",
      },
      {
        name: "Demo Lab",
        short_name: "Demo",
        description: "Ir directo al Demo Lab.",
        url: "/demo-lab",
      },
    ],
    icons: [
      { src: "/nexid-mark-64.png", sizes: "64x64", type: "image/png" },
      { src: "/nexid-mark-128.png", sizes: "128x128", type: "image/png" },
      { src: "/nexid-mark-256.png", sizes: "256x256", type: "image/png" },
      { src: "/nexid-mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/nexid-mark-pulse-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/nexid-mark-pulse-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      {
        src: "/nexid-mark-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        label: "nexID app icon",
        form_factor: "wide",
      },
    ],
  };
}
