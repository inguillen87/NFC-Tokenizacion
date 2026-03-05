"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, StatCard, WorldMapPlaceholder } from "@product/ui";

export function AnalyticsPanels({
  kpis,
  trend,
  batchStatus,
}: {
  kpis: {
    scans: string;
    validInvalid: string;
    duplicates: string;
    tamper: string;
    scansDelta: string;
    validInvalidDelta: string;
    duplicatesDelta: string;
    tamperDelta: string;
    activeBatches: string;
    activeBatchesDelta: string;
    activeTenants: string;
    activeTenantsDelta: string;
    resellerPerformance: string;
    resellerPerformanceDelta: string;
    geoDistribution: string;
    geoDistributionDelta: string;
    trendTitle: string;
    statusTitle: string;
  };
  trend: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
  batchStatus: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={kpis.scans} value="22.4k" delta={kpis.scansDelta} tone="good" />
        <StatCard label={kpis.validInvalid} value="98.8 / 1.2" delta={kpis.validInvalidDelta} tone="good" />
        <StatCard label={kpis.duplicates} value="202" delta={kpis.duplicatesDelta} tone="warn" />
        <StatCard label={kpis.tamper} value="32" delta={kpis.tamperDelta} tone="warn" />
        <StatCard label={kpis.activeBatches} value="68" delta={kpis.activeBatchesDelta} tone="good" />
        <StatCard label={kpis.activeTenants} value="27" delta={kpis.activeTenantsDelta} tone="good" />
        <StatCard label={kpis.resellerPerformance} value="USD 40.2k" delta={kpis.resellerPerformanceDelta} tone="good" />
        <StatCard label={kpis.geoDistribution} value="8 regions" delta={kpis.geoDistributionDelta} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">{kpis.trendTitle}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
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
