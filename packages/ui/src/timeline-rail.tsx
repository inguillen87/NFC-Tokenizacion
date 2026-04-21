import * as React from "react";

export type TimelineItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

export function TimelineRail({ items }: { items: TimelineItem[] }) {
  if (!items.length) return null;
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item.id} className="relative rounded-lg border border-white/10 bg-slate-900/60 p-3 pl-4 text-xs text-slate-300">
          <span className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-cyan-300/40" />
          <p className="font-semibold text-slate-100">{item.title}</p>
          {item.subtitle ? <p className="mt-1 text-slate-300">{item.subtitle}</p> : null}
          {item.meta ? <p className="mt-1 text-slate-400">{item.meta}</p> : null}
          {index < items.length - 1 ? <div className="mt-2 border-t border-white/5" /> : null}
        </li>
      ))}
    </ol>
  );
}
