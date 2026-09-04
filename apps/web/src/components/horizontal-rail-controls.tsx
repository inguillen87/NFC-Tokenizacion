"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HORIZONTAL_RAIL_INDEX_CHANGE_EVENT,
  HORIZONTAL_RAIL_NAVIGATE_EVENT,
  clampHorizontalRailIndex,
  type HorizontalRailIndexChangeDetail,
  type HorizontalRailNavigateDetail,
} from "../lib/horizontal-rail-model.mjs";

type HorizontalRailControlsProps = {
  railId: string;
  itemCount: number;
  previousLabel: string;
  nextLabel: string;
};

export function HorizontalRailControls({ railId, itemCount, previousLabel, nextLabel }: HorizontalRailControlsProps) {
  const railRef = useRef<HTMLElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  const requestIndex = useCallback((requestedIndex: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const detail: HorizontalRailNavigateDetail = {
      index: clampHorizontalRailIndex(requestedIndex, itemCount),
      focus: false,
    };
    rail.dispatchEvent(new CustomEvent(HORIZONTAL_RAIL_NAVIGATE_EVENT, { detail }));
  }, [itemCount]);

  useEffect(() => {
    const rail = document.getElementById(railId);
    if (!rail) return;
    railRef.current = rail;
    let animationFrame = 0;

    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setOverflowing(rail.scrollWidth > rail.clientWidth + 2);
      });
    };

    const handleIndexChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as Partial<HorizontalRailIndexChangeDetail> | null;
      if (!detail || typeof detail.index !== "number") return;
      setCurrentIndex(clampHorizontalRailIndex(detail.index, itemCount));
    };

    const initialIndex = Number(rail.dataset.activeStep) - 1;
    setCurrentIndex(clampHorizontalRailIndex(initialIndex, itemCount));

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(rail);
    rail.addEventListener(HORIZONTAL_RAIL_INDEX_CHANGE_EVENT, handleIndexChange);
    window.addEventListener("resize", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      rail.removeEventListener(HORIZONTAL_RAIL_INDEX_CHANGE_EVENT, handleIndexChange);
      window.removeEventListener("resize", measure);
      railRef.current = null;
    };
  }, [itemCount, railId]);

  return (
    <div className="landing-rail-controls" hidden={!overflowing} aria-label={`${currentIndex + 1} / ${itemCount}`}>
      <button
        type="button"
        aria-label={previousLabel}
        aria-controls={railId}
        disabled={currentIndex === 0}
        onClick={() => requestIndex(currentIndex - 1)}
      >
        <ArrowLeft aria-hidden="true" />
      </button>
      <span aria-live="polite" aria-atomic="true">{currentIndex + 1} / {itemCount}</span>
      <button
        type="button"
        aria-label={nextLabel}
        aria-controls={railId}
        disabled={currentIndex === itemCount - 1}
        onClick={() => requestIndex(currentIndex + 1)}
      >
        <ArrowRight aria-hidden="true" />
      </button>
    </div>
  );
}
