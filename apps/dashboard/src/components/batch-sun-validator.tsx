"use client";

import { useState } from "react";
import { Button } from "@product/ui";

type ValidationResult = {
  ok?: boolean;
  reason?: string;
  latency_ms?: number;
  tag_status?: string | null;
  batch_status?: string | null;
  status_code?: number;
};

function mapFriendlyStatus(result: ValidationResult) {
  const reason = String(result.reason || "").toLowerCase();
  const tagStatus = String(result.tag_status || "").toUpperCase();
  if (reason.includes("unknown batch")) return "UNKNOWN_BATCH";
  if (tagStatus === "NOT_REGISTERED" || reason.includes("not registered")) return "NOT_REGISTERED";
  if (tagStatus === "NOT_ACTIVE" || reason.includes("not active")) return "NOT_ACTIVE";
  if (tagStatus === "REPLAY_SUSPECT" || reason.includes("replay")) return "REPLAY_SUSPECT";
  if (result.ok || tagStatus === "VALID") return "VALID";
  return "INVALID";
}

export function BatchSunValidator({ bid }: { bid: string }) {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Pegá URL SUN del proveedor y validá para confirmar estado real del lote/tag.");
  const [output, setOutput] = useState("{}");

  async function validateNow() {
    setPending(true);
    setStatus("Validando...");
    try {
      const response = await fetch("/api/admin/sun/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as ValidationResult;
      const friendly = mapFriendlyStatus(data);
      setOutput(JSON.stringify({ friendly_status: friendly, ...data }, null, 2));
      setStatus(`Resultado: ${friendly}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-white">Supplier sample URL validator</p>
      <textarea suppressHydrationWarning
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Pegá una URL /sun recién escaneada desde una tag física"
        className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => void validateNow()} disabled={pending}>{pending ? "Validando..." : "Validate /sun"}</Button>
        <span className="text-xs text-slate-300">{status}</span>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-cyan-200">{output}</pre>
    </div>
  );
}
