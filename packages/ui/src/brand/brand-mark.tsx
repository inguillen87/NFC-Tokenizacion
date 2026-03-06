"use client";

import { BrandDot } from "./brand-dot";
import { cx, type BrandProps } from "./types";

export function BrandMark({ size = 40, variant = "pulse", theme = "dark", className }: BrandProps) {
  const nColor = theme === "dark" ? "#E2E8F0" : "#0F172A";
  const iColor = theme === "dark" ? "#2FE1C3" : "#0891B2";
  const background = theme === "dark" ? "linear-gradient(145deg,#0b1220,#111b30)" : "linear-gradient(145deg,#f8fafc,#e2e8f0)";

  return (
    <span
      className={cx("relative inline-flex rounded-2xl border", className)}
      style={{
        width: size,
        height: size,
        background,
        borderColor: theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.12)",
      }}
      aria-label="nexID mark"
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" fill="none" aria-hidden>
        <rect x="20" y="20" width="120" height="120" rx="30" fill={theme === "dark" ? "rgba(47,225,195,.10)" : "rgba(8,145,178,.08)"} />
        <path d="M48 102V58H58L85 91V58H96V102H86L59 69V102H48Z" fill={nColor} />
        <path d="M107 58H118V102H107V58Z" fill={iColor} />
      </svg>
      <BrandDot
        size={Math.max(8, size * 0.13)}
        variant={variant}
        theme={theme}
        className="absolute right-[17%] top-[23%]"
      />
    </span>
  );
}
