export type BrandVariant = "static" | "pulse" | "ripple";
export type BrandTheme = "dark" | "light";

export type BrandProps = {
  size?: number;
  variant?: BrandVariant;
  theme?: BrandTheme;
  className?: string;
};

export function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
