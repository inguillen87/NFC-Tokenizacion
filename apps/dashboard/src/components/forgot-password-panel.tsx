"use client";

import { useState } from "react";
import { Button } from "@product/ui";


export function ForgotPasswordPanel({ emailPlaceholder, actionLabel }: { emailPlaceholder: string; actionLabel: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  async function submit() {
    const res = await fetch(`/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    setToken(data?.resetToken || "");
    setMessage(data?.resetToken ? "Token generado. Compartilo por canal seguro o pegalo en Reset password." : "Si la cuenta existe, el reset quedó emitido.");
  }

  return (
    <div className="mt-6 grid gap-3">
      <input suppressHydrationWarning className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button className="w-full" onClick={submit}>{actionLabel}</Button>
      {message ? <p className="text-xs text-cyan-200">{message}</p> : null}
      {token ? <code className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{token}</code> : null}
    </div>
  );
}
