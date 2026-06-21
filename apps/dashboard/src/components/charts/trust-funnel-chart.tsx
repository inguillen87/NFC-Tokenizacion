"use client";

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { ChartEmptyState, tooltipStyle, useReducedMotion } from "./chart-utils";

export type TrustFunnelPoint = { stage: string; value: number };

const COLORS = ["#22d3ee", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1"];

export function TrustFunnelChart({ data }: { data: TrustFunnelPoint[] }) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="h-72" aria-label="Trust funnel chart" role="img">
      {!data.length ? <ChartEmptyState message="Sin embudo de confianza para el rango seleccionado." /> : (
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart margin={{ top: 10, right: 90, left: 10, bottom: 10 }}>
          <Tooltip contentStyle={tooltipStyle} />
          <Funnel dataKey="value" data={data} isAnimationActive={!reducedMotion}>
            <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="stage" fontSize={11} fontWeight={500} />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
