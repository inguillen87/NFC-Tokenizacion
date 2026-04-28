"use client";

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmptyState, tooltipStyle, useReducedMotion } from "./chart-utils";

export type TrustFunnelPoint = { stage: string; value: number };

export function TrustFunnelChart({ data }: { data: TrustFunnelPoint[] }) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="h-72" aria-label="Trust funnel chart" role="img">
      {!data.length ? <ChartEmptyState message="Sin embudo de confianza para el rango seleccionado." /> : (
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Funnel dataKey="value" data={data} isAnimationActive={!reducedMotion} fill="#22d3ee">
            <LabelList position="right" fill="#cbd5e1" stroke="none" dataKey="stage" />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
