"use client";

import { useState } from "react";

type Props = { apiBase: string; bid: string; uid: string; share: string };

async function call(apiBase: string, path: string, method: "POST" | "GET", payload: Record<string, unknown> | null, share: string) {
  const url = new URL(path, apiBase);
  url.searchParams.set("share", share);
  if (method === "GET" && payload) {
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload || {}) : undefined,
  });
  return res.json();
}

export function CtaActions({ apiBase, bid, uid, share }: Props) {
  const [status, setStatus] = useState<string>("");

  const trigger = async (path: string, method: "POST" | "GET") => {
    const data = await call(apiBase, path, method, { bid, uid }, share);
    setStatus(JSON.stringify(data));
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={() => void trigger("/public/cta/claim-ownership", "POST")} className="rounded border border-cyan-300/40 px-2 py-1">Activar ownership</button>
        <button onClick={() => void trigger("/public/cta/register-warranty", "POST")} className="rounded border border-cyan-300/40 px-2 py-1">Registrar garantía</button>
        <button onClick={() => void trigger("/public/cta/provenance", "GET")} className="rounded border border-cyan-300/40 px-2 py-1">Ver provenance</button>
        <button onClick={() => void trigger("/public/cta/tokenize-request", "POST")} className="rounded border border-cyan-300/40 px-2 py-1">Tokenización opcional</button>
      </div>
      {status ? <pre className="overflow-x-auto rounded border border-white/10 bg-slate-950/70 p-2 text-[11px] text-slate-200">{status}</pre> : null}
    </div>
  );
}