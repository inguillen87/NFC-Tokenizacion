"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, Gift, Home, Leaf, MoreHorizontal, PackageCheck, Radio, ShieldCheck, Sparkles, Store, Users, WalletCards, Wine, X } from "lucide-react";
import styles from "./portal-shell.module.css";

export const PORTAL_PRIMARY_DESTINATIONS = [
  { href: "/me", label: "Inicio", icon: Home },
  { href: "/me/products", label: "Productos", icon: PackageCheck },
  { href: "/me/taps", label: "Historial", icon: Radio },
  { href: "/me/rewards", label: "Beneficios", icon: Gift },
] as const;

export const PORTAL_MORE_DESTINATIONS = [
  { href: "/me/passport", label: "Mi pasaporte", detail: "Cuenta y registros digitales", icon: BookOpen },
  { href: "/me/brands", label: "Marcas", detail: "Marcas asociadas y sus novedades", icon: Users },
  { href: "/me/marketplace", label: "Catálogo", detail: "Productos y opciones disponibles", icon: Store },
  { href: "/me/wallet", label: "Billetera digital", detail: "Activos y registros de tu cuenta", icon: WalletCards },
  { href: "/me/experiences", label: "Experiencias", detail: "Experiencias disponibles para tu cuenta", icon: Sparkles },
  { href: "/me/sommelier", label: "Asistente de vinos", detail: "Orientación general sobre vinos", icon: Wine },
  { href: "/me/cork-analyzer", label: "Analizar corcho", detail: "Herramienta de revisión visual", icon: Leaf },
  { href: "/me/privacy", label: "Privacidad", detail: "Datos y consentimiento", icon: ShieldCheck },
  { href: "/me/security", label: "Seguridad", detail: "Protección de tu cuenta", icon: ShieldCheck },
] as const;

export function isPortalDestinationActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === href || (href !== "/me" && normalized.startsWith(`${href}/`));
}

export function PortalNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousPathname = useRef(pathname);
  const dialogId = useId();
  const headingId = useId();
  const currentMore = PORTAL_MORE_DESTINATIONS.find((item) => isPortalDestinationActive(pathname, item.href));

  const closeMenu = useCallback(() => {
    dialogRef.current?.close();
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      if (dialogRef.current?.open) closeMenu();
    }
  }, [pathname, closeMenu]);

  function openMenu() {
    if (!dialogRef.current || dialogRef.current.open) return;
    dialogRef.current.showModal();
    setMenuOpen(true);
  }

  return (
    <>
      <nav className={`consumer-bottom-nav ${styles.navigation}`} aria-label="Navegación del portal">
        <div className={styles.navigationItems}>
          {PORTAL_PRIMARY_DESTINATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={styles.navigationItem} aria-current={isPortalDestinationActive(pathname, item.href) ? "page" : undefined}>
                <Icon aria-hidden="true" /><span>{item.label}</span>
              </Link>
            );
          })}
          <button ref={triggerRef} type="button" className={styles.navigationItem} data-active={Boolean(currentMore)} aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls={dialogId} onClick={openMenu}>
            <MoreHorizontal aria-hidden="true" /><span>Más</span>
            {currentMore ? <span className={styles.srOnly}>Sección actual: {currentMore.label}</span> : null}
          </button>
        </div>
      </nav>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.moreDialog}
        aria-labelledby={headingId}
        onCancel={(event) => { event.preventDefault(); closeMenu(); }}
        onClose={() => { setMenuOpen(false); triggerRef.current?.focus(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
        }}
      >
        <div className={styles.dialogHeading}>
          <div><h2 id={headingId}>Más opciones</h2><p>Tu cuenta y otras herramientas.</p></div>
          <button type="button" className={styles.closeButton} onClick={closeMenu} aria-label="Cerrar más opciones" autoFocus><X aria-hidden="true" /></button>
        </div>
        <nav className={styles.moreLinks} aria-label="Todas las demás secciones del portal">
          {PORTAL_MORE_DESTINATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={styles.moreLink} onClick={closeMenu} aria-current={isPortalDestinationActive(pathname, item.href) ? "page" : undefined}>
                <Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </Link>
            );
          })}
        </nav>
      </dialog>
    </>
  );
}
