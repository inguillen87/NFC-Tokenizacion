"use client";

import { Activity, LayoutGrid, MapPin, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

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

const MOBILE_DOCK_CLEARANCE_PX = 92;

function SunSectionLinks({
  activeSection,
  items,
  mobile = false,
  onNavigate,
}: {
  activeSection: SunSectionId;
  items: readonly SunSectionNavItem[];
  mobile?: boolean;
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

  const onNavigate = (sectionId: SunSectionId) => setActiveSection(sectionId);

  return (
    <>
      <nav
        aria-label="Secciones del producto"
        className="sticky top-4 z-20 hidden w-full rounded-2xl border border-white/10 bg-slate-950/80 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:block"
      >
        <SunSectionLinks activeSection={activeSection} items={items} onNavigate={onNavigate} />
      </nav>

      {showMobileNav ? (
        <nav
          aria-label="Secciones del producto"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto max-w-[430px] rounded-2xl border border-white/10 bg-slate-950/90 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden"
        >
          <SunSectionLinks activeSection={activeSection} items={items} mobile onNavigate={onNavigate} />
        </nav>
      ) : null}
    </>
  );
}
