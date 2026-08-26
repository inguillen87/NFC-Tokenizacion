"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export function SimpleTrustFlowMotion({ children, id, ariaLabel }: { children: ReactNode; id: string; ariaLabel: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [motionActive, setMotionActive] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inViewport = typeof IntersectionObserver === "undefined";
    let documentVisible = !document.hidden;
    let reducedMotion = reducedMotionQuery.matches;

    const syncMotion = () => {
      setMotionActive(inViewport && documentVisible && !reducedMotion);
    };

    const handleVisibilityChange = () => {
      documentVisible = !document.hidden;
      syncMotion();
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      syncMotion();
    };

    const intersectionObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          inViewport = Boolean(entry?.isIntersecting && entry.intersectionRatio > 0.12);
          syncMotion();
        }, { rootMargin: "80px 0px", threshold: [0, 0.12, 0.4] });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    intersectionObserver?.observe(list);
    syncMotion();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      intersectionObserver?.disconnect();
    };
  }, []);

  return (
    <ol
      id={id}
      ref={listRef}
      className="simple-trust-flow-steps"
      data-motion-active={motionActive ? "true" : "false"}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {children}
    </ol>
  );
}
