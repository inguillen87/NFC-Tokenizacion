"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmptyState, tooltipStyle, useReducedMotion } from "./chart-utils";

export type RiskRadarPoint = { label: string; value: number; max: number };

export function RiskRadarChart({ data, onSelectCategory }: { data: RiskRadarPoint[]; onSelectCategory?: (label: string) => void }) {
  const normalized = data.map((item) => ({ ...item, score: Math.max(0, Math.min(100, (item.value / Math.max(item.max, 1)) * 100)) }));
  const reducedMotion = useReducedMotion();
  return (
    <div className="h-72" aria-label="Risk radar chart" role="img">
      {!normalized.length ? <ChartEmptyState message="Sin dimensiones de riesgo para renderizar radar." /> : (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={normalized} onClick={(state) => {
          const active = state?.activePayload?.[0]?.payload as { label?: string } | undefined;
          if (active?.label) onSelectCategory?.(active.label);
        }}>
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
          <Radar 
            isAnimationActive={!reducedMotion} 
            animationDuration={600} 
            name="Riesgo" 
            dataKey="score" 
            stroke="#f43f5e" 
            strokeWidth={2}
            fill="rgba(244,63,94,0.25)" 
            dot={{ r: 3, fill: "#f43f5e", strokeWidth: 0 }}
          />
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
