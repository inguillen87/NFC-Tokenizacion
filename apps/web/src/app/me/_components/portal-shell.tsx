import { Suspense, type ReactNode } from "react";
import { ThemeToggle } from "@product/ui";
import { BrandHomeLink } from "../../../components/brand-home-link";
import { TapAssociationBanner } from "./tap-association-banner";
import { ConsumerLogoutButton } from "./consumer-logout-button";
import { PortalNavigation } from "./portal-navigation";
import styles from "./portal-shell.module.css";

export function PortalShell({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  // Kept for existing callers. Some pass product totals, not unread notifications.
  notificationCount?: number;
  children: ReactNode;
}) {
  return (
    <div className={`consumer-portal-root ${styles.portal}`}>
      <a className={styles.skipLink} href="#consumer-portal-content">Ir al contenido</a>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.brandArea}>
            <BrandHomeLink size={52} variant="static" className={styles.brand} brandClassName={styles.brandLockup} />
            <span className={styles.portalLabel}>Mi espacio</span>
          </div>
          <div className={styles.accountControls} aria-label="Apariencia y sesión">
            <div className={styles.themeControl}><ThemeToggle locale="es-AR" /></div>
            <div className={styles.logoutControl}><ConsumerLogoutButton /></div>
          </div>
        </div>
        <Suspense fallback={<div className={`consumer-bottom-nav ${styles.navigationPlaceholder}`} aria-label="Cargando navegación" />}>
          <PortalNavigation />
        </Suspense>
      </header>

      <main id="consumer-portal-content" className={styles.main} tabIndex={-1}>
        <header className={styles.pageHeading}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        <div className={styles.content}>
          <Suspense fallback={null}><TapAssociationBanner /></Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
