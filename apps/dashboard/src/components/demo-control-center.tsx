"use client";

import { useState } from "react";
import { productUrls } from "@product/config";

const DEMO_SUPPLIER_UIDS = [
  "0487856A0B1090",
  "048A876A0B1090",
  "0483846A0B1090",
  "047F846A0B1090",
  "047B846A0B1090",
  "0477846A0B1090",
  "0474856A0B1090",
  "0470856A0B1090",
  "0483826A0B1090",
  "0465846A0B1090",
];

async function post(path: string, payload?: unknown) {
  const res = await fetch(`/api/internal/demo${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return res.json();
}

export function DemoControlCenter() {
  const [output, setOutput] = useState("Ready.");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post("/seed"), null, 2))}>Seed Bodega Balmec</button>
        <button suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={() => setOutput("Reset Demo: run pnpm demo:demobodega after db reset.")}>Reset Demo</button>
        <button suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post("/scan", { bid: "DEMO-2026-02", uidHex: DEMO_SUPPLIER_UIDS[0], deviceLabel: "iPhone 15 Pro - Mendoza", city: "Mendoza", countryCode: "AR", lat: -32.8895, lng: -68.8458, action: "verify" }), null, 2))}>Simulate 1 valid scan</button>
        <button suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => {
          const responses = await Promise.all(DEMO_SUPPLIER_UIDS.map((uidHex) => post("/scan", { bid: "DEMO-2026-02", uidHex, action: "verify", city: "Mendoza", countryCode: "AR" })));
          setOutput(JSON.stringify(responses, null, 2));
        }}>Simulate 10 live scans</button>
        <button suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post("/scan", { bid: "DEMO-2026-02", uidHex: DEMO_SUPPLIER_UIDS[0], action: "retail_scan", city: "San Martin", countryCode: "AR" }), null, 2))}>Simulate replay attack</button>
        <button suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post("/scan", { bid: "DEMO-2026-02", uidHex: DEMO_SUPPLIER_UIDS[9], action: "uncork", city: "Mendoza", countryCode: "AR" }), null, 2))}>Simulate tamper alert</button>
        <a href="/analytics" className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">Open live map</a>
        <a href={productUrls.web} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">Open mobile preview</a>
      </div>
      <pre className="overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{output}</pre>
    </div>
  );
}
