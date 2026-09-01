"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

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

export function SimpleTrustFlowMotion({
  children,
  id,
  ariaLabel,
}: SimpleTrustFlowMotionProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [visibleItems, setVisibleItems] = useState<ReadonlySet<number>>(() => new Set());
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

  const motionAllowed = mounted && pageVisible && !reducedMotion;
  const motionChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child as ReactElement<{ "data-motion-active"?: string }>, {
      "data-motion-active": motionAllowed && visibleItems.has(index) ? "true" : "false",
    });
  });

  return (
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
  );
}
