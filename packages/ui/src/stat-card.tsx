import * as React from "react";
import { Card } from "./card";

export function StatCard({ label, value, delta, tone = "default" }: { label: string; value: string; delta?: string; tone?: "default" | "good" | "warn" | "danger" }) {
  const toneClass = {
    default: "text-white",
    good: "text-emerald-300",
    warn: "text-amber-300",
    danger: "text-rose-300",
  }[tone];

  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-3 text-3xl font-bold ${toneClass}`}>{value}</div>
      {delta ? <div className="mt-2 text-xs text-slate-500">{delta}</div> : null}
    </Card>
  );
}
