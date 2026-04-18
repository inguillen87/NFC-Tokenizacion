import * as React from "react";

export function FilterBar({ children, className = "", contentClassName = "md:grid-cols-6" }: React.PropsWithChildren<{ className?: string; contentClassName?: string }>) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/60 p-3 ${className}`.trim()}>
      <div className={`grid gap-3 ${contentClassName}`}>{children}</div>
    </div>
  );
}
