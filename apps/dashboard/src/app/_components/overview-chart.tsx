"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { day: "Mon", scans: 120 },
  { day: "Tue", scans: 180 },
  { day: "Wed", scans: 220 },
  { day: "Thu", scans: 240 },
  { day: "Fri", scans: 320 },
  { day: "Sat", scans: 410 },
  { day: "Sun", scans: 380 },
];

export function OverviewChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip />
          <Area type="monotone" dataKey="scans" stroke="#06b6d4" fillOpacity={1} fill="url(#c)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
