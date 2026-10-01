"use client";

import { Activity, LayoutGrid, MapPin, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSunLocale } from "./sun-locale-provider";

type SunSectionId = "sun-summary" | "agro-dpp" | "sun-origin" | "sun-condition" | "sun-services";

type SunSectionNavItem = {
  id: SunSectionId;
  label: string;
  icon: LucideIcon;
};

export const sunSectionNavItems: readonly SunSectionNavItem[] = [
  { id: "sun-summary", label: "Resumen", icon: LayoutGrid },
  { id: "sun-origin", label: "Origen", icon: MapPin },
  { id: "sun-condition", label: "Estado", icon: Activity },
  { id: "sun-services", label: "Servicios", icon: Sparkles },
] as const;

export const sunAgroSectionNavItems: readonly SunSectionNavItem[] = [
  { id: "agro-dpp", label: "Producto", icon: LayoutGrid },
  { id: "sun-origin", label: "Origen", icon: MapPin },
  { id: "sun-condition", label: "Estado", icon: Activity },
  { id: "sun-services", label: "Servicios", icon: Sparkles },
] as const;

const MOBILE_DOCK_CLEARANCE_PX = 72;

function SunSectionLinks({
  activeSection,
  items,
  mobile = false,
  disabled = false,
  onNavigate,
}: {
  activeSection: SunSectionId;
  items: readonly SunSectionNavItem[];
  mobile?: boolean;
  disabled?: boolean;
  onNavigate: (sectionId: SunSectionId, keyboardNavigation: boolean) => void;
}) {
  const { text } = useSunLocale();
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = activeSection === id;

        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={isActive ? "location" : undefined}
            tabIndex={disabled ? -1 : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
              onNavigate(id, event.detail === 0);
            }}
            className={`group flex min-h-11 min-w-0 items-center justify-center rounded-xl border font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              mobile ? "flex-col gap-1 px-1.5 py-1.5 text-[11px] leading-none" : "gap-1 px-1.5 py-2 text-[11px]"
            } ${
              isActive
                ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-slate-100"
            }`}
          >
            <Icon
              className={`${mobile ? "h-4 w-4" : "h-[18px] w-[18px]"} shrink-0 ${isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{text(label)}</span>
          </a>
        );
      })}
    </div>
  );
}

export function SunSectionNav({ variant = "default" }: { variant?: "default" | "agro" }) {
  const { text } = useSunLocale();
  const items = variant === "agro" ? sunAgroSectionNavItems : sunSectionNavItems;
  const [activeSection, setActiveSection] = useState<SunSectionId>(items[0].id);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [isDockAvoided, setIsDockAvoided] = useState(false);
  const mobileDockRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const focusFrameRef = useRef(0);

  useEffect(() => {
    setActiveSection(items[0].id);
    const desktop = window.matchMedia("(min-width: 1024px)");
    type Bounds = { node: HTMLElement; top: number; bottom: number };
    let sectionNodes: HTMLElement[] = [];
    let avoidNodes: HTMLElement[] = [];
    let sections: Bounds[] = [];
    let avoidBounds: Bounds[] = [];
    const movingAvoidNodes = new Map<Element, Set<string>>();
    let referencesDirty = true;
    let sectionGeometryDirty = true;
    let avoidGeometryDirty = true;
    let dockGeometryDirty = true;
    let dockHeight = 0;
    let dockBottom = 0;
    let lastScrollY = window.scrollY;
    let scrollingDown = false;
    let frameId = 0;
    let idleTimer = 0;

    const scheduleSync = () => {
      if (!frameId) frameId = window.requestAnimationFrame(syncNavigation);
    };
    const resizeObserver = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        if (target === mobileDockRef.current) dockGeometryDirty = true;
        else sectionGeometryDirty = avoidGeometryDirty = true;
      }
      scheduleSync();
    });
    const refreshReferences = () => {
      sectionNodes = items
        .map(({ id }) => document.getElementById(id))
        .filter((node): node is HTMLElement => Boolean(node));
      avoidNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-sun-dock-avoid]"));
      for (const node of movingAvoidNodes.keys()) {
        if (!node.isConnected || !avoidNodes.some((avoid) => node.contains(avoid))) movingAvoidNodes.delete(node);
      }
      resizeObserver.disconnect();
      for (const node of new Set([document.body, ...sectionNodes, ...avoidNodes, mobileDockRef.current])) {
        if (node) resizeObserver.observe(node);
      }
      referencesDirty = false;
      sectionGeometryDirty = avoidGeometryDirty = true;
    };
    const measure = (nodes: HTMLElement[], scrollY: number): Bounds[] => nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width || rect.height ? [{ node, top: rect.top + scrollY, bottom: rect.bottom + scrollY }] : [];
    });

    function syncNavigation() {
      frameId = 0;
      if (referencesDirty) refreshReferences();
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const delta = scrollY - lastScrollY;
      if (delta > 5) scrollingDown = true;
      if (delta < -5) scrollingDown = false;
      lastScrollY = scrollY;

      // Document coordinates survive scrolling. Remeasure only after content/size changes.
      if (sectionGeometryDirty) {
        sections = measure(sectionNodes, scrollY);
        sectionGeometryDirty = false;
      }
      if (!sections.length) {
        setShowMobileNav(false);
        return;
      }
      const marker = scrollY + Math.max(104, viewportHeight * 0.3);
      let nextSection = sections[0].node.id as SunSectionId;
      for (const section of sections) {
        if (section.top <= marker) nextSection = section.node.id as SunSectionId;
        else break;
      }
      const lastSection = sections[sections.length - 1];
      if (lastSection.bottom <= scrollY + viewportHeight + 2) nextSection = lastSection.node.id as SunSectionId;
      setActiveSection((current) => (current === nextSection ? current : nextSection));

      const hasLeftFirstView = scrollY > 24;
      const hasClearedIntro = variant === "agro"
        ? scrollY > 280
        : sections[0].bottom - scrollY < viewportHeight - MOBILE_DOCK_CLEARANCE_PX;
      const eligible = !desktop.matches && hasLeftFirstView && hasClearedIntro;
      setShowMobileNav(eligible);
      setIsScrollingDown(scrollingDown);

      // Hidden or desktop docks need no layout/style reads. Keep invalidations for the next reveal.
      if (!eligible || scrollingDown) return;
      const mobileDock = mobileDockRef.current;
      if (mobileDock && dockGeometryDirty) {
        dockHeight = mobileDock.offsetHeight;
        dockBottom = Number.parseFloat(window.getComputedStyle(mobileDock).bottom) || 0;
        dockGeometryDirty = false;
      }
      if (avoidGeometryDirty) {
        avoidBounds = measure(avoidNodes, scrollY);
        avoidGeometryDirty = false;
      }
      const dockTop = scrollY + viewportHeight - dockBottom - dockHeight;
      setIsDockAvoided(movingAvoidNodes.size > 0 || avoidBounds.some(({ top, bottom }) => top < scrollY + viewportHeight && bottom > dockTop));
    }
    const onScroll = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        scrollingDown = false;
        scheduleSync();
      }, 650);
      scheduleSync();
    };
    const onResize = () => {
      sectionGeometryDirty = avoidGeometryDirty = dockGeometryDirty = true;
      scheduleSync();
    };
    const onContentMotion = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || mobileDockRef.current?.contains(target) || desktopNavRef.current?.contains(target)) return;
      const transition = event.type.startsWith("transition");
      const name = transition ? (event as TransitionEvent).propertyName : (event as AnimationEvent).animationName;
      if (transition && !/^(transform|translate|scale|rotate|top|right|bottom|left|height|width|min-|max-|margin|padding|inset|grid-)/.test(name)) return;
      if (![...sectionNodes, ...avoidNodes].some((node) => target.contains(node))) return;
      const key = `${transition ? "transition" : "animation"}:${name}`;
      if (event.type === "transitionrun" || event.type === "animationstart") {
        if (avoidNodes.some((node) => target.contains(node))) {
          const motions = movingAvoidNodes.get(target) || new Set<string>();
          motions.add(key);
          movingAvoidNodes.set(target, motions);
        }
      } else {
        const motions = movingAvoidNodes.get(target);
        motions?.delete(key);
        if (!motions?.size) movingAvoidNodes.delete(target);
      }
      // Position-only motion does not notify ResizeObserver. Yield until controls settle.
      sectionGeometryDirty = avoidGeometryDirty = true;
      scheduleSync();
    };
    const motionEvents = ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"];
    const mutationObserver = new MutationObserver((records) => {
      const contentRecords = records.filter(({ target }) => {
        const element = target instanceof Element ? target : target.parentElement;
        return element && !mobileDockRef.current?.contains(element) && !desktopNavRef.current?.contains(element);
      });
      if (!contentRecords.length) return;
      sectionGeometryDirty = avoidGeometryDirty = true;
      const trackedSelector = `${items.map(({ id }) => `#${id}`).join(",")},[data-sun-dock-avoid]`;
      for (const record of contentRecords) {
        if (record.type === "childList") {
          if ([...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches(trackedSelector) || node.querySelector(trackedSelector)))) referencesDirty = true;
        } else if (record.attributeName === "id" || record.attributeName === "data-sun-dock-avoid") {
          referencesDirty = true;
        }
        if (record.target === document.documentElement || record.target === document.body) dockGeometryDirty = true;
      }
      scheduleSync();
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["id", "data-sun-dock-avoid", "hidden", "open", "class", "style"] });

    syncNavigation();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("hashchange", scheduleSync);
    window.addEventListener("focusin", scheduleSync);
    window.addEventListener("focusout", scheduleSync);
    desktop.addEventListener("change", onResize);
    for (const event of motionEvents) document.addEventListener(event, onContentMotion);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(focusFrameRef.current);
      window.clearTimeout(idleTimer);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("hashchange", scheduleSync);
      window.removeEventListener("focusin", scheduleSync);
      window.removeEventListener("focusout", scheduleSync);
      desktop.removeEventListener("change", onResize);
      for (const event of motionEvents) document.removeEventListener(event, onContentMotion);
    };
  }, [items, variant]);

  const onNavigate = (sectionId: SunSectionId, keyboardNavigation: boolean) => {
    setActiveSection(sectionId);
    if (!keyboardNavigation) return;
    window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);
      const heading = section?.querySelector<HTMLElement>("h1, h2, h3, [role='heading']") || section;
      if (!heading) return;
      const temporaryTabIndex = !heading.hasAttribute("tabindex");
      if (temporaryTabIndex) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      if (temporaryTabIndex) heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    });
  };
  const isMobileDockVisible = showMobileNav && !isScrollingDown && !isDockAvoided;
  useEffect(() => {
    // React 18 does not serialize the boolean inert attribute; enforce the native property too.
    if (mobileDockRef.current) mobileDockRef.current.inert = !isMobileDockVisible;
  }, [isMobileDockVisible]);

  return (
    <>
      <nav
        ref={desktopNavRef}
        aria-label={text("Secciones del producto")}
        className="sticky top-4 z-20 hidden w-full rounded-2xl border border-white/10 bg-slate-950/80 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:block"
      >
        <SunSectionLinks activeSection={activeSection} items={items} onNavigate={onNavigate} />
      </nav>

      <nav
        ref={mobileDockRef}
        aria-label={text("Secciones del producto")}
        aria-hidden={!isMobileDockVisible}
        inert={!isMobileDockVisible}
        className={`sun-mobile-dock fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 mx-auto max-w-[430px] rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[opacity,transform] duration-200 motion-reduce:transition-none lg:hidden ${
          isMobileDockVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[calc(100%+2rem)] opacity-0"
        }`}
      >
        <SunSectionLinks activeSection={activeSection} items={items} mobile disabled={!isMobileDockVisible} onNavigate={onNavigate} />
      </nav>
    </>
  );
}
