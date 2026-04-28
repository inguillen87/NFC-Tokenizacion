"use client";

import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-center text-sm text-slate-400" role="status">
      {message}
    </div>
  );
}

export const tooltipStyle = {
  backgroundColor: "rgba(15,23,42,.96)",
  border: "1px solid rgba(148,163,184,.24)",
  borderRadius: 12,
  color: "#e2e8f0",
  boxShadow: "0 10px 35px rgba(2,6,23,.45)",
};
