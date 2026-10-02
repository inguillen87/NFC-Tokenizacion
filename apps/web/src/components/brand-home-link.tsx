"use client";

import Link from "next/link";
import { BrandLockup, BrandMark } from "@product/ui";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { homeLabel, type BrandHomeLinkProps } from "./brand-home-link-types";
import { StaticBrandHomeLink } from "./brand-home-link-static";
import styles from "./brand-home-link.module.css";

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

  if (!restoredIdentity) {
    return <StaticBrandHomeLink ariaLabel={ariaLabel} brandClassName={brandClassName} className={className} locale={locale} markOnly={markOnly} onNavigate={onNavigate} size={size} theme={theme} />;
  }

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
    </Link>
  );
}
