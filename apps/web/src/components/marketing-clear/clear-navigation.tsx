"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, ExternalLink, Menu, X } from "lucide-react";
import { LocaleSwitcher, ThemeToggle, type Theme } from "@product/ui";
import type { AppLocale } from "@product/config";
import type { MarketingNavGroup, MarketingNavItem } from "./marketing-clear.content";
import styles from "./marketing-clear.module.css";

type ClearNavigationProps = {
  groups: MarketingNavGroup[];
  locale: AppLocale;
  locales: readonly AppLocale[];
  initialTheme: Theme;
  pricingLabel: string;
  loginLabel: string;
  demoLabel: string;
  menuLabel: string;
  closeLabel: string;
  loginHref: string;
};

function NavLink({ item, currentPath, onNavigate }: { item: MarketingNavItem; currentPath: string; onNavigate?: () => void }) {
  const itemPath = item.href.split(/[?#]/)[0];
  const isCurrent = !item.external && itemPath !== "/" && currentPath === itemPath;
  const content = (
    <>
      <span className={styles.menuItemCopy}>
        <span className={styles.menuItemTitle}>
          {item.label}
          {item.badge ? <small>{item.badge}</small> : null}
        </span>
        <span className={styles.menuItemDescription}>{item.description}</span>
      </span>
      {item.external ? <ExternalLink aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
    </>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={styles.menuItem} data-menu-link onClick={onNavigate}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={styles.menuItem} data-menu-link aria-current={isCurrent ? "page" : undefined} onClick={onNavigate}>
      {content}
    </Link>
  );
}

export function ClearNavigation({
  groups,
  locale,
  locales,
  initialTheme,
  pricingLabel,
  loginLabel,
  demoLabel,
  menuLabel,
  closeLabel,
  loginHref,
}: ClearNavigationProps) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const main = document.querySelector<HTMLElement>("[data-marketing-main]");
    const footer = document.querySelector<HTMLElement>("[data-marketing-footer]");
    const previousMainAria = main?.getAttribute("aria-hidden") ?? null;
    const previousFooterAria = footer?.getAttribute("aria-hidden") ?? null;

    document.body.style.overflow = "hidden";
    main?.setAttribute("inert", "");
    main?.setAttribute("aria-hidden", "true");
    footer?.setAttribute("inert", "");
    footer?.setAttribute("aria-hidden", "true");

    const frame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        mobileDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      if (previousMainAria === null) main?.removeAttribute("aria-hidden");
      else main?.setAttribute("aria-hidden", previousMainAria);
      if (previousFooterAria === null) footer?.removeAttribute("aria-hidden");
      else footer?.setAttribute("aria-hidden", previousFooterAria);
      mobileTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!openMenu) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (document.querySelector(`[data-clear-nav-group="${openMenu}"]`)?.contains(target)) return;
      setOpenMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const groupId = openMenu;
        if (!groupId) return;
        setOpenMenu(null);
        window.requestAnimationFrame(() => groupButtonRefs.current[groupId]?.focus());
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  function openAndFocus(groupId: string) {
    setOpenMenu(groupId);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-clear-nav-group="${groupId}"] [data-menu-link]`)?.focus();
    });
  }

  return (
    <div className={styles.navigation}>
      <nav className={styles.desktopNav} aria-label={locale === "en" ? "Main navigation" : locale === "pt-BR" ? "Navegação principal" : "Navegación principal"}>
        {groups.map((group) => {
          const expanded = openMenu === group.id;
          return (
            <div
              key={group.id}
              className={styles.navGroup}
              data-clear-nav-group={group.id}
              onMouseEnter={() => setOpenMenu(group.id)}
              onMouseLeave={() => setOpenMenu(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenu(null);
              }}
            >
              <button
                ref={(element) => {
                  groupButtonRefs.current[group.id] = element;
                }}
                type="button"
                className={styles.navGroupButton}
                aria-expanded={expanded}
                aria-controls={`clear-menu-${group.id}`}
                onClick={() => setOpenMenu(expanded ? null : group.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    openAndFocus(group.id);
                  }
                }}
              >
                {group.label}
                <ChevronDown aria-hidden="true" />
              </button>

              {expanded ? (
                <div id={`clear-menu-${group.id}`} className={styles.megaMenu}>
                  <div className={styles.megaMenuIntro}>
                    <span>{group.eyebrow}</span>
                    <p>{group.description}</p>
                    <NavLink item={group.featured} currentPath={pathname} onNavigate={() => setOpenMenu(null)} />
                  </div>
                  <div className={styles.megaMenuGrid}>
                    {group.items.map((item) => (
                      <NavLink key={`${group.id}-${item.href}`} item={item} currentPath={pathname} onNavigate={() => setOpenMenu(null)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        <Link href="/pricing" className={styles.navDirectLink} aria-current={pathname === "/pricing" ? "page" : undefined}>{pricingLabel}</Link>
      </nav>

      <div className={styles.headerUtilities}>
        <div className={styles.desktopUtility}>
          <LocaleSwitcher value={locale} options={[...locales]} />
        </div>
        <div className={styles.desktopUtility}>
          <ThemeToggle initialTheme={initialTheme} locale={locale} />
        </div>
        <a href={loginHref} className={styles.loginLink}>{loginLabel}</a>
        <Link href="/?contact=demo#contact-modal" className={styles.headerCta}>{demoLabel}</Link>
        <button
          ref={mobileTriggerRef}
          type="button"
          className={styles.mobileMenuButton}
          aria-label={menuLabel}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
      </div>

      {mobileOpen ? (
        <div className={styles.mobileOverlay}>
          <button type="button" className={styles.mobileScrim} tabIndex={-1} aria-hidden="true" onClick={() => setMobileOpen(false)} />
          <div ref={mobileDialogRef} className={styles.mobileDialog} role="dialog" aria-modal="true" aria-label={menuLabel}>
            <div className={styles.mobileDialogHead}>
              <span>nexID</span>
              <button ref={mobileCloseRef} type="button" aria-label={closeLabel} onClick={() => setMobileOpen(false)}>
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
                      <NavLink key={`${group.id}-mobile-${item.href}`} item={item} currentPath={pathname} onNavigate={() => setMobileOpen(false)} />
                    ))}
                    <NavLink item={group.featured} currentPath={pathname} onNavigate={() => setMobileOpen(false)} />
                  </div>
                </details>
              ))}
            </div>

            <div className={styles.mobileUtilities}>
              <LocaleSwitcher value={locale} options={[...locales]} />
              <ThemeToggle initialTheme={initialTheme} locale={locale} />
            </div>
            <div className={styles.mobileActions}>
              <Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined} onClick={() => setMobileOpen(false)}>{pricingLabel}</Link>
              <a href={loginHref}>{loginLabel}</a>
              <Link href="/?contact=demo#contact-modal" onClick={() => setMobileOpen(false)}>{demoLabel}</Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
