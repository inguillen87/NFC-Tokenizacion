import { cx, type BrandProps } from "./types";

export function BrandWordmark({ size = 120, variant = "static", theme = "dark", className }: BrandProps) {
  void variant;
  void theme;

  const height = size * 0.26;

  return (
    <img
      src="/logopro.png"
      alt="nexID Logo"
      width={size}
      height={height}
      className={cx("inline-block object-contain object-left", className)}
    />
  );
}
