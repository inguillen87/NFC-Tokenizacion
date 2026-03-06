import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { cx, type BrandProps } from "./types";

export function BrandLockup({ size = 42, variant = "pulse", theme = "dark", className }: BrandProps) {
  return (
    <div className={cx("inline-flex items-center gap-3", className)} aria-label="nexID">
      <BrandMark size={size} variant={variant} theme={theme} />
      <BrandWordmark size={Math.max(106, size * 3.2)} variant={variant} theme={theme} />
    </div>
  );
}
