import type { BrandTheme, BrandVariant } from "@product/ui";

export type BrandHomeLinkProps = {
  ariaLabel?: string;
  brandClassName?: string;
  className?: string;
  locale?: string;
  markOnly?: boolean;
  onNavigate?: () => void;
  size?: number;
  theme?: BrandTheme;
  variant?: BrandVariant;
};

export function homeLabel(locale?: string) {
  if (locale === "en") return "Go to the nexID home page";
  if (locale === "pt-BR" || locale === "pt") return "Ir para o início da nexID";
  return "Ir al inicio de nexID";
}
