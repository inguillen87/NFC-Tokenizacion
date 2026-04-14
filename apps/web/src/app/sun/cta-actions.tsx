"use client";

import { useState } from "react";

type Props = { bid: string; uid: string };

async function call(path: string, method: "POST" | "GET", payload: Record<string, unknown> | null) {
  const url = new URL(path, window.location.origin);
  if (method === "GET" && payload) {
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
  });
  return res.json().catch(() => ({ ok: false, reason: "invalid json" }));
}

export function CtaActions({ bid, uid }: Props) {
  const [status, setStatus] = useState<string>("");

  const trigger = async (path: string, method: "POST" | "GET") => {
    const data = await call(path, method, { bid, uid });
    setStatus(JSON.stringify(data));
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={() => void trigger("/api/public-cta/claim-ownership", "POST")} className="rounded border border-cyan-300/40 px-2 py-1">Activar ownership</button>
        <button onClick={() => void trigger("/api/public-cta/register-warranty", "POST")} className="rounded border border-cyan-300/40 px-2 py-1">Registrar garantía</button>
        <button onClick={() => void trigger("/api/public-cta/provenance", "GET")} className="rounded border border-cyan-300/40 px-2 py-1">Ver provenance</button>
        <button onClick={() => void trigger("/api/public-cta/tokenize-request", "POST")} className="rounded border border-cyan-300/40 px-2 py-1">Tokenización opcional</button>
      </div>
      {status ? <pre className="overflow-x-auto rounded border border-white/10 bg-slate-950/70 p-2 text-[11px] text-slate-200">{status}</pre> : null}
    </div>
  );
}
