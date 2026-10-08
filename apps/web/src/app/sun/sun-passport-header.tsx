"use client";

import { ThemeToggle } from "../../../../../packages/ui/src/theme-toggle";
import Link from "next/link";
import { homeLabel } from "../../components/brand-home-link-types";
import { SunBrandIdentity } from "./sun-brand-identity";
import { SunLocaleSwitcher, useSunLocale } from "./sun-locale-provider";
import styles from "./sun-passport-header.module.css";

type SunPassportHeaderProps = {
  isQrScan: boolean;
  livePillLabel: string;
  pulseClass: string;
};

export function SunPassportHeader({
  isQrScan,
  livePillLabel,
  pulseClass,
}: SunPassportHeaderProps) {
  const { locale, text } = useSunLocale();
  const passportLabel = text(isQrScan ? "Pasaporte QR" : "Pasaporte NFC");
  const translatedLivePillLabel = text(livePillLabel);

  return (
    <header
      role="group"
      className={`sun-passport-header sun-topbar ${styles.header}`}
      aria-label={text("Controles del pasaporte")}
      data-testid="sun-passport-header"
    >
      <div className={`sun-passport-brand ${styles.brand}`}>
        <Link href="/" prefetch={false} aria-label={homeLabel(locale)} className={styles.homeLink} data-brand-home-link>
          <SunBrandIdentity variant="passport" />
        </Link>
        <span className={`sun-passport-brand__caption ${styles.caption}`}>
          {passportLabel}
        </span>
      </div>

      <div className={`sun-topbar-actions ${styles.utilities}`}>
        <a href="/me" className={styles.accountLink} data-testid="sun-account-link" referrerPolicy="no-referrer">
          {text("Mi cuenta")}
        </a>
        <div className={styles.locale}>
          <SunLocaleSwitcher />
        </div>
        <div className={styles.theme}>
          <ThemeToggle locale={locale} />
        </div>
        <div
          className={`sun-live-tap-pill ${styles.status}`}
          role="status"
          aria-label={`${text("Estado")}: ${translatedLivePillLabel}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pulseClass} ${styles.signal}`} aria-hidden="true" />
          <span>{translatedLivePillLabel}</span>
        </div>
      </div>
    </header>
  );
}
