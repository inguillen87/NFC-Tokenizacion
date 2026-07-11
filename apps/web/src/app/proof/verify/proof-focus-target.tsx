"use client";

import { useEffect } from "react";

export function ProofFocusTarget({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (!targetId) return;

    const focusTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    };

    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(focusTarget));
    const timer = window.setTimeout(focusTarget, 250);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [targetId]);

  return null;
}
