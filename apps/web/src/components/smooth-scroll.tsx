"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Inertial scrolling (Lenis) for the marketing pages only, on devices with a
 * fine pointer (mouse / trackpad). Touch keeps the native scroll, and a
 * reduced-motion preference disables it. The library is loaded on demand so
 * it never weighs on the first paint.
 */
const SMOOTH_ROUTES = new Set(["/", "/platform", "/compare", "/pricing", "/normas", "/demo-lab"]);

function isLocked() {
  const html = document.documentElement;
  const body = document.body;
  return getComputedStyle(html).overflow === "hidden" || getComputedStyle(body).overflow === "hidden";
}

export function SmoothScroll() {
  const pathname = usePathname() || "/";
  const enabled = SMOOTH_ROUTES.has(pathname);

  useEffect(() => {
    if (!enabled) return;
    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    let cancelled = false;
    let cleanup = () => {};

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({
        autoRaf: true,
        anchors: true,
        allowNestedScroll: true,
        lerp: 0.12,
        wheelMultiplier: 0.95,
      });
      document.documentElement.dataset.smoothScroll = "on";

      // Menus and dialogs lock the page with overflow:hidden; pause meanwhile.
      const sync = () => (isLocked() ? lenis.stop() : lenis.start());
      const observer = new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
      observer.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
      const onReduce = () => (reduce.matches ? lenis.destroy() : undefined);
      reduce.addEventListener("change", onReduce);

      cleanup = () => {
        observer.disconnect();
        reduce.removeEventListener("change", onReduce);
        lenis.destroy();
        delete document.documentElement.dataset.smoothScroll;
      };
    }).catch(() => {});

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled]);

  return null;
}
