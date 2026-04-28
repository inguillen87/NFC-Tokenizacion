"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmptyState, tooltipStyle, useReducedMotion } from "./chart-utils";

export type TapVelocityPoint = { day: string; scans: number; duplicates: number; tamper: number; valid?: number };

export function TapVelocityChart({
  data,
  onSelectDay,
}: {
  data: TapVelocityPoint[];
  onSelectDay?: (day: string) => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="h-72" aria-label="Tap velocity chart" role="img">
      {!data.length ? <ChartEmptyState message="Sin eventos para tendencia de taps en el rango seleccionado." /> : (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} onClick={(state) => {
          const active = state?.activePayload?.[0]?.payload as TapVelocityPoint | undefined;
          if (active?.day) onSelectDay?.(active.day);
        }}>
          <CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area isAnimationActive={!reducedMotion} animationDuration={420} type="monotone" dataKey="scans" stroke="#06b6d4" strokeWidth={2} fill="rgba(6,182,212,.22)" />
                    <Area isAnimationActive={!reducedMotion} animationDuration={420} type="monotone" dataKey="duplicates" stroke="#f59e0b" fill="rgba(245,158,11,.18)" />
                    <Area isAnimationActive={!reducedMotion} animationDuration={420} type="monotone" dataKey="tamper" stroke="#ef4444" fill="rgba(239,68,68,.15)" />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
