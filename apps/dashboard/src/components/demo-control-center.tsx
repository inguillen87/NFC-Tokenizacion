"use client";

import { useState } from "react";

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
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post('/seed'), null, 2))}>Seed Demo Bodega</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={() => setOutput('Reset Demo: run pnpm demo:demobodega after db reset.')}>Reset Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post('/scan', { bid: 'DEMO-2026-02', uidHex: '04B7723410E2AD', deviceLabel: 'iPhone 15 Pro - Mendoza', city: 'Mendoza', countryCode: 'AR', lat: -32.8895, lng: -68.8458, action: 'verify' }), null, 2))}>Simulate 1 valid scan</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => {
          const uid = ['04B7723410E2AD','04B7723410E2AE','04B7723410E2AF','04B7723410E2B0','04B7723410E2B1','04B7723410E2B2','04B7723410E2B3','04B7723410E2B4','04B7723410E2B5','04B7723410E2B6'];
          const responses = await Promise.all(uid.map((u) => post('/scan', { bid: 'DEMO-2026-02', uidHex: u, action: 'verify', city: 'Mendoza', countryCode: 'AR' })));
          setOutput(JSON.stringify(responses, null, 2));
        }}>Simulate 10 live scans</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post('/scan', { bid: 'DEMO-2026-02', uidHex: '04B7723410E2AD', action: 'retail_scan', city: 'São Paulo', countryCode: 'BR' }), null, 2))}>Simulate replay attack</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-left text-sm text-white" onClick={async () => setOutput(JSON.stringify(await post('/scan', { bid: 'DEMO-2026-02', uidHex: '04B7723410E2AE', action: 'uncork', city: 'Mendoza', countryCode: 'AR' }), null, 2))}>Simulate tamper alert</button>
        <a href="/analytics" className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">Open live map</a>
        <a href={`${process.env.NEXT_PUBLIC_WEB_BASE_URL || 'http://localhost:3001'}`} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">Open mobile preview</a>
      </div>
      <pre className="overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{output}</pre>
    </div>
  );
}
