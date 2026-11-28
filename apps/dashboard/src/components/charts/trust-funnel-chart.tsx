"use client";

import { ChartEmptyState, useReducedMotion } from "./chart-utils";

export type TrustFunnelPoint = { stage: string; value: number };

const BARS = ["from-cyan-400 to-sky-500", "from-emerald-400 to-teal-500", "from-indigo-400 to-violet-500", "from-amber-300 to-orange-400"];

/**
 * Horizontal step funnel: each stage is a bar proportional to the first stage,
 * with its value and the conversion from the previous step. Pure HTML so it
 * reads well in light and dark themes and on narrow screens.
 */
export function TrustFunnelChart({ data }: { data: TrustFunnelPoint[] }) {
  const reducedMotion = useReducedMotion();
  const top = data.length ? Math.max(1, data[0].value) : 1;
  return (
    <div className="min-h-40" aria-label="Embudo de lecturas" role="img">
      {!data.length ? <ChartEmptyState message="Sin embudo de confianza para el rango seleccionado." /> : (
        <ol className="space-y-3" data-testid="trust-funnel-steps">
          {data.map((entry, index) => {
            const share = Math.max(2, Math.round((entry.value / top) * 100));
            const previous = index > 0 ? data[index - 1].value : null;
            const conversion = previous ? Math.round((entry.value / previous) * 100) : null;
            return (
              <li key={entry.stage}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-300">{entry.stage}</span>
                  <span className="tabular-nums text-slate-400">
                    <b className="text-sm text-slate-200">{entry.value.toLocaleString("es-AR")}</b>
                    {conversion !== null ? <> · {conversion}% del paso anterior</> : null}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-700/30">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${BARS[index % BARS.length]} ${reducedMotion ? "" : "transition-[width] duration-700 ease-out"}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
