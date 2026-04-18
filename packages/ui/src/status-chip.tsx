import * as React from "react";

const tones: Record<string, string> = {
  good: "border-emerald-300/25 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-300/25 bg-amber-500/10 text-amber-200",
  risk: "border-rose-300/25 bg-rose-500/10 text-rose-200",
  neutral: "border-white/15 bg-white/5 text-slate-200",
};

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "good" | "warn" | "risk" | "neutral";
}) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>{label}</span>;
}
