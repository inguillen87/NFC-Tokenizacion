"use client";

import Link from "next/link";
import { BrandLockup, BrandMark, type BrandTheme, type BrandVariant } from "@product/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./brand-home-link.module.css";

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
  variant = "static",
}: BrandHomeLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [motionActive, setMotionActive] = useState(false);
  const restoredIdentity = variant !== "static";
  const visibleVariant = motionActive ? variant : "static";

  useEffect(() => {
    const link = linkRef.current;
    if (!restoredIdentity || !link) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inViewport = false;
    const update = () => {
      const active = inViewport && !document.hidden && !preference.matches;
      // Freeze existing SVG timelines immediately, before React replaces the
      // animated subtree with the original static artwork.
      if (!active) link.querySelectorAll("svg").forEach((svg) => svg.pauseAnimations?.());
      setMotionActive(active);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      inViewport = entries.some((entry) => entry.target === link && entry.isIntersecting);
      update();
    });
    observer?.observe(link);
    document.addEventListener("visibilitychange", update);
    preference.addEventListener("change", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      preference.removeEventListener("change", update);
    };
  }, [restoredIdentity]);

  useEffect(() => {
    if (!restoredIdentity) return;
    linkRef.current?.querySelectorAll("svg").forEach((svg) => {
      if (motionActive) svg.unpauseAnimations?.();
      else svg.pauseAnimations?.();
    });
  }, [motionActive, restoredIdentity, variant]);

  const linkClassName = [
    styles.homeLink,
    className,
  ].filter(Boolean).join(" ");

  return (
    <Link
      ref={linkRef}
      href="/"
      prefetch={false}
      aria-label={ariaLabel || homeLabel(locale)}
      className={linkClassName}
      data-brand-home-link
      data-brand-motion={restoredIdentity ? variant : undefined}
      data-brand-motion-active={restoredIdentity ? motionActive : undefined}
      onClick={() => onNavigate?.()}
    >
      {restoredIdentity ? (
        <div
          className={styles.originalIdentity}
          style={{ "--identity-size": `${size}px` } as CSSProperties}
          data-identity-theme={theme}
          data-identity-variant={variant}
          aria-hidden="true"
        >
          {markOnly ? (
            <BrandMark key={visibleVariant} size={size} variant={visibleVariant} theme={theme} className={[styles.originalMark, brandClassName].filter(Boolean).join(" ")} />
          ) : (
            <BrandLockup key={visibleVariant} size={size} variant={visibleVariant} theme={theme} className={[styles.originalLockup, brandClassName].filter(Boolean).join(" ")} />
          )}
        </div>
      ) : <span
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
      </span>}
    </Link>
  );
}
