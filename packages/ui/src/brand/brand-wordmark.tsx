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
      style={{ width: size, height: height, maxWidth: "100%", objectFit: "contain" }}
      className={cx("inline-block object-left", className)}
    />
  );
}
