"use client";

import { BrandLockup, LocaleSwitcher, ThemeToggle } from "@product/ui";
import clsx from "clsx";
import { ArrowRight, ChevronDown, LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { getNexidNavigationV4Content } from "./nexid-navigation-v4.content";
import styles from "./nexid-navigation-v4.module.css";
import {
  NEXID_NAVIGATION_V4_CATEGORY_IDS,
  type NexidNavigationV4CategoryId,
  type NexidNavigationV4Link,
  type NexidNavigationV4Props,
} from "./nexid-navigation-v4.types";

const DESKTOP_MEDIA_QUERY = "(min-width: 76rem)";
const DEFAULT_LOCALES = ["es-AR", "en", "pt-BR"] as const;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function emptyCategoryRefRecord<T>(): Record<NexidNavigationV4CategoryId, T | null> {
  return {
    product: null,
    solutions: null,
    demo: null,
    resources: null,
    developers: null,
  };
}

function hrefPathname(href: string): string | null {
  if (!href.startsWith("/") || href.includes("#")) return null;
  return href.split("?")[0] || "/";
}

function linkIsActive(href: string, pathname: string): boolean {
  const linkPathname = hrefPathname(href);
  if (!linkPathname) return false;
  if (linkPathname === "/") return pathname === "/";
  return pathname === linkPathname || pathname.startsWith(`${linkPathname}/`);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0),
  );
}

type NavigationLinkProps = {
  item: NexidNavigationV4Link;
  pathname: string;
  className: string;
  onNavigate?: () => void;
  linkRef?: Ref<HTMLAnchorElement>;
  opensNewWindowLabel: string;
  children: ReactNode;
};

function NavigationLink({
  item,
  pathname,
  className,
  onNavigate,
  linkRef,
  opensNewWindowLabel,
  children,
}: NavigationLinkProps) {
  const active = linkIsActive(item.href, pathname);

  if (item.external) {
    return (
      <a
        ref={linkRef}
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {children}
        <span className={styles.visuallyHidden}> ({opensNewWindowLabel})</span>
      </a>
    );
  }

  return (
    <Link
      ref={linkRef}
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

type LoginLinkProps = {
  href: string;
  className: string;
  onNavigate?: () => void;
  children: ReactNode;
};

function LoginLink({ href, className, onNavigate, children }: LoginLinkProps) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={className} onClick={onNavigate}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

export function NexidNavigationV4({
  locale,
  loginHref,
  initialTheme = "dark",
  locales = DEFAULT_LOCALES,
  className,
}: NexidNavigationV4Props) {
  const content = getNexidNavigationV4Content(locale);
  const pathname = usePathname();
  const instanceId = useId();
  const [mounted, setMounted] = useState(false);
  const [desktopCategory, setDesktopCategory] = useState<NexidNavigationV4CategoryId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategory, setMobileCategory] = useState<NexidNavigationV4CategoryId | null>(null);

  const desktopRootRef = useRef<HTMLElement>(null);
  const desktopTriggerRefs = useRef(emptyCategoryRefRecord<HTMLButtonElement>());
  const desktopFirstLinkRefs = useRef(emptyCategoryRefRecord<HTMLAnchorElement>());
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const restoreMobileFocusRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDesktopCategory(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!desktopCategory) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!desktopRootRef.current?.contains(event.target as Node)) {
        setDesktopCategory(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const trigger = desktopTriggerRefs.current[desktopCategory];
      setDesktopCategory(null);
      trigger?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [desktopCategory]);

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const closeMobileAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    desktopQuery.addEventListener("change", closeMobileAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeMobileAtDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    restoreMobileFocusRef.current = true;
    const panel = mobilePanelRef.current;
    const overlay = mobileOverlayRef.current;
    const previousOverflow = document.body.style.overflow;
    const inertSiblings = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map((element) => ({ element, wasInert: element.inert }));

    document.body.style.overflow = "hidden";
    inertSiblings.forEach(({ element }) => {
      element.inert = true;
    });

    const focusFrame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus());
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      inertSiblings.forEach(({ element, wasInert }) => {
        element.inert = wasInert;
      });
      document.removeEventListener("keydown", handleDialogKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen || !restoreMobileFocusRef.current) return;
    restoreMobileFocusRef.current = false;
    const focusFrame = window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [mobileOpen]);

  const focusDesktopCategory = (index: number) => {
    const categoryId = NEXID_NAVIGATION_V4_CATEGORY_IDS[index];
    desktopTriggerRefs.current[categoryId]?.focus();
  };

  const handleDesktopTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    categoryId: NexidNavigationV4CategoryId,
    index: number,
  ) => {
    const lastIndex = NEXID_NAVIGATION_V4_CATEGORY_IDS.length - 1;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + NEXID_NAVIGATION_V4_CATEGORY_IDS.length) % NEXID_NAVIGATION_V4_CATEGORY_IDS.length;
      const nextCategory = NEXID_NAVIGATION_V4_CATEGORY_IDS[nextIndex];
      focusDesktopCategory(nextIndex);
      if (desktopCategory) setDesktopCategory(nextCategory);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : lastIndex;
      const nextCategory = NEXID_NAVIGATION_V4_CATEGORY_IDS[nextIndex];
      focusDesktopCategory(nextIndex);
      if (desktopCategory) setDesktopCategory(nextCategory);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setDesktopCategory(categoryId);
      window.setTimeout(() => desktopFirstLinkRefs.current[categoryId]?.focus(), 0);
    }
  };

  const handleDesktopBlur = (event: ReactFocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDesktopCategory(null);
    }
  };

  const activeCategory = NEXID_NAVIGATION_V4_CATEGORY_IDS.find((categoryId) => {
    const category = content.categories[categoryId];
    return linkIsActive(category.href, pathname) || category.links.some((link) => linkIsActive(link.href, pathname));
  });

  const desktopNavigation = (
    <div className={styles.desktopCluster}>
      <nav
        ref={desktopRootRef}
        className={styles.desktopNav}
        aria-label={content.aria.primaryNavigation}
        onBlur={handleDesktopBlur}
      >
        <ul className={styles.desktopList}>
          {NEXID_NAVIGATION_V4_CATEGORY_IDS.map((categoryId, index) => {
            const category = content.categories[categoryId];
            const open = desktopCategory === categoryId;
            const active = activeCategory === categoryId;
            const triggerId = `${instanceId}-${categoryId}-trigger`;
            const panelId = `${instanceId}-${categoryId}-panel`;

            return (
              <li key={categoryId} className={styles.desktopItem} data-open={open || undefined}>
                <button
                  ref={(node) => {
                    desktopTriggerRefs.current[categoryId] = node;
                  }}
                  id={triggerId}
                  type="button"
                  className={styles.categoryTrigger}
                  aria-expanded={open}
                  aria-controls={panelId}
                  data-active={active || undefined}
                  onClick={() => setDesktopCategory((current) => (current === categoryId ? null : categoryId))}
                  onFocus={() => {
                    if (desktopCategory && desktopCategory !== categoryId) setDesktopCategory(null);
                  }}
                  onKeyDown={(event) => handleDesktopTriggerKeyDown(event, categoryId, index)}
                >
                  <span>{category.label}</span>
                  <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={1.8} />
                </button>

                {open ? (
                  <div
                    id={panelId}
                    className={styles.desktopPanel}
                    role="group"
                    aria-labelledby={triggerId}
                  >
                    <div className={styles.panelIntro}>
                      <p>{category.summary}</p>
                      <NavigationLink
                        item={{ label: category.overviewLabel, href: category.href }}
                        pathname={pathname}
                        className={styles.overviewLink}
                        opensNewWindowLabel={content.aria.opensNewWindow}
                        onNavigate={() => setDesktopCategory(null)}
                        linkRef={(node) => {
                          desktopFirstLinkRefs.current[categoryId] = node;
                        }}
                      >
                        <span>{category.overviewLabel}</span>
                        <ArrowRight aria-hidden="true" />
                      </NavigationLink>
                    </div>

                    <ul className={styles.panelLinks}>
                      {category.links.map((item) => (
                        <li key={`${categoryId}-${item.href}-${item.label}`}>
                          <NavigationLink
                            item={item}
                            pathname={pathname}
                            className={styles.panelLink}
                            opensNewWindowLabel={content.aria.opensNewWindow}
                            onNavigate={() => setDesktopCategory(null)}
                          >
                            <strong>{item.label}</strong>
                            {item.description ? <span>{item.description}</span> : null}
                          </NavigationLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.desktopUtilities}>
        <div className={styles.preferences} role="group" aria-label={content.aria.preferences}>
          <Suspense fallback={<span className={styles.localeFallback}>{locale}</span>}>
            <LocaleSwitcher value={locale} options={[...locales]} />
          </Suspense>
          <ThemeToggle initialTheme={initialTheme} />
        </div>
        <nav className={styles.desktopActions} aria-label={content.aria.actions}>
          <NavigationLink
            item={content.actions.demo}
            pathname={pathname}
            className={styles.primaryAction}
            opensNewWindowLabel={content.aria.opensNewWindow}
          >
            <span>{content.actions.demo.label}</span>
          </NavigationLink>
          <NavigationLink
            item={content.actions.sales}
            pathname={pathname}
            className={styles.secondaryAction}
            opensNewWindowLabel={content.aria.opensNewWindow}
          >
            <span>{content.actions.sales.label}</span>
          </NavigationLink>
          <LoginLink href={loginHref} className={styles.loginAction}>
            <LogIn aria-hidden="true" />
            <span>{content.actions.loginLabel}</span>
          </LoginLink>
        </nav>
      </div>
    </div>
  );

  const mobileNavigation = mobileOpen ? (
    <div
      ref={mobileOverlayRef}
      id={`${instanceId}-mobile-menu`}
      className={clsx(
        styles.mobileOverlay,
        initialTheme === "light" ? styles.initialLight : styles.initialDark,
      )}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setMobileOpen(false);
      }}
    >
      <div
        ref={mobilePanelRef}
        className={styles.mobilePanel}
        role="dialog"
        aria-modal="true"
        aria-label={content.aria.mobileDialog}
        tabIndex={-1}
      >
        <div className={styles.mobileHeader}>
          <div>
            <p className={styles.mobileEyebrow}>{content.mobileEyebrow}</p>
            <Link
              href="/"
              aria-label={content.aria.home}
              className={styles.mobileBrandLink}
              onClick={() => setMobileOpen(false)}
            >
              <BrandLockup size={30} variant="static" theme={initialTheme} className={styles.mobileBrand} />
            </Link>
          </div>
          <button
            ref={mobileCloseRef}
            type="button"
            className={styles.iconButton}
            aria-label={content.aria.closeMenu}
            onClick={() => setMobileOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.mobilePreferences} role="group" aria-label={content.aria.preferences}>
          <Suspense fallback={<span className={styles.localeFallback}>{locale}</span>}>
            <LocaleSwitcher value={locale} options={[...locales]} />
          </Suspense>
          <ThemeToggle initialTheme={initialTheme} />
        </div>

        <nav className={styles.mobileNav} aria-label={content.aria.mobileNavigation}>
          <ul className={styles.mobileCategoryList}>
            {NEXID_NAVIGATION_V4_CATEGORY_IDS.map((categoryId) => {
              const category = content.categories[categoryId];
              const open = mobileCategory === categoryId;
              const buttonId = `${instanceId}-${categoryId}-mobile-trigger`;
              const panelId = `${instanceId}-${categoryId}-mobile-panel`;

              return (
                <li key={categoryId} className={styles.mobileCategory}>
                  <button
                    id={buttonId}
                    type="button"
                    className={styles.mobileCategoryTrigger}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setMobileCategory((current) => (current === categoryId ? null : categoryId))}
                  >
                    <span>{category.label}</span>
                    <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={1.8} />
                  </button>

                  {open ? (
                    <div
                      id={panelId}
                      className={styles.mobileCategoryPanel}
                      role="region"
                      aria-labelledby={buttonId}
                    >
                      <p>{category.summary}</p>
                      <NavigationLink
                        item={{ label: category.overviewLabel, href: category.href }}
                        pathname={pathname}
                        className={styles.mobileOverviewLink}
                        opensNewWindowLabel={content.aria.opensNewWindow}
                        onNavigate={() => setMobileOpen(false)}
                      >
                        <span>{category.overviewLabel}</span>
                        <ArrowRight aria-hidden="true" />
                      </NavigationLink>
                      <ul>
                        {category.links.map((item) => (
                          <li key={`${categoryId}-${item.href}-${item.label}`}>
                            <NavigationLink
                              item={item}
                              pathname={pathname}
                              className={styles.mobileSubLink}
                              opensNewWindowLabel={content.aria.opensNewWindow}
                              onNavigate={() => setMobileOpen(false)}
                            >
                              <strong>{item.label}</strong>
                              {item.description ? <span>{item.description}</span> : null}
                            </NavigationLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <nav className={styles.mobileActions} aria-label={content.aria.actions}>
          <NavigationLink
            item={content.actions.demo}
            pathname={pathname}
            className={styles.primaryAction}
            opensNewWindowLabel={content.aria.opensNewWindow}
            onNavigate={() => setMobileOpen(false)}
          >
            <span>{content.actions.demo.label}</span>
            <ArrowRight aria-hidden="true" />
          </NavigationLink>
          <NavigationLink
            item={content.actions.sales}
            pathname={pathname}
            className={styles.secondaryAction}
            opensNewWindowLabel={content.aria.opensNewWindow}
            onNavigate={() => setMobileOpen(false)}
          >
            <span>{content.actions.sales.label}</span>
          </NavigationLink>
          <LoginLink href={loginHref} className={styles.loginAction} onNavigate={() => setMobileOpen(false)}>
            <LogIn aria-hidden="true" />
            <span>{content.actions.loginLabel}</span>
          </LoginLink>
        </nav>
      </div>
    </div>
  ) : null;

  return (
    <header
      className={clsx(
        styles.header,
        initialTheme === "light" ? styles.initialLight : styles.initialDark,
        className,
      )}
    >
      <div className={styles.inner}>
        <Link href="/" aria-label={content.aria.home} className={styles.brandLink}>
          <BrandLockup size={34} variant="static" theme={initialTheme} className={styles.brand} />
        </Link>

        {desktopNavigation}

        <div className={styles.mobileControls}>
          <NavigationLink
            item={content.actions.demo}
            pathname={pathname}
            className={styles.compactDemoAction}
            opensNewWindowLabel={content.aria.opensNewWindow}
          >
            <span>{content.actions.demo.label}</span>
          </NavigationLink>
          <button
            ref={mobileTriggerRef}
            type="button"
            className={styles.iconButton}
            aria-label={content.aria.openMenu}
            aria-expanded={mobileOpen}
            aria-controls={`${instanceId}-mobile-menu`}
            onClick={() => {
              setDesktopCategory(null);
              setMobileOpen(true);
            }}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </div>

      {mounted && mobileNavigation ? createPortal(mobileNavigation, document.body) : null}
    </header>
  );
}
