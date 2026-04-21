import * as React from "react";

export function DeviceSignatureBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full border border-indigo-300/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-100">{label}</span>;
}
