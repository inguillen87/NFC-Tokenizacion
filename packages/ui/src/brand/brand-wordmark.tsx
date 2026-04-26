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
      <text
        x="0"
        y="78"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        fontSize="72"
        fontWeight="700"
        letterSpacing="-1.5"
        fill={wordColor}
      >
        nex
      </text>
      <text
        x="182"
        y="78"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        fontSize="72"
        fontWeight="700"
        letterSpacing="-1.5"
        fill={accent}
      >
        ID
      </text>
      <ellipse cx="248" cy="41" rx="17" ry="11" fill="none" stroke={orbitColor} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="248" cy="30" r="4.4" fill={accent}>
        {motionEnabled ? (
          <animateMotion
            dur={variant === "ripple" ? "2.2s" : "3.1s"}
            repeatCount="indefinite"
            path="M 248 30 m -17 11 a 17 11 0 1 0 34 0 a 17 11 0 1 0 -34 0"
          />
        ) : null}
      </circle>
    </svg>
  );
}
