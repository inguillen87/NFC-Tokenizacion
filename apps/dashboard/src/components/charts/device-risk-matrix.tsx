"use client";

type DeviceSignal = { device: string; scans: number; countries: number; validRate: number; risk: number };

function tone(value: number) {
  if (value >= 8) return "bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]";
  if (value >= 5) return "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.12)]";
  return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";
}

export function DeviceRiskMatrix({ rows }: { rows: DeviceSignal[] }) {
  return (
    <div className="overflow-auto border border-white/5 rounded-2xl bg-slate-950/40 p-1" aria-label="Device risk matrix">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-4 py-3">Dispositivo / Agente</th>
            <th className="px-4 py-3 text-right">Escaneos</th>
            <th className="px-4 py-3 text-right">Países</th>
            <th className="px-4 py-3 text-right">Tasa Válida</th>
            <th className="px-4 py-3 text-center">Nivel Riesgo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {(rows.length ? rows : [{ device: "Sin datos", scans: 0, countries: 0, validRate: 0, risk: 0 }]).slice(0, 12).map((row) => (
            <tr key={row.device} className="text-slate-300 hover:bg-white/[0.015] transition-colors duration-150">
              <td className="px-4 py-3 font-mono text-[11px] text-slate-200 font-medium max-w-[180px] truncate" title={row.device}>
                {row.device}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-100">{row.scans}</td>
              <td className="px-4 py-3 text-right text-slate-400">{row.countries}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-100">{row.validRate.toFixed(1)}%</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${tone(row.risk)}`}>
                  {row.risk}/10
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
