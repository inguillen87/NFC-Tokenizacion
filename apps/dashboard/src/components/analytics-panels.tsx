"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, StatCard } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";

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
  data?: {
    kpis?: {
      scans?: number;
      validRate?: number;
      invalidRate?: number;
      duplicates?: number;
      tamper?: number;
      activeBatches?: number;
      activeTenants?: number;
      geoRegions?: number;
      resellerPerformance?: number;
    };
    trend?: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
    batchStatus?: Array<{ name: string; value: number }>;
    geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>;
  };
};

const fallbackScans = [
  { day: "Mon", scans: 2400, duplicates: 20, tamper: 3 },
  { day: "Tue", scans: 2210, duplicates: 28, tamper: 4 },
  { day: "Wed", scans: 2890, duplicates: 19, tamper: 2 },
  { day: "Thu", scans: 3120, duplicates: 36, tamper: 6 },
  { day: "Fri", scans: 4200, duplicates: 42, tamper: 8 },
  { day: "Sat", scans: 3980, duplicates: 31, tamper: 5 },
  { day: "Sun", scans: 3670, duplicates: 26, tamper: 4 },
];

const fallbackBatchStatus = [
  { name: "Active", value: 68 },
  { name: "Pending", value: 22 },
  { name: "Revoked", value: 10 },
];

export function AnalyticsPanels({ kpis, extra, data }: AnalyticsPanelsProps) {
  const api = data?.kpis || {};
  const trend = data?.trend?.length ? data.trend : fallbackScans;
  const batchStatus = data?.batchStatus?.length ? data.batchStatus : fallbackBatchStatus;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={kpis.scans} value={`${((api.scans || 22400) / 1000).toFixed(1)}k`} delta={kpis.scansDelta} tone="good" />
        <StatCard label={kpis.validInvalid} value={`${api.validRate ?? 98.8} / ${api.invalidRate ?? 1.2}`} delta={kpis.validInvalidDelta} tone="good" />
        <StatCard label={kpis.duplicates} value={String(api.duplicates ?? 202)} delta={kpis.duplicatesDelta} tone="warn" />
        <StatCard label={kpis.tamper} value={String(api.tamper ?? 32)} delta={kpis.tamperDelta} tone="warn" />
        <StatCard label={extra.activeBatches} value={String(api.activeBatches ?? 68)} delta={extra.activeBatchesDelta} tone="good" />
        <StatCard label={extra.activeTenants} value={String(api.activeTenants ?? 27)} delta={extra.activeTenantsDelta} tone="good" />
        <StatCard label={extra.resellerPerformance} value={`USD ${(api.resellerPerformance ?? 40200).toLocaleString()}`} delta={extra.resellerPerformanceDelta} tone="good" />
        <StatCard label={extra.geoDistribution} value={`${api.geoRegions ?? 8} regions`} delta={extra.geoDistributionDelta} />
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

      <DemoOpsMap points={(data?.geoPoints || []).map((point) => ({
        city: point.city,
        country: point.country || "--",
        lat: point.lat,
        lng: point.lng,
        scans: point.scans || 1,
        risk: point.risk || 0,
      }))} />
    </div>
  );
}
