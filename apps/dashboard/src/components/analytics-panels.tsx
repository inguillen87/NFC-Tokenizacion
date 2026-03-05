"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, StatCard, WorldMapPlaceholder } from "@product/ui";

type AnalyticsPanelsProps = {
  kpis: {
    scans: string;
    validInvalid: string;
    duplicates: string;
    tamper: string;
    scansDelta: string;
    validInvalidDelta: string;
    duplicatesDelta: string;
    tamperDelta: string;
    trendTitle: string;
    statusTitle: string;
  };
  extra: {
    activeBatches: string;
    activeBatchesDelta: string;
    activeTenants: string;
    activeTenantsDelta: string;
    resellerPerformance: string;
    resellerPerformanceDelta: string;
    geoDistribution: string;
    geoDistributionDelta: string;
  };
};

const scans = [
  { day: "Mon", scans: 2400, duplicates: 20, tamper: 3 },
  { day: "Tue", scans: 2210, duplicates: 28, tamper: 4 },
  { day: "Wed", scans: 2890, duplicates: 19, tamper: 2 },
  { day: "Thu", scans: 3120, duplicates: 36, tamper: 6 },
  { day: "Fri", scans: 4200, duplicates: 42, tamper: 8 },
  { day: "Sat", scans: 3980, duplicates: 31, tamper: 5 },
  { day: "Sun", scans: 3670, duplicates: 26, tamper: 4 },
];

const batchStatus = [
  { name: "Active", value: 68 },
  { name: "Pending", value: 22 },
  { name: "Revoked", value: 10 },
];

export function AnalyticsPanels({ kpis, extra }: AnalyticsPanelsProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={kpis.scans} value="22.4k" delta={kpis.scansDelta} tone="good" />
        <StatCard label={kpis.validInvalid} value="98.8 / 1.2" delta={kpis.validInvalidDelta} tone="good" />
        <StatCard label={kpis.duplicates} value="202" delta={kpis.duplicatesDelta} tone="warn" />
        <StatCard label={kpis.tamper} value="32" delta={kpis.tamperDelta} tone="warn" />
        <StatCard label={extra.activeBatches} value="68" delta={extra.activeBatchesDelta} tone="good" />
        <StatCard label={extra.activeTenants} value="27" delta={extra.activeTenantsDelta} tone="good" />
        <StatCard label={extra.resellerPerformance} value="USD 40.2k" delta={extra.resellerPerformanceDelta} tone="good" />
        <StatCard label={extra.geoDistribution} value="8 regions" delta={extra.geoDistributionDelta} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">{kpis.trendTitle}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scans}>
                <CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="scans" stroke="#06b6d4" fill="rgba(6,182,212,.2)" />
                <Area type="monotone" dataKey="duplicates" stroke="#f59e0b" fill="rgba(245,158,11,.15)" />
                <Area type="monotone" dataKey="tamper" stroke="#ef4444" fill="rgba(239,68,68,.12)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">{kpis.statusTitle}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batchStatus}>
                <CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <WorldMapPlaceholder />
    </div>
  );
}
