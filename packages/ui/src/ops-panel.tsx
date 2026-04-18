import * as React from "react";
import { Card } from "./card";

export function OpsPanel({
  title,
  subtitle,
  right,
  className = "",
  children,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}>) {
  return (
    <Card className={`p-5 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
