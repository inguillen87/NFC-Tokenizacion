"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { BrandLockup, LocaleSwitcher, ThemeToggle, type Theme } from "@product/ui";
import type { AppLocale } from "@product/config";
import {
  getEnterpriseNavigation,
  type EnterpriseNavGroup,
  type EnterpriseNavItem,
} from "./enterprise-navigation.content";
import styles from "./enterprise-site-header.module.css";

type EnterpriseSiteHeaderProps = {
  locale: AppLocale;
  locales: readonly AppLocale[];
  initialTheme: Theme;
  loginHref: string;
};

type MenuLinkProps = {
  item: EnterpriseNavItem;
  currentPath: string;
  featured?: boolean;
  onNavigate?: () => void;
};

function MenuLink({ item, currentPath, featured = false, onNavigate }: MenuLinkProps) {
  const itemPath = item.href.split(/[?#]/)[0] || "/";
  const isCurrent = !item.href.includes("?") && !item.href.includes("#") && currentPath === itemPath;

  return (
    <Link
      href={item.href}
      className={`${styles.menuItem} ${featured ? styles.menuItemFeatured : ""}`}
      data-enterprise-menu-link
      aria-current={isCurrent ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className={styles.menuItemCopy}>
        <span className={styles.menuItemTitle}>
          {item.label}
          {item.badge ? <small>{item.badge}</small> : null}
        </span>
        <span className={styles.menuItemDescription}>{item.description}</span>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

function DesktopGroup({
  group,
  currentPath,
  expanded,
  onOpen,
  onClose,
  buttonRef,
}: {
  group: EnterpriseNavGroup;
  currentPath: string;
  expanded: boolean;
  onOpen: () => void;
  onClose: () => void;
  buttonRef: (element: HTMLButtonElement | null) => void;
}) {
  return (
    <div
      className={styles.navGroup}
      data-enterprise-nav-group={group.id}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.navGroupButton}
        aria-expanded={expanded}
        aria-controls={`enterprise-menu-${group.id}`}
        onClick={expanded ? onClose : onOpen}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          onOpen();
          window.requestAnimationFrame(() => {
            document
              .querySelector<HTMLElement>(`[data-enterprise-nav-group="${group.id}"] [data-enterprise-menu-link]`)
              ?.focus();
          });
        }}
      >
        {group.label}
        <ChevronDown aria-hidden="true" />
      </button>

      {expanded ? (
        <div id={`enterprise-menu-${group.id}`} className={styles.megaMenu}>
          <div className={styles.megaMenuIntro}>
            <span>{group.eyebrow}</span>
            <p>{group.description}</p>
            <MenuLink item={group.featured} currentPath={currentPath} featured onNavigate={onClose} />
          </div>
          <div className={styles.megaMenuGrid}>
            {group.items.map((item) => (
              <MenuLink key={`${group.id}-${item.href}-${item.label}`} item={item} currentPath={currentPath} onNavigate={onClose} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EnterpriseSiteHeader({ locale, locales, initialTheme, loginHref }: EnterpriseSiteHeaderProps) {
  const pathname = usePathname();
  const { header, groups } = getEnterpriseNavigation(locale);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;

    function closeFromOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (document.querySelector(`[data-enterprise-nav-group="${openMenu}"]`)?.contains(target)) return;
      setOpenMenu(null);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const groupId = openMenu;
      if (!groupId) return;
      setOpenMenu(null);
      window.requestAnimationFrame(() => groupButtonRefs.current[groupId]?.focus());
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!mobileOpen) return;

    const pageRoot = document.querySelector<HTMLElement>("main.landing-root");
    const previousOverflow = document.body.style.overflow;
    const previousAriaHidden = pageRoot?.getAttribute("aria-hidden") ?? null;
    const wasInert = pageRoot?.hasAttribute("inert") ?? false;

    document.body.style.overflow = "hidden";
    pageRoot?.setAttribute("inert", "");
    pageRoot?.setAttribute("aria-hidden", "true");
    const focusFrame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus());

    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        mobileDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], summary, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboard);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyboard);
      document.body.style.overflow = previousOverflow;
      if (pageRoot && !wasInert) pageRoot.removeAttribute("inert");
      if (previousAriaHidden === null) pageRoot?.removeAttribute("aria-hidden");
      else pageRoot?.setAttribute("aria-hidden", previousAriaHidden);
      window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
    };
  }, [mobileOpen]);

  const mobileNavigation = mobileOpen ? (
    <div className={styles.mobileOverlay}>
      <button
        type="button"
        className={styles.mobileScrim}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />
      <div ref={mobileDialogRef} className={styles.mobileDialog} role="dialog" aria-modal="true" aria-label={header.navigationLabel}>
        <div className={styles.mobileDialogHead}>
          <Link href="/" aria-label="nexID" onClick={() => setMobileOpen(false)}>
            <BrandLockup size={31} variant="static" theme="light" className={styles.mobileBrand} />
          </Link>
          <button ref={mobileCloseRef} type="button" aria-label={header.closeLabel} onClick={() => setMobileOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.mobileGroups}>
          {groups.map((group, index) => (
            <details key={group.id} open={index === 0} className={styles.mobileGroup}>
              <summary>
                <span>
                  <strong>{group.label}</strong>
                  <small>{group.eyebrow}</small>
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className={styles.mobileGroupItems}>
                {group.items.map((item) => (
                  <MenuLink
                    key={`${group.id}-mobile-${item.href}-${item.label}`}
                    item={item}
                    currentPath={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
                <MenuLink item={group.featured} currentPath={pathname} featured onNavigate={() => setMobileOpen(false)} />
              </div>
            </details>
          ))}
        </div>

        <div className={styles.mobileUtilities}>
          <LocaleSwitcher value={locale} options={[...locales]} />
          <ThemeToggle initialTheme={initialTheme} />
        </div>
        <div className={styles.mobileActions}>
          <Link href="/?contact=demo#contact-modal" onClick={() => setMobileOpen(false)}>{header.demoLabel}</Link>
          <Link href="/?contact=sales&intent=company_rollout#contact-modal" onClick={() => setMobileOpen(false)}>{header.salesLabel}</Link>
          <a href={loginHref}>{header.loginLabel}</a>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <header className={styles.siteHeader} data-enterprise-header>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="nexID" className={styles.brandLink}>
          <BrandLockup size={34} variant="static" theme="light" className={styles.brandLockup} />
        </Link>

        <div className={styles.navigation}>
          <nav className={styles.desktopNav} aria-label={header.navigationLabel}>
            {groups.map((group) => (
              <DesktopGroup
                key={group.id}
                group={group}
                currentPath={pathname}
                expanded={openMenu === group.id}
                onOpen={() => setOpenMenu(group.id)}
                onClose={() => setOpenMenu(null)}
                buttonRef={(element) => {
                  groupButtonRefs.current[group.id] = element;
                }}
              />
            ))}
          </nav>

          <div className={styles.headerUtilities}>
            <div className={styles.desktopUtility}>
              <LocaleSwitcher value={locale} options={[...locales]} />
            </div>
            <div className={styles.desktopUtility}>
              <ThemeToggle initialTheme={initialTheme} />
            </div>
            <Link href="/?contact=demo#contact-modal" className={styles.headerDemo}>{header.demoLabel}</Link>
            <Link href="/?contact=sales&intent=company_rollout#contact-modal" className={styles.headerSales}>{header.salesLabel}</Link>
            <a href={loginHref} className={styles.loginLink}>{header.loginLabel}</a>
            <button
              ref={mobileTriggerRef}
              type="button"
              className={styles.mobileMenuButton}
              aria-label={header.menuLabel}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {mounted && mobileNavigation ? createPortal(mobileNavigation, document.body) : null}
    </header>
  );
}
