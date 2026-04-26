import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { cx, type BrandProps } from "./types";

export function BrandLockup({ size = 42, variant = "pulse", theme = "dark", className }: BrandProps) {
  const wordSize = Math.max(110, size * 3.1);
  return (
    <div className={cx("brand-lockup inline-flex items-center gap-3", className)} aria-label="nexID">
      <BrandMark size={size} variant={variant} theme={theme} className="shrink-0" />
      <BrandWordmark size={wordSize} variant={variant} theme={theme} />
    </div>
  );
}
