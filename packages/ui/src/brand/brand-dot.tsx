"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cx, type BrandProps } from "./types";

const ringOffsets = [0, 0.24, 0.48];

export function BrandDot({ size = 12, variant = "pulse", theme = "dark", className }: BrandProps) {
  const reducedMotion = useReducedMotion();
  const dotColor = `var(--brand-dot-color, ${theme === "dark" ? "#2FE1C3" : "#0891B2"})`;
  const glowColor = `var(--brand-dot-glow, ${theme === "dark" ? "rgba(47,225,195,0.58)" : "rgba(8,145,178,0.45)"})`;
  const shouldAnimate = !reducedMotion && variant !== "static";

  return (
    <span
      className={cx("brand-dot", variant === "ripple" ? "brand-dot--ripple" : undefined, className)}
      style={{
        width: size,
        height: size,
        ["--brand-dot-color" as string]: dotColor,
        ["--brand-dot-glow" as string]: glowColor,
      }}
      aria-hidden
    >
      <motion.span
        className="brand-dot__core"
        animate={
          shouldAnimate
            ? {
                scale: [1, 1.1, 1],
                boxShadow: [
                  `0 0 0 0 ${glowColor}`,
                  `0 0 0 ${Math.max(6, size * 0.6)}px rgba(47,225,195,0)`,
                  `0 0 0 0 ${glowColor}`,
                ],
              }
            : undefined
        }
        transition={shouldAnimate ? { duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } : undefined}
      />
      {variant === "ripple" && shouldAnimate
        ? ringOffsets.map((delay, index) => (
            <motion.span
              key={index}
              className="brand-dot__ring"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: [0.85, 2.2], opacity: [0, 0.35, 0] }}
              transition={{ duration: 1.8, ease: "easeOut", repeat: Number.POSITIVE_INFINITY, delay }}
            />
          ))
        : null}
    </span>
  );
}
