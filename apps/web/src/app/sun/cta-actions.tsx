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
  const [pending, setPending] = useState(false);

  const trigger = async (path: string, method: "POST" | "GET") => {
    setPending(true);
    const data = await call(path, method, { bid, uid });
    setStatus(JSON.stringify(data));
    setPending(false);
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="grid gap-2 text-xs md:grid-cols-2">
        <button onClick={() => void trigger("/api/public-cta/claim-ownership", "POST")} className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-left text-cyan-100">✅ Activar ownership</button>
        <button onClick={() => void trigger("/api/public-cta/register-warranty", "POST")} className="rounded-xl border border-violet-300/40 bg-violet-500/10 px-3 py-2 text-left text-violet-100">🛡️ Registrar garantía</button>
        <button onClick={() => void trigger("/api/public-cta/provenance", "GET")} className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-left text-amber-100">📜 Ver provenance</button>
        <button onClick={() => void trigger("/api/public-cta/tokenize-request", "POST")} className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-left text-emerald-100">✨ Tokenización opcional</button>
      </div>
      {pending ? <p className="text-xs text-cyan-200">Ejecutando acción...</p> : null}
      {status ? <pre className="overflow-x-auto rounded border border-white/10 bg-slate-950/70 p-2 text-[11px] text-slate-200">{status}</pre> : null}
    </div>
  );
}
