"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { homeLabel, type BrandHomeLinkProps } from "./brand-home-link-types";
import styles from "./brand-home-link.module.css";

type StaticBrandHomeLinkProps = Omit<BrandHomeLinkProps, "variant"> & { variant?: "static" };

export function StaticBrandHomeLink({
  ariaLabel,
  brandClassName,
  className,
  locale,
  markOnly = false,
  onNavigate,
  size = 42,
  theme = "dark",
  variant = "static",
}: StaticBrandHomeLinkProps) {
  return (
    <Link
      href="/"
      prefetch={false}
      aria-label={ariaLabel || homeLabel(locale)}
      className={[styles.homeLink, className].filter(Boolean).join(" ")}
      data-brand-home-link
      onClick={() => onNavigate?.()}
    >
      <span
        className={[styles.identity, brandClassName].filter(Boolean).join(" ")}
        style={{ "--identity-size": `${size}px` } as CSSProperties}
        data-identity-theme={theme}
        data-identity-variant={variant}
        aria-hidden="true"
      >
        <svg viewBox="0 0 160 160" fill="none" className={styles.mark} focusable="false">
          <rect x="1" y="1" width="158" height="158" rx="40" fill="currentColor" />
          <path d="M37 111V49H52L86 90V49H102V111H87L53 70V111H37Z" fill="var(--identity-face)" />
          <path d="M115 62H131V111H115V62Z" fill="var(--identity-accent)" />
          <circle cx="123" cy="45" r="8" fill="var(--identity-accent)" />
        </svg>
        {!markOnly && <span className={styles.word}>nex<span>ID</span></span>}
      </span>
    </Link>
  );
}
