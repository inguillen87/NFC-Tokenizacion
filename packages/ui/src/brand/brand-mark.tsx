"use client";

import { BrandDot } from "./brand-dot";
import { cx, type BrandProps } from "./types";

export function BrandMark({ size = 40, variant = "pulse", theme = "dark", className }: BrandProps) {
  const nColor = "currentColor";
  const iColor = "var(--brand-accent, #2FE1C3)";
  const background = `var(--brand-mark-bg, ${theme === "dark" ? "linear-gradient(145deg,#0b1220,#111b30)" : "linear-gradient(145deg,#f8fafc,#e2e8f0)"})`;
  const border = `var(--brand-mark-border, ${theme === "dark" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.12)"})`;

  return (
    <span
      className={cx("brand-mark relative inline-flex rounded-2xl border", className)}
      style={{
        width: size,
        height: size,
        background,
        borderColor: border,
      }}
      aria-label="nexID mark"
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" fill="none" aria-hidden>
                <rect x="20" y="20" width="120" height="120" rx="30" fill="var(--brand-mark-plate, rgba(47,225,195,.10))" />
        <path d="M48 102V58H58L85 91V58H96V102H86L59 69V102H48Z" fill={nColor} />
        <path d="M107 58H118V102H107V58Z" fill={iColor} />
      </svg>
      <span className="brand-i-head-orbit" />
      <BrandDot
        size={Math.max(8, size * 0.13)}
        variant={variant}
        theme={theme}
        className="brand-i-head absolute right-[17%] top-[23%]"
      />
    </span>
  );
}
