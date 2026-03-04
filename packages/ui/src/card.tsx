import * as React from "react";

export function Card({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}
