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
      <span className="brand-mark__depth" aria-hidden />
      <span className="brand-mark__scan" aria-hidden />
      <svg viewBox="0 0 160 160" className="brand-mark__svg h-full w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="brand-mark-face" x1="20" y1="16" x2="140" y2="144" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="0.42" stopColor="rgba(47,225,195,0.13)" />
            <stop offset="1" stopColor="rgba(14,116,144,0.12)" />
          </linearGradient>
          <linearGradient id="brand-mark-edge" x1="24" y1="22" x2="138" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#67e8f9" stopOpacity="0.74" />
            <stop offset="0.46" stopColor="#2fe1c3" stopOpacity="0.24" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity="0.38" />
          </linearGradient>
          <radialGradient id="brand-mark-core" cx="48%" cy="40%" r="58%">
            <stop offset="0" stopColor="rgba(103,232,249,0.36)" />
            <stop offset="0.62" stopColor="rgba(15,23,42,0.08)" />
            <stop offset="1" stopColor="rgba(2,6,23,0.32)" />
          </radialGradient>
          <filter id="brand-mark-shadow" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#020617" floodOpacity="0.38" />
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#22d3ee" floodOpacity="0.25" />
          </filter>
        </defs>
        <rect x="19" y="19" width="122" height="122" rx="32" fill="url(#brand-mark-core)" filter="url(#brand-mark-shadow)" />
        <rect x="23" y="22" width="115" height="115" rx="29" fill="url(#brand-mark-face)" stroke="url(#brand-mark-edge)" strokeWidth="2" />
        <path d="M42 52H78C84 52 88 56 88 62V98C88 104 84 108 78 108H42" stroke="rgba(103,232,249,0.22)" strokeWidth="2" strokeLinecap="round" />
        <path d="M112 48C128 54 136 66 136 80C136 95 128 107 112 113" stroke="rgba(47,225,195,0.26)" strokeWidth="2" strokeDasharray="5 8" strokeLinecap="round" />
        <circle cx="118" cy="48" r="3" fill={iColor} opacity="0.72" />
        <circle cx="136" cy="80" r="2.7" fill={iColor} opacity="0.5" />
        <circle cx="118" cy="112" r="3" fill={iColor} opacity="0.72" />
        <path className="brand-n-path" d="M47 104V56H58L86 91V56H99V104H88L60 69V104H47Z" fill={nColor} />
        <path className="brand-n-path-stroke" d="M47 104V56H58L86 91V56H99V104H88L60 69V104H47Z" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" />
        <path className="brand-i-path" d="M110 56H123V104H110V56Z" fill={iColor} />
        <path className="brand-i-path-stroke" d="M110 56H123V104H110V56Z" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.1" />
        <path d="M38 39C55 25 84 21 112 32" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
        <path d="M35 121C60 131 98 132 124 115" stroke="rgba(47,225,195,0.18)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="brand-i-head-orbit" />
      <span className="brand-i-stem-origin" />
      <BrandDot size={Math.max(8, size * 0.13)} variant={variant} theme={theme} className="brand-i-head brand-i-head--travel" />
    </span>
  );
}
