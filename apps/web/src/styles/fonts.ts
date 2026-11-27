import localFont from "next/font/local";

export const nexidInterfaceFont = localFont({
  src: "./fonts/instrument-sans/instrument-sans-latin-400-600.woff2",
  variable: "--font-nexid-ui",
  weight: "400 600",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  fallback: ["Arial", "sans-serif"],
});

export const nexidHeadingFont = localFont({
  src: "./fonts/fraunces/fraunces-latin-500.woff2",
  variable: "--font-nexid-heading",
  weight: "500",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const nexidDataFont = localFont({
  src: "./fonts/jetbrains-mono/jetbrains-mono-latin-400.woff2",
  variable: "--font-nexid-mono",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["Courier New", "monospace"],
});

export const nexidFontVariables = [
  nexidInterfaceFont.variable,
  nexidHeadingFont.variable,
  nexidDataFont.variable,
].join(" ");
