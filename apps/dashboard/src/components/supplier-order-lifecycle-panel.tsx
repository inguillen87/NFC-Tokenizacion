"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@product/ui";
import { CheckCircle2, Send, ShieldCheck } from "lucide-react";

type SupplierLifecycleSubBatch = {
  bid?: string;
  manifest_status?: string;
  qa_status?: string;
  status?: string;
  manufacturing_state?: string;
  key_export_count?: number;
  activated_at?: string | null;
};

type SupplierOrderLifecyclePanelProps = {
  orderId: string;
  orderStatus?: string | null;
  packPurpose?: string | null;
  sentToSupplierAt?: string | null;
  tenantHandoverRecordedAt?: string | null;
  subBatches: SupplierLifecycleSubBatch[];
  canManage: boolean;
  mfaVerified: boolean;
};

type LifecycleDraft = {
  recipientRef: string;
  deliveryChannel: string;
  evidenceRef: string;
  reason: string;
};

const EMPTY_DRAFT: LifecycleDraft = {
  recipientRef: "",
  deliveryChannel: "secure_transfer",
  evidenceRef: "",
  reason: "",
};

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validDraft(draft: LifecycleDraft) {
  return draft.recipientRef.trim().length >= 3
    && draft.evidenceRef.trim().length >= 3
    && draft.reason.trim().length >= 16;
}

function lifecycleGate(input: {
  packPurpose: string;
  subBatches: SupplierLifecycleSubBatch[];
}) {
  if (!input.subBatches.length) return "El pedido no tiene sub-batches autoritativos.";
  if (input.packPurpose === "legacy_unclassified") return "El propósito legacy debe clasificarse antes de cualquier handover.";
  const manifestReady = input.subBatches.every((row) => normalized(row.manifest_status) === "imported");
  const qaReady = input.subBatches.every((row) => normalized(row.qa_status) === "passed");
  if (!manifestReady || !qaReady) return "Todos los sub-batches deben tener manifiesto importado y QA aprobado.";
  if (input.packPurpose === "trial_integration") {
    const remainsInactive = input.subBatches.every((row) => !row.activated_at
      && !["activated", "partially_activated", "active"].includes(normalized(row.status)));
    return remainsInactive ? "" : "El trial es NON_SELLABLE y debe permanecer inactivo.";
  }
  if (input.packPurpose !== "production") return "Propósito comercial inválido.";
  const activationComplete = input.subBatches.every((row) => normalized(row.manufacturing_state) === "activated"
    && normalized(row.status) === "activated"
    && Boolean(row.activated_at));
  return activationComplete ? "" : "Producción requiere aceptación QA de dos actores y activación completa de cada sub-batch.";
}

export function SupplierOrderLifecyclePanel({
  orderId,
  orderStatus,
  packPurpose,
  sentToSupplierAt,
  tenantHandoverRecordedAt,
  subBatches,
  canManage,
  mfaVerified,
}: SupplierOrderLifecyclePanelProps) {
  const router = useRouter();
  const attempts = useRef(new Map<string, string>());
  const [sentDraft, setSentDraft] = useState<LifecycleDraft>({ ...EMPTY_DRAFT });
  const [handoverDraft, setHandoverDraft] = useState<LifecycleDraft>({ ...EMPTY_DRAFT, deliveryChannel: "tenant_portal" });
  const [pending, setPending] = useState<"mark_sent" | "record_tenant_handover" | null>(null);
  const [notice, setNotice] = useState("Cada transición exige evidencia, razón e idempotencia y queda en historial append-only.");
  const [localStatus, setLocalStatus] = useState(normalized(orderStatus));
  const [localSentAt, setLocalSentAt] = useState(sentToSupplierAt || "");
  const [localHandoverAt, setLocalHandoverAt] = useState(tenantHandoverRecordedAt || "");
  const effectivePurpose = normalized(packPurpose) || "legacy_unclassified";
  const packExportReady = subBatches.length > 0
    && subBatches.every((row) => Number(row.key_export_count || 0) === 1);
  const handoverGate = lifecycleGate({ packPurpose: effectivePurpose, subBatches });
  const sentRecorded = Boolean(localSentAt) || ["sent_to_supplier", "handed_over_to_tenant"].includes(localStatus);
  const handoverRecorded = Boolean(localHandoverAt) || localStatus === "handed_over_to_tenant";
  const sentBlockReason = !canManage
    ? "Solo superadmin puede registrar la entrega del pack al proveedor."
    : !mfaVerified
      ? "Esta transición de custodia exige una sesión superadmin con MFA verificado."
    : sentRecorded
      ? "El envío al proveedor ya fue registrado."
      : localStatus !== "pack_ready"
        ? `El pedido debe estar en pack_ready; estado actual: ${localStatus || "desconocido"}.`
      : !packExportReady
        ? "Primero debe existir exactamente un recibo de exportación por cada sub-batch."
        : !validDraft(sentDraft)
          ? "Completa destinatario, referencia de evidencia y una razón de al menos 16 caracteres."
          : "";
  const handoverBlockReason = !canManage
    ? "Solo superadmin puede registrar el handover operativo."
    : !mfaVerified
      ? "Esta transición de custodia exige una sesión superadmin con MFA verificado."
    : handoverRecorded
      ? "El handover al tenant ya fue registrado."
      : !sentRecorded
        ? "Primero registra el envío al proveedor."
        : handoverGate
          ? handoverGate
          : !validDraft(handoverDraft)
            ? "Completa destinatario, referencia de evidencia y una razón de al menos 16 caracteres."
            : "";

  async function transition(action: "mark_sent" | "record_tenant_handover", draft: LifecycleDraft) {
    const blockReason = action === "mark_sent" ? sentBlockReason : handoverBlockReason;
    if (blockReason) {
      setNotice(blockReason);
      return;
    }
    const payload = {
      transition: action,
      recipient_ref: draft.recipientRef.trim(),
      delivery_channel: draft.deliveryChannel,
      evidence_ref: draft.evidenceRef.trim(),
      reason: draft.reason.trim(),
    };
    const signature = JSON.stringify(payload);
    let operationKey = attempts.current.get(signature);
    if (!operationKey) {
      operationKey = `supplier-lifecycle:${crypto.randomUUID()}`;
      attempts.current.set(signature, operationKey);
    }
    setPending(action);
    setNotice(action === "mark_sent" ? "Registrando despacho cifrado al proveedor…" : "Registrando handover operativo al tenant…");
    try {
      const response = await fetch(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": operationKey },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as {
        ok?: boolean;
        reason?: string;
        message?: string;
        receipt?: { to_status?: string; created_at?: string; idempotent_replay?: boolean };
      };
      if (!response.ok || data.ok !== true || !data.receipt) {
        throw new Error(data.message || data.reason || "supplier_order_lifecycle_failed");
      }
      attempts.current.delete(signature);
      setLocalStatus(normalized(data.receipt.to_status));
      if (action === "mark_sent") setLocalSentAt(data.receipt.created_at || new Date().toISOString());
      else setLocalHandoverAt(data.receipt.created_at || new Date().toISOString());
      setNotice(`${data.message || "Transición registrada."}${data.receipt.idempotent_replay ? " Reintento idempotente confirmado." : ""}`);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo registrar la transición.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/75 p-5" data-testid="supplier-order-lifecycle-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Custody handoff</p>
          <h2 className="mt-1 text-xl font-black text-white">Proveedor → nexID → tenant, sin CLI</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Registra referencias de entrega y hashes auditables. No pegues passwords del pack, K_META, K_FILE ni secretos. Un handover registrado no prueba recepción física ni aceptación contractual y nunca reemplaza QA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
          <span className="rounded-full border border-white/10 px-3 py-1 text-slate-200">{localStatus || "pack_ready"}</span>
          <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-amber-100">{effectivePurpose === "trial_integration" ? "NON_SELLABLE" : effectivePurpose}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <LifecycleForm
          title="1 · Marcar enviado al proveedor"
          description="Disponible sólo después de la exportación one-time de todos los sub-batches. Registra el despacho, no confirma que la fábrica lo haya recibido ni codificado correctamente."
          draft={sentDraft}
          setDraft={setSentDraft}
          formDisabled={!canManage || pending !== null || sentRecorded}
          actionDisabled={pending !== null || Boolean(sentBlockReason)}
          blockReason={sentBlockReason}
          actionLabel={pending === "mark_sent" ? "Registrando…" : "Registrar envío al proveedor"}
          icon="send"
          onSubmit={() => void transition("mark_sent", sentDraft)}
        />
        <LifecycleForm
          title="2 · Registrar handover al tenant"
          description={effectivePurpose === "trial_integration"
            ? "Entrega el resultado del trial con disposición NON_SELLABLE; los tags deben seguir inactivos."
            : "Exige manifiesto, QA de producción con separación de actores y activación completa. Registra entrega operativa, no aceptación contractual."}
          draft={handoverDraft}
          setDraft={setHandoverDraft}
          formDisabled={!canManage || pending !== null || handoverRecorded}
          actionDisabled={pending !== null || Boolean(handoverBlockReason)}
          blockReason={handoverBlockReason}
          actionLabel={pending === "record_tenant_handover" ? "Registrando…" : "Registrar handover al tenant"}
          icon="shield"
          onSubmit={() => void transition("record_tenant_handover", handoverDraft)}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <LifecycleMetric label="Pack exportado" value={packExportReady ? "sí · 1x por BID" : "pendiente"} />
        <LifecycleMetric label="Envío proveedor" value={localSentAt ? new Date(localSentAt).toLocaleString("es-AR") : "pendiente"} />
        <LifecycleMetric label="Handover tenant" value={localHandoverAt ? new Date(localHandoverAt).toLocaleString("es-AR") : "pendiente"} />
      </div>
      <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-50" role="status">{notice}</p>
    </section>
  );
}

function LifecycleForm({
  title,
  description,
  draft,
  setDraft,
  formDisabled,
  actionDisabled,
  blockReason,
  actionLabel,
  icon,
  onSubmit,
}: {
  title: string;
  description: string;
  draft: LifecycleDraft;
  setDraft: (value: LifecycleDraft) => void;
  formDisabled: boolean;
  actionDisabled: boolean;
  blockReason: string;
  actionLabel: string;
  icon: "send" | "shield";
  onSubmit: () => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-white/10 bg-slate-950/60 p-4" disabled={formDisabled}>
      <legend className="px-1 text-sm font-black text-white">{title}</legend>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <LifecycleInput label="Destinatario / área" value={draft.recipientRef} placeholder="Factory QA desk o Calidad tenant" onChange={(recipientRef) => setDraft({ ...draft, recipientRef })} />
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Canal</span>
          <select className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" value={draft.deliveryChannel} onChange={(event) => setDraft({ ...draft, deliveryChannel: event.target.value })}>
            <option value="secure_transfer">Transferencia segura</option>
            <option value="tenant_portal">Portal tenant</option>
            <option value="courier">Courier</option>
            <option value="email_notice">Aviso por email</option>
            <option value="in_person">Entrega presencial</option>
            <option value="other">Otro canal documentado</option>
          </select>
        </label>
      </div>
      <div className="mt-3 space-y-3">
        <LifecycleInput label="Referencia de evidencia" value={draft.evidenceRef} placeholder="artifact://…, tracking o ticket interno; nunca secretos" onChange={(evidenceRef) => setDraft({ ...draft, evidenceRef })} />
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Razón auditada</span>
          <textarea className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" minLength={16} maxLength={1000} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
        </label>
      </div>
      <Button type="button" className="mt-3 gap-2" disabled={actionDisabled} title={blockReason || actionLabel} onClick={onSubmit}>
        {icon === "send" ? <Send className="h-4 w-4" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        {actionLabel}
      </Button>
      {blockReason ? <p className="mt-2 text-xs leading-5 text-amber-100">{blockReason}</p> : <p className="mt-2 flex items-center gap-2 text-xs text-emerald-100"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Gate local listo; el backend vuelve a validar bajo lock.</p>}
    </fieldset>
  );
}

function LifecycleInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function LifecycleMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs"><span className="block uppercase tracking-[0.12em] text-slate-500">{label}</span><b className="mt-1 block text-white">{value}</b></div>;
}
