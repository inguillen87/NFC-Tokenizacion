"use client";

import { useState } from "react";
import { Button, Card } from "@product/ui";

const BATCH_STATES = [
  "draft",
  "production_registered",
  "active_in_market",
  "deprecating",
  "archived",
] as const;

type BatchLifecycleControlProps = {
  bid: string;
  currentState: string;
  canManageLifecycle: boolean;
  canRevoke: boolean;
};

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { reason: text };
  }
}

export function BatchLifecycleControl({
  bid,
  currentState,
  canManageLifecycle,
  canRevoke,
}: BatchLifecycleControlProps) {
  const [state, setState] = useState(currentState || "draft");
  const [nextState, setNextState] = useState(currentState || "draft");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function updateLifecycle() {
    if (!canManageLifecycle || pending || nextState === state) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/batches/${encodeURIComponent(bid)}/state`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": `dashboard-batch-state:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ state: nextState }),
      });
      const payload = await responsePayload(response);
      if (!response.ok || payload.ok === false) {
        throw new Error(String(payload.message || payload.reason || `HTTP ${response.status}`));
      }
      setState(nextState);
      setMessage(`Estado actualizado a ${nextState}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setPending(false);
    }
  }

  async function revokeBatch() {
    if (!canRevoke || pending) return;
    if (!window.confirm("¿Confirmás la revocación del lote? Impactará validaciones activas.")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/batches/${encodeURIComponent(bid)}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "dashboard_batch_detail" }),
      });
      const payload = await responsePayload(response);
      if (!response.ok || payload.ok === false) {
        throw new Error(String(payload.message || payload.reason || `HTTP ${response.status}`));
      }
      setState("revoked");
      setNextState("revoked");
      setMessage("Lote revocado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo revocar el lote.");
    } finally {
      setPending(false);
    }
  }

  if (!canManageLifecycle && !canRevoke) return null;

  return (
    <Card className="p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Gobierno del lote</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {canManageLifecycle ? (
          <label className="grid min-w-64 gap-2 text-xs text-slate-300">
            Estado controlado
            <select
              suppressHydrationWarning
              value={nextState}
              disabled={pending || state === "revoked"}
              onChange={(event) => setNextState(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {BATCH_STATES.map((value) => <option key={value} value={value}>{value}</option>)}
              {state === "revoked" ? <option value="revoked">revoked</option> : null}
            </select>
            <Button disabled={pending || state === "revoked" || nextState === state} onClick={() => void updateLifecycle()}>
              Aplicar transición
            </Button>
          </label>
        ) : null}
        {canRevoke ? (
          <Button disabled={pending || state === "revoked"} variant="secondary" onClick={() => void revokeBatch()}>
            Revocar lote
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-400">Estado efectivo: <b className="text-white">{state}</b></p>
      {message ? <p aria-live="polite" className="mt-2 text-xs text-cyan-100">{message}</p> : null}
    </Card>
  );
}
