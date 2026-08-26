import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nexID — NFC Message Evidence & Digital Product Identity",
    short_name: "nexID",
    description: "Enterprise NFC/QR message evidence, declared traceability and governed digital product identity.",
    start_url: "/?source=pwa",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7fbff",
    theme_color: "#ffffff",
    lang: "es-AR",
    categories: ["business", "productivity", "security"],
    shortcuts: [
      {
        name: "SUN Passport",
        short_name: "SUN",
        description: "Abrir la experiencia mobile del tap NFC.",
        url: "/sun",
      },
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
      {
        name: "Cola offline",
        short_name: "Offline",
        description: "Revisar lecturas pendientes de validación online.",
        url: "/offline",
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
  };
}
