"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { Card, StatCard, WorldMapPlaceholder } from "@product/ui";

export function AnalyticsPanels({ title }: { title: string }) {
  const scans = [
    { day: "Mon", scans: 2400, duplicates: 20, tamper: 3 },
    { day: "Tue", scans: 2210, duplicates: 28, tamper: 4 },
    { day: "Wed", scans: 2890, duplicates: 19, tamper: 2 },
    { day: "Thu", scans: 3120, duplicates: 36, tamper: 6 },
    { day: "Fri", scans: 4200, duplicates: 42, tamper: 8 },
    { day: "Sat", scans: 3980, duplicates: 31, tamper: 5 },
    { day: "Sun", scans: 3670, duplicates: 26, tamper: 4 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scans" value="22.4k" delta="+12.4%" tone="good" />
        <StatCard label="Valid / Invalid" value="98.8 / 1.2" delta="7d" tone="good" />
        <StatCard label="Duplicates" value="202" delta="-8.3%" tone="warn" />
        <StatCard label="Tamper alerts" value="32" delta="+4" tone="warn" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5"><h3 className="text-sm font-semibold text-white">{title}</h3><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={scans}><CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" /><XAxis dataKey="day" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Area type="monotone" dataKey="scans" stroke="#06b6d4" fill="rgba(6,182,212,.2)" /><Area type="monotone" dataKey="duplicates" stroke="#f59e0b" fill="rgba(245,158,11,.15)" /><Area type="monotone" dataKey="tamper" stroke="#ef4444" fill="rgba(239,68,68,.12)" /></AreaChart></ResponsiveContainer></div></Card>
        <Card className="p-5"><h3 className="text-sm font-semibold text-white">Batch status</h3><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{name:"Active",value:68},{name:"Pending",value:22},{name:"Revoked",value:10}]}><CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <WorldMapPlaceholder />
    </div>
  );
}
