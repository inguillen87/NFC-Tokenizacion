"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

export type RiskRadarPoint = { label: string; value: number; max: number };

export function RiskRadarChart({ data, onSelectCategory }: { data: RiskRadarPoint[]; onSelectCategory?: (label: string) => void }) {
  const normalized = data.map((item) => ({ ...item, score: Math.max(0, Math.min(100, (item.value / Math.max(item.max, 1)) * 100)) }));
  return (
    <div className="h-72" aria-label="Risk radar chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={normalized} onClick={(state) => {
          const active = state?.activePayload?.[0]?.payload as { label?: string } | undefined;
          if (active?.label) onSelectCategory?.(active.label);
        }}>
          <PolarGrid stroke="rgba(148,163,184,.25)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
          <Radar name="risk" dataKey="score" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.35} />
          <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,.92)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
