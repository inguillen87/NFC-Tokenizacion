"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@product/ui";

type LifecycleState =
  | "inactive"
  | "active"
  | "suspended"
  | "quarantined"
  | "lost"
  | "expired"
  | "broken"
  | "tampered"
  | "revoked";

type LifecycleTag = {
  id: string;
  uid: string;
  bid: string;
  operational_status: string;
  lifecycle_state: LifecycleState;
  lifecycle_revision: number;
  lifecycle_reason: string | null;
  lifecycle_updated_at: string | null;
  risk_level: string;
  allowed_transitions: LifecycleState[];
  evidence_boundary: string;
};

type LifecycleHistory = {
  id: string;
  previous_state: LifecycleState;
  next_state: LifecycleState;
  lifecycle_revision: number;
  reason: string;
  actor_email: string | null;
  created_at: string;
};

const LABEL: Record<LifecycleState, string> = {
  inactive: "Inactivo",
  active: "Activo",
  suspended: "Suspendido",
  quarantined: "En cuarentena",
  lost: "Reportado perdido",
  expired: "Vencido",
  broken: "Dañado",
  tampered: "Manipulación administrativa",
  revoked: "Revocado (final)",
};

function safeMessage(value: unknown) {
  const reason = String(value || "tag_lifecycle_request_failed");
  const known: Record<string, string> = {
    tag_lifecycle_migration_required: "El esquema de lifecycle todavía no fue aplicado. La operación queda bloqueada.",
    tag_lifecycle_revision_conflict: "Otro operador modificó este tag. Recargá el estado antes de decidir.",
    tag_lifecycle_idempotency_conflict: "La clave de idempotencia ya pertenece a otra operación.",
    tag_lifecycle_supplier_activation_gate_failed: "El lote no superó manifiesto, conteo y QA de proveedor.",
    tag_lifecycle_batch_not_active: "El lote no está habilitado para activar tags.",
  };
  return known[reason] || reason;
}

function operationKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `tag-lifecycle:${crypto.randomUUID()}`;
  return `tag-lifecycle:${Date.now().toString(36)}`;
}

export function TagLifecyclePanel({
  uid,
  tenantSlug,
  canWrite,
}: {
  uid: string;
  tenantSlug: string | null;
  canWrite: boolean;
}) {
  const [tag, setTag] = useState<LifecycleTag | null>(null);
  const [history, setHistory] = useState<LifecycleHistory[]>([]);
  const [availability, setAvailability] = useState<"loading" | "ready" | "unavailable">("loading");
  const [nextState, setNextState] = useState<LifecycleState | "">("");
  const [reason, setReason] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(() => {
    const query = new URLSearchParams();
    if (tenantSlug) query.set("tenant", tenantSlug);
    const suffix = query.toString();
    return `/api/admin/tags/${encodeURIComponent(uid)}/status${suffix ? `?${suffix}` : ""}`;
  }, [tenantSlug, uid]);

  const refresh = useCallback(async () => {
    if (!tenantSlug) {
      setAvailability("unavailable");
      setError("Seleccioná un tenant para consultar y gobernar el lifecycle.");
      return;
    }
    setAvailability("loading");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json().catch(() => ({ ok: false, reason: `http_${response.status}` })) as Record<string, any>;
      if (!response.ok || payload.ok !== true || !payload.tag) throw new Error(safeMessage(payload.reason));
      const current = payload.tag as LifecycleTag;
      setTag(current);
      setHistory(Array.isArray(payload.history) ? payload.history as LifecycleHistory[] : []);
      setNextState(current.allowed_transitions?.[0] || "");
      setAvailability("ready");
      setError("");
    } catch (cause) {
      setAvailability("unavailable");
      setError(cause instanceof Error ? cause.message : "tag_lifecycle_read_failed");
    }
  }, [endpoint, tenantSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function transition() {
    if (!canWrite || !tag || !tenantSlug || !nextState || reason.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "idempotency-key": operationKey(),
        },
        body: JSON.stringify({
          tenant: tenantSlug,
          lifecycle_state: nextState,
          expected_revision: tag.lifecycle_revision,
          reason: reason.trim(),
          evidence: evidenceNote.trim() ? { operator_note: evidenceNote.trim() } : {},
        }),
      });
      const payload = await response.json().catch(() => ({ ok: false, reason: `http_${response.status}` })) as Record<string, any>;
      if (!response.ok || payload.ok !== true) throw new Error(safeMessage(payload.reason));
      setReason("");
      setEvidenceNote("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "tag_lifecycle_transition_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5" data-testid="tag-lifecycle-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Lifecycle administrativo auditable</p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Este estado puede bloquear un NFC ya verificado. No modifica las claves, el CMAC/SDM, el contador SUN ni reemplaza la evidencia física TagTamper.
          </p>
        </div>
        {tag ? (
          <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
            {LABEL[tag.lifecycle_state]} · rev. {tag.lifecycle_revision}
          </span>
        ) : null}
      </div>

      {availability === "loading" ? <p className="mt-4 text-sm text-slate-400">Consultando estado canónico…</p> : null}
      {availability === "unavailable" ? (
        <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p>No se puede confirmar el lifecycle: {error || "fuente no disponible"}</p>
          <button type="button" onClick={() => void refresh()} className="mt-3 rounded-lg border border-rose-200/30 px-3 py-1.5 text-xs font-bold">Reintentar</button>
        </div>
      ) : null}

      {availability === "ready" && tag ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-xs text-slate-400">Estado operativo<br /><b className="text-sm text-white">{tag.operational_status}</b></div>
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-xs text-slate-400">Riesgo administrativo<br /><b className="text-sm text-white">{tag.risk_level}</b></div>
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-xs text-slate-400">Última razón<br /><b className="text-sm text-white">{tag.lifecycle_reason || "Sin transición registrada"}</b></div>
          </div>

          {canWrite && tag.allowed_transitions.length ? (
            <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-slate-950/55 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-300">Próximo estado
                  <select value={nextState} onChange={(event) => setNextState(event.target.value as LifecycleState)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white">
                    {tag.allowed_transitions.map((state) => <option key={state} value={state}>{LABEL[state]}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-300">Referencia de evidencia (opcional)
                  <input value={evidenceNote} maxLength={500} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Ticket, inspección o acta" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                </label>
              </div>
              <label className="block text-xs text-slate-300">Razón obligatoria
                <textarea value={reason} maxLength={1000} rows={3} onChange={(event) => setReason(event.target.value)} placeholder="Explicá la decisión para el historial inmutable." className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
              </label>
              {error ? <p className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100" role="alert">No se pudo registrar: {error}</p> : null}
              <button type="button" disabled={busy || !nextState || reason.trim().length < 3} onClick={() => void transition()} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Registrando…" : "Registrar transición auditable"}
              </button>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/55 p-3 text-xs text-slate-400">
              {tag.lifecycle_state === "revoked" ? "Revocado es un estado final; no se permite reactivar este UID." : "Tu sesión tiene acceso de lectura al lifecycle."}
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-950/65 text-slate-400"><tr><th className="px-3 py-2">Revisión</th><th className="px-3 py-2">Transición</th><th className="px-3 py-2">Razón</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Fecha</th></tr></thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/5 text-slate-200">
                    <td className="px-3 py-2">{entry.lifecycle_revision}</td>
                    <td className="px-3 py-2">{LABEL[entry.previous_state]} → {LABEL[entry.next_state]}</td>
                    <td className="px-3 py-2">{entry.reason}</td>
                    <td className="px-3 py-2">{entry.actor_email || "actor registrado"}</td>
                    <td className="px-3 py-2">{new Date(entry.created_at).toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!history.length ? <p className="p-3 text-xs text-slate-400">Sin transiciones administrativas todavía.</p> : null}
          </div>
        </>
      ) : null}
    </Card>
  );
}
