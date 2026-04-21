import * as React from "react";

export function EmptyState({ title, description, className = "" }: { title: string; description?: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 text-sm ${className}`.trim()}>
      <p className="font-medium text-slate-200">{title}</p>
      {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
    </div>
  );
}
