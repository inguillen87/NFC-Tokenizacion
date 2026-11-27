"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { useEffect } from "react";
import styles from "./home-enhancements.module.css";

// A thin reading-progress line under the sticky header.
export function LandingScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  // Always rendered so server and client markup match; CSS hides it under reduced motion.
  return <motion.div className={styles.progress} style={{ scaleX }} aria-hidden="true" />;
}

// Progressive enhancement for the landing:
// - reveals elements marked with data-reveal as they enter the viewport;
// - moves the hero scene slightly with a fine pointer;
// - feeds a pointer position to cards marked with data-spotlight.
// Without JavaScript, or with reduced motion, every element stays visible and still.
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".landing-root");
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const cleanups: Array<() => void> = [];

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const revealAll = () => targets.forEach((target) => target.setAttribute("data-revealed", ""));
    if (typeof IntersectionObserver === "undefined") {
      revealAll();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.setAttribute("data-revealed", "");
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      targets.forEach((target) => observer.observe(target));
      root.setAttribute("data-reveal-ready", "");
      window.addEventListener("beforeprint", revealAll);
      cleanups.push(() => {
        observer.disconnect();
        window.removeEventListener("beforeprint", revealAll);
        root.removeAttribute("data-reveal-ready");
      });
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (finePointer.matches) {
      const hero = root.querySelector<HTMLElement>(".landing-hero-section");
      let frame = 0;
      if (hero) {
        const onHeroMove = (event: PointerEvent) => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            const box = hero.getBoundingClientRect();
            const x = (event.clientX - box.left) / box.width - 0.5;
            const y = (event.clientY - box.top) / box.height - 0.5;
            hero.style.setProperty("--depth-x", x.toFixed(3));
            hero.style.setProperty("--depth-y", y.toFixed(3));
          });
        };
        const onHeroLeave = () => {
          cancelAnimationFrame(frame);
          hero.style.setProperty("--depth-x", "0");
          hero.style.setProperty("--depth-y", "0");
        };
        hero.addEventListener("pointermove", onHeroMove);
        hero.addEventListener("pointerleave", onHeroLeave);
        cleanups.push(() => {
          cancelAnimationFrame(frame);
          hero.removeEventListener("pointermove", onHeroMove);
          hero.removeEventListener("pointerleave", onHeroLeave);
          hero.style.removeProperty("--depth-x");
          hero.style.removeProperty("--depth-y");
        });
      }

      const onSpotlight = (event: PointerEvent) => {
        const card = (event.target as Element | null)?.closest<HTMLElement>("[data-spotlight]");
        if (!card) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
        card.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
      };
      root.addEventListener("pointermove", onSpotlight, { passive: true });
      cleanups.push(() => root.removeEventListener("pointermove", onSpotlight));
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
