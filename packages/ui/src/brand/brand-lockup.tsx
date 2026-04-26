import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { cx, type BrandProps } from "./types";

export function BrandLockup({ size = 42, variant = "pulse", theme = "dark", className }: BrandProps) {
  const wordSize = Math.max(22, size * 0.72);
  return (
    <div className={cx("brand-lockup inline-flex items-center gap-3", className)} aria-label="nexID">
      <BrandMark size={size} variant={variant} theme={theme} className="shrink-0" />
      <span
        className="inline-flex items-baseline leading-none"
        style={{
          fontSize: `${wordSize}px`,
          letterSpacing: "-0.02em",
          fontWeight: 800,
        }}
      >
        <span className="text-current">nex</span>
        <span style={{ color: "var(--brand-accent, #2FE1C3)" }}>ID</span>
      </span>
      <span className="sr-only">
        <BrandWordmark size={Math.max(120, size * 2.4)} variant={variant} theme={theme} />
      </span>
    </div>
  );
}
