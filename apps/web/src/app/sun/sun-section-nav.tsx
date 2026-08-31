"use client";

import { Activity, LayoutGrid, MapPin, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  onNavigate: (sectionId: SunSectionId) => void;
}) {
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
            onClick={() => onNavigate(id)}
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
            <span className="whitespace-nowrap">{label}</span>
          </a>
        );
      })}
    </div>
  );
}

export function SunSectionNav({ variant = "default" }: { variant?: "default" | "agro" }) {
  const items = variant === "agro" ? sunAgroSectionNavItems : sunSectionNavItems;
  const [activeSection, setActiveSection] = useState<SunSectionId>(items[0].id);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [isDockAvoided, setIsDockAvoided] = useState(false);
  const mobileDockRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setActiveSection(items[0].id);
    const sectionNodes = items
      .map(({ id }) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (!sectionNodes.length) return;

    let frameId = 0;
    const syncActiveSection = () => {
      const marker = Math.max(104, window.innerHeight * 0.3);
      let nextSection = sectionNodes[0].id as SunSectionId;
      const summaryBottom = sectionNodes[0].getBoundingClientRect().bottom;
      const hasLeftFirstView = window.scrollY > 24;
      const hasClearedIntro = variant === "agro"
        ? window.scrollY > 280
        : summaryBottom < window.innerHeight - MOBILE_DOCK_CLEARANCE_PX;

      for (const node of sectionNodes) {
        if (node.getBoundingClientRect().top <= marker) nextSection = node.id as SunSectionId;
        else break;
      }

      const lastSection = sectionNodes[sectionNodes.length - 1];
      if (lastSection.getBoundingClientRect().bottom <= window.innerHeight + 2) {
        nextSection = lastSection.id as SunSectionId;
      }

      setActiveSection((current) => (current === nextSection ? current : nextSection));
      setShowMobileNav(hasLeftFirstView && hasClearedIntro);
    };
    const scheduleSync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncActiveSection);
    };

    syncActiveSection();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("hashchange", scheduleSync);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("hashchange", scheduleSync);
    };
  }, [items]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let frameId = 0;
    let idleTimer = 0;

    const syncDockVisibility = () => {
      const nextScrollY = window.scrollY;
      const delta = nextScrollY - lastScrollY;
      if (delta > 5) setIsScrollingDown(true);
      if (delta < -5) setIsScrollingDown(false);
      lastScrollY = nextScrollY;

      const mobileDock = mobileDockRef.current;
      const dockHeight = mobileDock?.offsetHeight || 0;
      const dockBottom = mobileDock
        ? Number.parseFloat(window.getComputedStyle(mobileDock).bottom) || 0
        : 0;
      const dockTop = window.innerHeight - dockBottom - dockHeight;
      const avoidNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-sun-dock-avoid]"));
      const nextAvoided = avoidNodes.some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > dockTop;
      });
      setIsDockAvoided(nextAvoided);

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setIsScrollingDown(false), 650);
    };

    const scheduleDockSync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncDockVisibility);
    };

    syncDockVisibility();
    window.addEventListener("scroll", scheduleDockSync, { passive: true });
    window.addEventListener("resize", scheduleDockSync);
    window.addEventListener("focusin", scheduleDockSync);
    window.addEventListener("focusout", scheduleDockSync);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(idleTimer);
      window.removeEventListener("scroll", scheduleDockSync);
      window.removeEventListener("resize", scheduleDockSync);
      window.removeEventListener("focusin", scheduleDockSync);
      window.removeEventListener("focusout", scheduleDockSync);
    };
  }, []);

  const onNavigate = (sectionId: SunSectionId) => setActiveSection(sectionId);
  const isMobileDockVisible = showMobileNav && !isScrollingDown && !isDockAvoided;

  return (
    <>
      <nav
        aria-label="Secciones del producto"
        className="sticky top-4 z-20 hidden w-full rounded-2xl border border-white/10 bg-slate-950/80 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:block"
      >
        <SunSectionLinks activeSection={activeSection} items={items} onNavigate={onNavigate} />
      </nav>

      <nav
        ref={mobileDockRef}
        aria-label="Secciones del producto"
        aria-hidden={!isMobileDockVisible}
        inert={!isMobileDockVisible}
        className={`sun-mobile-dock fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 mx-auto max-w-[430px] rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[opacity,transform] duration-200 lg:hidden ${
          isMobileDockVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[calc(100%+2rem)] opacity-0"
        }`}
      >
        <SunSectionLinks activeSection={activeSection} items={items} mobile disabled={!isMobileDockVisible} onNavigate={onNavigate} />
      </nav>
    </>
  );
}
