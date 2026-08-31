"use client";

import { Pause, Play } from "lucide-react";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";

export type SimpleTrustFlowMotionProps = {
  children: ReactNode;
  id: string;
  ariaLabel: string;
  pauseLabel?: string;
  resumeLabel?: string;
  motionOffLabel?: string;
};

export function SimpleTrustFlowMotion({
  children,
  id,
  ariaLabel,
  pauseLabel = "Pausar animaciones",
  resumeLabel = "Reanudar animaciones",
  motionOffLabel = "Movimiento reducido activo",
}: SimpleTrustFlowMotionProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [visibleItems, setVisibleItems] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncEnvironment = () => {
      setPageVisible(!document.hidden);
      setReducedMotion(reducedMotionQuery.matches);
    };

    const handleVisibilityChange = () => setPageVisible(!document.hidden);
    const handleReducedMotionChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);

    setMounted(true);
    syncEnvironment();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
    setVisibleItems(new Set());

    if (typeof IntersectionObserver === "undefined") {
      setVisibleItems(new Set(items.map((_, index) => index)));
      return;
    }

    const intersectionObserver = new IntersectionObserver((entries) => {
      setVisibleItems((current) => {
        const next = new Set(current);
        let changed = false;

        entries.forEach((entry) => {
          const index = items.indexOf(entry.target as HTMLElement);
          if (index < 0) return;
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.45;
          if (visible === next.has(index)) return;
          if (visible) next.add(index);
          else next.delete(index);
          changed = true;
        });

        return changed ? next : current;
      });
    }, { rootMargin: "40px 0px", threshold: [0, 0.45, 0.75] });

    items.forEach((item) => intersectionObserver.observe(item));

    return () => {
      intersectionObserver.disconnect();
    };
  }, [id]);

  const motionAllowed = mounted && pageVisible && !reducedMotion && !userPaused;
  const motionChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child as ReactElement<{ "data-motion-active"?: string }>, {
      "data-motion-active": motionAllowed && visibleItems.has(index) ? "true" : "false",
    });
  });

  const playbackLabel = !mounted || reducedMotion
    ? motionOffLabel
    : userPaused
      ? resumeLabel
      : pauseLabel;

  return (
    <>
      <div className="simple-trust-flow-motion-controls">
        <button
          type="button"
          className="simple-trust-flow-motion-toggle"
          aria-controls={id}
          aria-pressed={userPaused}
          disabled={!mounted || reducedMotion}
          onClick={() => setUserPaused((paused) => !paused)}
        >
          {userPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span>{playbackLabel}</span>
        </button>
      </div>
      <ol
        id={id}
        ref={listRef}
        className="simple-trust-flow-steps"
        data-motion-ready={mounted && !reducedMotion ? "true" : "false"}
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {motionChildren}
      </ol>
    </>
  );
}
