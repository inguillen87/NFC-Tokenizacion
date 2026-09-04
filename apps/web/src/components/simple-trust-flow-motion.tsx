"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  HORIZONTAL_RAIL_INDEX_CHANGE_EVENT,
  HORIZONTAL_RAIL_NAVIGATE_EVENT,
  clampHorizontalRailIndex,
  closestHorizontalRailIndex,
  wrapHorizontalRailIndex,
  type HorizontalRailIndexChangeDetail,
  type HorizontalRailNavigateDetail,
} from "../lib/horizontal-rail-model.mjs";

type MotionEnvironment = {
  mounted: boolean;
  pageVisible: boolean;
  reducedMotion: boolean;
};

function useMotionEnvironment(): MotionEnvironment {
  const [mounted, setMounted] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

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

  return { mounted, pageVisible, reducedMotion };
}

function splitIntoPhrases(value: string): string[] {
  const phrases = value.match(/[^.!?]+[.!?]?/g)?.map((phrase) => phrase.trim()).filter(Boolean);
  return phrases?.length ? phrases : [value];
}

export type SimpleTrustFlowIntroMotionProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function SimpleTrustFlowIntroMotion({
  eyebrow,
  title,
  body,
}: SimpleTrustFlowIntroMotionProps) {
  const introRef = useRef<HTMLDivElement>(null);
  const [introVisible, setIntroVisible] = useState(false);
  const { mounted, pageVisible, reducedMotion } = useMotionEnvironment();

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;

    if (typeof IntersectionObserver === "undefined") {
      setIntroVisible(true);
      return;
    }

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      setIntroVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.2));
    }, { rootMargin: "0px 0px -10%", threshold: [0, 0.2, 0.5] });

    intersectionObserver.observe(intro);
    return () => intersectionObserver.disconnect();
  }, []);

  const motionAllowed = mounted && pageVisible && !reducedMotion;
  const titlePhrases = splitIntoPhrases(title);
  const bodyPhrases = splitIntoPhrases(body);

  return (
    <div
      ref={introRef}
      className="simple-trust-flow-intro"
      data-motion-ready={mounted && !reducedMotion ? "true" : "false"}
      data-motion-active={motionAllowed && introVisible ? "true" : "false"}
    >
      <div className="simple-trust-flow-ambient" aria-hidden="true">
        <span className="simple-trust-flow-ambient__halo" />
        <span className="simple-trust-flow-ambient__beam" />
        <span className="simple-trust-flow-ambient__node simple-trust-flow-ambient__node--one" />
        <span className="simple-trust-flow-ambient__node simple-trust-flow-ambient__node--two" />
      </div>

      <p className="simple-trust-flow-eyebrow">{eyebrow}</p>
      <h2>
        {titlePhrases.map((phrase, index) => (
          <span className="simple-trust-flow-title-line" key={`${phrase}-${index}`}>
            <span
              className="simple-trust-flow-title-line__inner"
              style={{ "--trust-title-index": index } as CSSProperties}
            >
              {phrase}{index < titlePhrases.length - 1 ? " " : ""}
            </span>
          </span>
        ))}
      </h2>
      <p className="simple-trust-flow-body">
        {bodyPhrases.map((phrase, index) => (
          <span
            className="simple-trust-flow-body__phrase"
            key={`${phrase}-${index}`}
            style={{ "--trust-body-index": index } as CSSProperties}
          >
            {phrase}{index < bodyPhrases.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}

export type SimpleTrustFlowMotionProps = {
  children: ReactNode;
  id: string;
  ariaLabel: string;
};

type SelectableStepProps = HTMLAttributes<HTMLElement> & {
  "data-journey-interactive"?: string;
  "data-motion-active"?: string;
  "data-step-state"?: string;
};

export function SimpleTrustFlowMotion({
  children,
  id,
  ariaLabel,
}: SimpleTrustFlowMotionProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [visibleItems, setVisibleItems] = useState<ReadonlySet<number>>(() => new Set());
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const { mounted, pageVisible, reducedMotion } = useMotionEnvironment();

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
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.18;
          if (visible === next.has(index)) return;
          if (visible) next.add(index);
          else next.delete(index);
          changed = true;
        });

        return changed ? next : current;
      });
    }, { rootMargin: "32px 0px", threshold: [0, 0.18, 0.55] });

    items.forEach((item) => intersectionObserver.observe(item));

    return () => {
      intersectionObserver.disconnect();
    };
  }, [id]);

  const itemCount = Children.count(children);

  const selectStep = useCallback((requestedIndex: number, focus = true) => {
    const list = listRef.current;
    if (!list || itemCount === 0) return;
    const nextIndex = clampHorizontalRailIndex(requestedIndex, itemCount);
    const nextItem = list.children.item(nextIndex);
    if (!(nextItem instanceof HTMLElement)) return;

    setActiveItemIndex(nextIndex);
    if (focus) {
      const nextTrigger = nextItem.querySelector<HTMLButtonElement>(".simple-trust-flow-step-trigger");
      nextTrigger?.focus({ preventScroll: true });
    }

    const left = nextItem.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    list.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
  }, [itemCount, reducedMotion]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let animationFrame = 0;

    const syncIndexFromScroll = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const itemLefts = Array.from(list.children, (item) => item.getBoundingClientRect().left);
        const nextIndex = closestHorizontalRailIndex(list.getBoundingClientRect().left, itemLefts);
        setActiveItemIndex((current) => current === nextIndex ? current : nextIndex);
      });
    };

    const handleNavigate = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as Partial<HorizontalRailNavigateDetail> | null;
      if (!detail || typeof detail.index !== "number") return;
      selectStep(detail.index, detail.focus === true);
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncIndexFromScroll);
    resizeObserver?.observe(list);
    list.addEventListener("scroll", syncIndexFromScroll, { passive: true });
    list.addEventListener(HORIZONTAL_RAIL_NAVIGATE_EVENT, handleNavigate);
    window.addEventListener("resize", syncIndexFromScroll);
    syncIndexFromScroll();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      list.removeEventListener("scroll", syncIndexFromScroll);
      list.removeEventListener(HORIZONTAL_RAIL_NAVIGATE_EVENT, handleNavigate);
      window.removeEventListener("resize", syncIndexFromScroll);
    };
  }, [id, selectStep]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const detail: HorizontalRailIndexChangeDetail = { index: activeItemIndex };
    list.dispatchEvent(new CustomEvent(HORIZONTAL_RAIL_INDEX_CHANGE_EVENT, { detail }));
  }, [activeItemIndex]);

  function handleStepKeyDown(event: React.KeyboardEvent<HTMLElement>, index: number) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = wrapHorizontalRailIndex(index + 1, itemCount);
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = wrapHorizontalRailIndex(index - 1, itemCount);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = itemCount - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      selectStep(nextIndex);
    }
  }

  const motionAllowed = mounted && pageVisible && !reducedMotion;
  const motionChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    const typedChild = child as ReactElement<SelectableStepProps>;
    const isActive = index === activeItemIndex;
    const stepState = isActive ? "active" : "idle";
    const progress = isActive ? ((index + 1) / itemCount) * 100 : 0;

    return cloneElement(typedChild, {
      "data-journey-interactive": "true",
      "data-step-state": stepState,
      "data-motion-active": motionAllowed && visibleItems.has(index) ? "true" : "false",
      style: {
        ...typedChild.props.style,
        "--trust-step-progress": `${progress}%`,
      } as CSSProperties,
      "aria-current": undefined,
      tabIndex: undefined,
      onClick: undefined,
      onFocus: undefined,
      onKeyDown: undefined,
      children: (
        <button
          type="button"
          className="simple-trust-flow-step-trigger"
          aria-current={isActive ? "step" : undefined}
          tabIndex={isActive ? 0 : -1}
          onClick={(event) => {
            typedChild.props.onClick?.(event);
            if (!event.defaultPrevented) selectStep(index);
          }}
          onFocus={(event) => {
            typedChild.props.onFocus?.(event);
            if (!event.defaultPrevented) setActiveItemIndex(index);
          }}
          onKeyDown={(event) => {
            typedChild.props.onKeyDown?.(event);
            if (!event.defaultPrevented) handleStepKeyDown(event, index);
          }}
        >
          {typedChild.props.children}
          <span className="simple-trust-flow-step-progress" aria-hidden="true">
            <span />
          </span>
        </button>
      ),
    });
  });

  return (
    <ol
      id={id}
      ref={listRef}
      className="simple-trust-flow-steps"
      data-motion-ready={mounted && !reducedMotion ? "true" : "false"}
      data-active-step={activeItemIndex + 1}
      aria-label={ariaLabel}
    >
      {motionChildren}
    </ol>
  );
}
