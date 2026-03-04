import * as React from "react";

export function Badge({ children, tone = "default" }: React.PropsWithChildren<{ tone?: "default" | "cyan" | "green" | "amber" }>) {
  const map = {
    default: "border-white/10 bg-white/5 text-slate-300",
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${map[tone]}`}>{children}</span>;
}
