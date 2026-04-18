import * as React from "react";

export function Card({ className = "", children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-xl ${className}`} {...props}>
      {children}
    </div>
  );
}
