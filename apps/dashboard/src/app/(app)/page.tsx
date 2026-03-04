import { StatCard, WorldMapPlaceholder } from "@product/ui";
import { OverviewChart } from "../_components/overview-chart";
import { EventTable } from "../_components/event-table";

export default function DashboardHome() {
  return (
    <main className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active tags" value="1.2M" delta="+8.4% vs mes anterior" />
        <StatCard label="Valid scans" value="92.4%" delta="ultimo periodo" tone="good" />
        <StatCard label="Fraud alerts" value="842" delta="duplicate + replay + tamper" tone="danger" />
        <StatCard label="Resellers" value="14" delta="3 nuevos en pipeline" tone="warn" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="text-lg font-semibold text-white">Scan throughput</div>
          <p className="mt-1 text-sm text-slate-400">Placeholder chart para v1 dashboard.</p>
          <div className="mt-6"><OverviewChart /></div>
        </div>
        <WorldMapPlaceholder />
      </div>
      <EventTable />
    </main>
  );
}
