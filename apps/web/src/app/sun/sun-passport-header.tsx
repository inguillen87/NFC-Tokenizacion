"use client";

import { BrandLockup, ThemeToggle } from "@product/ui";
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
      className={`sun-passport-header sun-topbar ${styles.header}`}
      aria-label={text("Controles del pasaporte")}
      data-testid="sun-passport-header"
    >
      <div className={`sun-passport-brand ${styles.brand}`}>
        <BrandLockup size={52} variant="ripple" theme="dark" />
        <span className={`sun-passport-brand__caption ${styles.caption}`}>
          {passportLabel}
        </span>
      </div>

      <div className={styles.theme}>
        <ThemeToggle locale={locale} />
      </div>

      <div className={`sun-topbar-actions ${styles.utilities}`}>
        <div
          className={`sun-live-tap-pill ${styles.status}`}
          role="status"
          aria-label={`${text("Estado")}: ${translatedLivePillLabel}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pulseClass} animate-pulse motion-reduce:animate-none`} aria-hidden="true" />
          <span>{translatedLivePillLabel}</span>
        </div>
        <div className={styles.locale}>
          <SunLocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
