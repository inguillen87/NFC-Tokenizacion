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
  backgroundColor: "rgba(10, 15, 30, 0.95)",
  border: "1px solid rgba(6, 182, 212, 0.25)",
  borderRadius: "14px",
  color: "#f8fafc",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  fontFamily: "Inter, sans-serif",
  padding: "10px 14px",
};
