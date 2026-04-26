import { BrandWordmark } from "./brand-wordmark";
import { cx, type BrandProps } from "./types";

export function BrandLockup({ size = 42, variant = "pulse", theme = "dark", className }: BrandProps) {
  void variant;
  void theme;
  return (
    <div className={cx("brand-lockup inline-flex items-center", className)} aria-label="nexID">
      <BrandWordmark size={Math.max(140, size * 2.8)} variant={variant} theme={theme} />
    </div>
  );
}
