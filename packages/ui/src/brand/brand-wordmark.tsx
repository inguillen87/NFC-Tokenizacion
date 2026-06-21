import { cx, type BrandProps } from "./types";

export function BrandWordmark({ size = 120, variant = "static", theme = "dark", className }: BrandProps) {
  const height = Math.max(28, size * 0.26);
  const wordColor = `var(--brand-wordmark-main, ${theme === "dark" ? "#E2E8F0" : "#0F172A"})`;
  const accent = `var(--brand-wordmark-accent, ${theme === "dark" ? "#2FE1C3" : "#0891B2"})`;
  const orbitColor = `var(--brand-wordmark-orbit, ${theme === "dark" ? "rgba(47,225,195,0.5)" : "rgba(8,145,178,0.45)"})`;
  const motionEnabled = variant !== "static";

  return (
    <svg
      viewBox="0 0 520 120"
      role="img"
      aria-label="nexID logo"
      width={size}
      height={height}
      style={{ width: size, height, maxWidth: "100%", overflow: "visible" }}
      className={cx("inline-block object-left brand-wordmark-svg", className)}
    >
      <defs>
        <linearGradient id="brand-word-main" x1="0" y1="20" x2="170" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-wordmark-main-hi, #ffffff)" />
          <stop offset="0.42" stopColor={wordColor} />
          <stop offset="1" stopColor="var(--brand-wordmark-main-lo, #94a3b8)" />
        </linearGradient>
        <linearGradient id="brand-word-accent" x1="174" y1="24" x2="278" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-wordmark-accent-hi, #67e8f9)" />
          <stop offset="0.56" stopColor={accent} />
          <stop offset="1" stopColor="var(--brand-wordmark-accent-lo, #0891b2)" />
        </linearGradient>
        <filter id="brand-word-bevel" x="-10%" y="-25%" width="120%" height="150%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#020617" floodOpacity="0.26" />
        </filter>
      </defs>
      <path className="brand-wordmark-scanline" d="M4 94 H270" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.28" />
      <text className="brand-wordmark-shadow" x="2" y="80" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fontSize="72" fontWeight="780" letterSpacing="0" fill="rgba(2,6,23,0.28)">
        nex
      </text>
      <text className="brand-wordmark-text brand-wordmark-text--main" x="0" y="78" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fontSize="72" fontWeight="780" letterSpacing="0" fill="url(#brand-word-main)" filter="url(#brand-word-bevel)">
        nex
      </text>
      <text className="brand-wordmark-shadow" x="156" y="80" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fontSize="72" fontWeight="820" letterSpacing="0" fill="rgba(2,6,23,0.3)">
        ID
      </text>
      <text className="brand-wordmark-text brand-wordmark-text--accent" x="154" y="78" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fontSize="72" fontWeight="820" letterSpacing="0" fill="url(#brand-word-accent)" filter="url(#brand-word-bevel)">
        ID
      </text>
      <ellipse className="brand-wordmark-orbit" cx="220" cy="41" rx="17" ry="11" fill="none" stroke={orbitColor} strokeWidth="1.5" strokeDasharray="3 3" />
      <g className="brand-wordmark-satellite">
        <circle cx="220" cy="30" r="4.4" fill={accent}>
          {motionEnabled ? (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 220 41`}
              to={`360 220 41`}
              dur={variant === "ripple" ? "2.2s" : "3.1s"}
              repeatCount="indefinite"
            />
          ) : null}
        </circle>
      </g>
    </svg>
  );
}
