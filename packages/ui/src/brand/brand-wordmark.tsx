import { cx, type BrandProps } from "./types";

export function BrandWordmark({ size = 120, variant = "static", theme = "dark", className }: BrandProps) {
  void variant;
  void theme;
  const base = "currentColor";
  const accent = "var(--brand-accent, #2FE1C3)";
  const height = size * 0.26;

  return (
    <svg
      viewBox="0 0 320 84"
      width={size}
      height={height}
      className={cx("inline-block", className)}
      role="img"
      aria-label="nexID"
    >
      <text
        x="0"
        y="60"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        fontSize="58"
        fontWeight="700"
        letterSpacing="-1.2"
        fill={base}
      >
        nex<tspan fill={accent}>ID</tspan>
      </text>
    </svg>
  );
}
