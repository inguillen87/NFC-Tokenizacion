"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type HorizontalRailControlsProps = {
  railId: string;
  itemCount: number;
  previousLabel: string;
  nextLabel: string;
};

export function HorizontalRailControls({ railId, itemCount, previousLabel, nextLabel }: HorizontalRailControlsProps) {
  const railRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef<HTMLElement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  const findCurrentIndex = useCallback(() => {
    const rail = railRef.current;
    if (!rail || itemsRef.current.length === 0) return 0;
    const railLeft = rail.getBoundingClientRect().left;
    return itemsRef.current.reduce((closestIndex, item, index, items) => {
      const distance = Math.abs(item.getBoundingClientRect().left - railLeft);
      const closestDistance = Math.abs(items[closestIndex].getBoundingClientRect().left - railLeft);
      return distance < closestDistance ? index : closestIndex;
    }, 0);
  }, []);

  const goTo = useCallback((requestedIndex: number) => {
    const rail = railRef.current;
    if (!rail || itemsRef.current.length === 0) return;
    const index = Math.max(0, Math.min(requestedIndex, itemsRef.current.length - 1));
    const target = itemsRef.current[index];
    const left = target.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    const rail = document.getElementById(railId);
    if (!rail) return;
    railRef.current = rail;
    itemsRef.current = Array.from(rail.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
    let animationFrame = 0;

    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setOverflowing(rail.scrollWidth > rail.clientWidth + 2);
        setCurrentIndex(findCurrentIndex());
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      goTo(findCurrentIndex() + direction);
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(rail);
    rail.addEventListener("scroll", measure, { passive: true });
    rail.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      rail.removeEventListener("scroll", measure);
      rail.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", measure);
      railRef.current = null;
      itemsRef.current = [];
    };
  }, [findCurrentIndex, goTo, railId]);

  return (
    <div className="landing-rail-controls" hidden={!overflowing} aria-label={`${currentIndex + 1} / ${itemCount}`}>
      <button
        type="button"
        aria-label={previousLabel}
        aria-controls={railId}
        disabled={currentIndex === 0}
        onClick={() => goTo(currentIndex - 1)}
      >
        <ArrowLeft aria-hidden="true" />
      </button>
      <span aria-live="polite" aria-atomic="true">{currentIndex + 1} / {itemCount}</span>
      <button
        type="button"
        aria-label={nextLabel}
        aria-controls={railId}
        disabled={currentIndex === itemCount - 1}
        onClick={() => goTo(currentIndex + 1)}
      >
        <ArrowRight aria-hidden="true" />
      </button>
    </div>
  );
}
