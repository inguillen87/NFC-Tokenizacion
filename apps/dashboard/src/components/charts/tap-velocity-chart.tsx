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
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(state) => {
          const active = state?.activePayload?.[0]?.payload as TapVelocityPoint | undefined;
          if (active?.day) onSelectDay?.(active.day);
        }}>
          <defs>
            <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.24}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
            </linearGradient>
            <linearGradient id="colorDuplicates" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.18}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
            </linearGradient>
            <linearGradient id="colorTamper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.16}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey="day" 
            stroke="#64748b" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
            dy={8}
          />
          <YAxis 
            stroke="#64748b" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
            dx={-8}
          />
          <Tooltip 
            contentStyle={tooltipStyle} 
            cursor={{ stroke: "rgba(255,255,255,0.05)", strokeWidth: 1.5 }}
          />
          <Area 
            isAnimationActive={!reducedMotion} 
            animationDuration={600} 
            type="monotone" 
            dataKey="scans" 
            stroke="#06b6d4" 
            strokeWidth={2} 
            fill="url(#colorScans)" 
            activeDot={{ r: 5, strokeWidth: 0, fill: "#06b6d4" }}
          />
          <Area 
            isAnimationActive={!reducedMotion} 
            animationDuration={600} 
            type="monotone" 
            dataKey="duplicates" 
            stroke="#f59e0b" 
            strokeWidth={2} 
            fill="url(#colorDuplicates)" 
            activeDot={{ r: 4, strokeWidth: 0, fill: "#f59e0b" }}
          />
          <Area 
            isAnimationActive={!reducedMotion} 
            animationDuration={600} 
            type="monotone" 
            dataKey="tamper" 
            stroke="#ef4444" 
            strokeWidth={2} 
            fill="url(#colorTamper)" 
            activeDot={{ r: 4, strokeWidth: 0, fill: "#ef4444" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
