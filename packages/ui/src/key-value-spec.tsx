import * as React from "react";

type Item = { label: string; value: React.ReactNode };

export function KeyValueSpec({ items, columns = 2 }: { items: Item[]; columns?: 1 | 2 | 3 }) {
  const gridClass = columns === 1 ? "md:grid-cols-1" : columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <div className={`grid gap-2 text-sm text-slate-200 ${gridClass}`}>
      {items.map((item) => (
        <p key={item.label}>{item.label}: <b>{item.value}</b></p>
      ))}
    </div>
  );
}
