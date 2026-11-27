import type { Variants } from "framer-motion";

const ease = [0.2, 0, 0, 1] as const;
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease } },
};
export const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.06 } },
};
export const sheet: Variants = {
  hidden: { x: 16, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.32, ease } },
};
