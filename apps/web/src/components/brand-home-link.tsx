"use client";

import Link from "next/link";
import {
  BrandLockup,
  BrandMark,
  type BrandTheme,
  type BrandVariant,
} from "@product/ui";

type BrandHomeLinkProps = {
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

function homeLabel(locale?: string) {
  if (locale === "en") return "Go to the nexID home page";
  if (locale === "pt-BR" || locale === "pt") return "Ir para o início da nexID";
  return "Ir al inicio de nexID";
}

export function BrandHomeLink({
  ariaLabel,
  brandClassName,
  className,
  locale,
  markOnly = false,
  onNavigate,
  size = 42,
  theme = "dark",
  variant = "ripple",
}: BrandHomeLinkProps) {
  const linkClassName = [
    "inline-flex min-h-11 min-w-11 items-center rounded-2xl outline-none transition focus-visible:ring-4 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    className,
  ].filter(Boolean).join(" ");

  return (
    <Link
      href="/"
      aria-label={ariaLabel || homeLabel(locale)}
      className={linkClassName}
      data-brand-home-link
      onClick={() => onNavigate?.()}
    >
      {markOnly ? (
        <BrandMark size={size} variant={variant} theme={theme} className={brandClassName} />
      ) : (
        <BrandLockup size={size} variant={variant} theme={theme} className={brandClassName} />
      )}
    </Link>
  );
}
