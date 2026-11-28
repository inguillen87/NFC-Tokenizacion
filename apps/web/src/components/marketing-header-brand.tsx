"use client";

import { useEffect, useState } from "react";
import { BrandHomeLink } from "./brand-home-link";
import { StaticBrandHomeLink } from "./brand-home-link-static";
import styles from "./public-site-header.module.css";

export function MarketingHeaderBrand({ locale, onNavigate, theme }: { locale: string; onNavigate?: () => void; theme?: "light" | "dark" }) {
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (onNavigate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (sessionStorage.getItem("nexid-brand-intro")) return;
      sessionStorage.setItem("nexid-brand-intro", "1");
      setEntering(true);
    } catch {
      // Private browsing may disable storage. The complete mark is visible from first paint.
    }
  }, [onNavigate]);

  return (
    <span className={styles.brand} data-entering={entering || undefined} onAnimationEnd={() => setEntering(false)}>
      {onNavigate || !theme
        ? <StaticBrandHomeLink locale={locale} size={48} onNavigate={onNavigate} />
        : (
          <>
            <span className={styles.brandWide}><BrandHomeLink locale={locale} size={48} theme={theme} variant="pulse" /></span>
            <span className={styles.brandCompact}><BrandHomeLink locale={locale} size={44} theme={theme} variant="pulse" markOnly /></span>
          </>
        )}
    </span>
  );
}
