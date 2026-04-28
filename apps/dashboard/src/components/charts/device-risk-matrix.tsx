"use client";

type DeviceSignal = { device: string; scans: number; countries: number; validRate: number; risk: number };

function tone(value: number) {
  if (value >= 8) return "bg-rose-500/25 text-rose-100";
  if (value >= 5) return "bg-amber-500/20 text-amber-100";
  return "bg-emerald-500/15 text-emerald-100";
}

export function DeviceRiskMatrix({ rows }: { rows: DeviceSignal[] }) {
  return (
    <div className="overflow-auto" aria-label="Device risk matrix">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="px-2 py-2">Device</th>
            <th className="px-2 py-2">Scans</th>
            <th className="px-2 py-2">Countries</th>
            <th className="px-2 py-2">Valid rate</th>
            <th className="px-2 py-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          {(rows.length ? rows : [{ device: "unknown", scans: 0, countries: 0, validRate: 0, risk: 0 }]).slice(0, 12).map((row) => (
            <tr key={row.device} className="border-t border-white/10 text-slate-200">
              <td className="px-2 py-2">{row.device}</td>
              <td className="px-2 py-2">{row.scans}</td>
              <td className="px-2 py-2">{row.countries}</td>
              <td className="px-2 py-2">{row.validRate.toFixed(1)}%</td>
              <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 ${tone(row.risk)}`}>{row.risk}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
