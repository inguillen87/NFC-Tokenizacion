"use client";

import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";

export type TrustFunnelPoint = { stage: string; value: number };

export function TrustFunnelChart({ data }: { data: TrustFunnelPoint[] }) {
  return (
    <div className="h-72" aria-label="Trust funnel chart">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip contentStyle={{ backgroundColor: "rgba(15,23,42,.92)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
          <Funnel dataKey="value" data={data} isAnimationActive fill="#22d3ee">
            <LabelList position="right" fill="#cbd5e1" stroke="none" dataKey="stage" />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
