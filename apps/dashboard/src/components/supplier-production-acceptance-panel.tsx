"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@product/ui";
import { ClipboardCheck, LockKeyhole, PlayCircle, RefreshCcw, ShieldCheck } from "lucide-react";

const PRODUCTION_ACCEPTANCE_SCHEMA = "supplier-production-acceptance/v2";
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const DEFECT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const SESSION_ACTIONS = new Set(["open_receiving_qa_session", "open_replacement_receiving_qa_session"]);
const PLAN_ACTIONS = new Set(["submit_tenant_quality_plan", "submit_revised_tenant_quality_plan"]);

type ProductionQaPlan = {
  id: string;
  revision: number;
  lot_size: number;
  inspection_level: string;
  target_aql: number;
  sample_size: number;
  accept_number: number;
  reject_number: number;
  policy_reference: string;
  policy_document_sha256: string;
  stratification_dimension: "roll_id" | "case_id" | "pallet_id";
  cryptographic_sample_size: number;
  plan_digest: string;
  submitted_at: string;
  decision_id: string | null;
  decision_status: "approved" | "rejected" | null;
  decision_reason: string | null;
  approval_evidence_ref: string | null;
  approval_evidence_sha256: string | null;
  approver_email: string | null;
  decided_at: string | null;
};

type ProductionQaSample = {
  tag_id: string;
  ordinal: number;
  uid_masked: string;
  uid_fingerprint: string;
  stratum_key: string;
  stratum_values: Record<string, unknown>;
  selection_rank: string;
  cryptographic_required: boolean;
};

type ProductionQaSession = {
  id: string;
  qa_plan_id: string;
  expires_at: string;
  sample_size: number;
  accept_number: number;
  reject_number: number;
  selection_digest: string;
  acceptance_context_digest: string;
  decision_id: string | null;
  decision_status: "passed" | "failed" | null;
  disposition: "ACCEPT" | "REJECT" | null;
  decided_at: string | null;
  samples: ProductionQaSample[];
};

type ProductionAcceptanceState = {
  schema_version: string;
  scope: {
    bid: string;
    expected_quantity: number;
    manifest_status: string;
    manifest_count: number;
    carrier_profile_code: string;
    key_export_count: number;
  };
  manufacturing_state: string;
  latest_plan: ProductionQaPlan | null;
  approved_plan: ProductionQaPlan | null;
  sessions: ProductionQaSession[];
  accepted_receipt: ProductionQaSession | null;
  permissions: {
    can_approve_tenant_quality_plan: boolean;
    approval_permission: string;
  };
  blockers: string[];
  next_action: string;
  activation_allowed: false;
  activation_contract: string;
  truth_notice: string;
};

type ProductionAcceptanceResponse = {
  ok: true;
  production_acceptance: ProductionAcceptanceState;
};

type SessionCeremony = {
  session_id: string;
  qa_plan_id: string;
  expires_at: string;
  challenge: string;
  challenge_hash: string;
  selection_seed_commitment: string;
  selection_digest: string;
  acceptance_context_digest: string;
  sample_size: number;
  accept_number: number;
  reject_number: number;
  samples: ProductionQaSample[];
};

type SessionResponse = {
  ok: true;
  session: SessionCeremony;
};

type FinalizeReceipt = {
  ok: true;
  schema_version: string;
  session_id: string;
  qa_status: "passed" | "failed";
  disposition: "ACCEPT" | "REJECT";
  observed_sample_count: number;
  nonconforming_count: number;
  evidence_digest: string;
  manufacturing_state: string;
  activation_allowed: false;
  activation_gate: string;
};

type PlanForm = {
  inspectionLevel: string;
  targetAql: string;
  sampleSize: string;
  acceptNumber: string;
  rejectNumber: string;
  policyReference: string;
  policyDocumentSha256: string;
  stratificationDimension: "" | "roll_id" | "case_id" | "pallet_id";
};

type DecisionForm = {
  decision: "" | "approved" | "rejected";
  reason: string;
  approvalEvidenceRef: string;
  approvalEvidenceSha256: string;
};

type ObservationDraft = {
  outcome: "" | "conforming" | "nonconforming";
  defectCodes: string;
};

const EMPTY_PLAN_FORM: PlanForm = {
  inspectionLevel: "",
  targetAql: "",
  sampleSize: "",
  acceptNumber: "",
  rejectNumber: "",
  policyReference: "",
  policyDocumentSha256: "",
  stratificationDimension: "",
};

const EMPTY_DECISION_FORM: DecisionForm = {
  decision: "",
  reason: "",
  approvalEvidenceRef: "",
  approvalEvidenceSha256: "",
};

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const record = payload as Record<string, unknown>;
  return String(record.message || record.reason || fallback).slice(0, 500);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: init?.body
      ? { "Content-Type": "application/json", ...(init.headers || {}) }
      : init?.headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload || typeof payload !== "object" || (payload as { ok?: unknown }).ok !== true) {
    throw new Error(errorMessage(payload, response.statusText || "No se pudo completar la operación."));
  }
  return payload as T;
}

function shortDigest(value: unknown) {
  const text = String(value || "");
  return text.length > 28 ? `${text.slice(0, 18)}…${text.slice(-8)}` : text || "pendiente";
}

function dateLabel(value: unknown) {
  const epoch = Date.parse(String(value || ""));
  return Number.isFinite(epoch) ? new Date(epoch).toLocaleString("es-AR") : "sin fecha";
}

function humanToken(value: string) {
  return value.replace(/_/g, " ");
}

function snapshotReferenceKey(value: string) {
  if (value.length > 4_096 || /[<>]/.test(value)) return null;
  try {
    const url = new URL(value);
    const forbiddenSunParameters = ["picc_data", "piccdata", "enc", "cmac", "ttstatus"];
    const snapshot = Number(url.searchParams.get("snapshot"));
    const trace = String(url.searchParams.get("trace") || "").trim();
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
    if (url.username || url.password || url.hash || forbiddenSunParameters.some((name) => url.searchParams.has(name))) return null;
    if (!Number.isSafeInteger(snapshot) || snapshot <= 0 || !/^[A-Za-z0-9._:-]{1,160}$/.test(trace)) return null;
    return `${snapshot}:${trace}`;
  } catch {
    return null;
  }
}

function parseSnapshotReferences(raw: string) {
  const values = raw.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
  const unique = new Map<string, string>();
  for (const value of values) {
    const key = snapshotReferenceKey(value);
    if (!key) return { ok: false as const, values: [] as string[], reason: "Hay una referencia de resultado inválida." };
    if (!unique.has(key)) unique.set(key, value);
  }
  if (unique.size > 60) {
    return { ok: false as const, values: [] as string[], reason: "El máximo es 60 referencias de resultado únicas." };
  }
  return { ok: true as const, values: [...unique.values()], reason: "" };
}

function parseDefectCodes(raw: string) {
  const values = raw.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
  const unique = [...new Set(values)].sort();
  if (unique.length > 20 || unique.some((value) => !DEFECT_CODE_PATTERN.test(value))) return null;
  return unique;
}

function validatePlan(form: PlanForm, lotSize: number) {
  const targetAqlText = form.targetAql.trim();
  const sampleSizeText = form.sampleSize.trim();
  const acceptNumberText = form.acceptNumber.trim();
  const rejectNumberText = form.rejectNumber.trim();
  const unsignedDecimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
  const unsignedInteger = /^(?:0|[1-9]\d*)$/;
  const sampleSize = Number(sampleSizeText);
  const acceptNumber = Number(acceptNumberText);
  const rejectNumber = Number(rejectNumberText);
  const targetAql = Number(targetAqlText);
  const cryptoFloor = Math.min(10, Math.max(0, lotSize));
  if (!form.inspectionLevel.trim()) return { reason: "Calidad del tenant debe indicar el nivel de inspección.", payload: null };
  if (!form.stratificationDimension) return { reason: "Elegí explícitamente roll, case o pallet para estratificar.", payload: null };
  if (!unsignedDecimal.test(targetAqlText) || !Number.isFinite(targetAql) || targetAql < 0 || targetAql > 100) return { reason: "El AQL suministrado debe ser explícito y estar entre 0 y 100.", payload: null };
  if (!unsignedInteger.test(sampleSizeText) || !Number.isSafeInteger(sampleSize) || sampleSize < cryptoFloor || sampleSize > lotSize || sampleSize > 5_000) {
    return { reason: `La muestra debe tener entre ${cryptoFloor} y ${Math.min(lotSize, 5_000)} unidades.`, payload: null };
  }
  if (!unsignedInteger.test(acceptNumberText) || !Number.isSafeInteger(acceptNumber) || acceptNumber < 0 || acceptNumber >= sampleSize) return { reason: "Ac debe ser un entero explícito no negativo menor que la muestra.", payload: null };
  if (!unsignedInteger.test(rejectNumberText) || !Number.isSafeInteger(rejectNumber) || rejectNumber !== acceptNumber + 1 || rejectNumber > sampleSize) return { reason: "Re debe ser explícito, exactamente Ac + 1 y no superar la muestra.", payload: null };
  if (form.policyReference.trim().length < 3) return { reason: "Falta la referencia de la política del tenant.", payload: null };
  const policyHash = form.policyDocumentSha256.trim().toLowerCase();
  if (!SHA256_PATTERN.test(policyHash)) return { reason: "El documento de política requiere un digest sha256 válido.", payload: null };
  return {
    reason: "",
    payload: {
      inspection_level: form.inspectionLevel.trim(),
      target_aql: targetAql,
      sample_size: sampleSize,
      accept_number: acceptNumber,
      reject_number: rejectNumber,
      policy_reference: form.policyReference.trim(),
      policy_document_sha256: policyHash,
      stratification_dimension: form.stratificationDimension,
    },
  };
}

function validateDecision(form: DecisionForm) {
  if (!form.decision) return "Seleccioná aprobar o rechazar.";
  if (form.reason.trim().length < 16 || form.reason.trim().length > 1_000) return "La razón debe tener entre 16 y 1000 caracteres.";
  if (form.approvalEvidenceRef.trim().length < 3 || form.approvalEvidenceRef.trim().length > 2_048) return "Falta una referencia acotada a la evidencia de Calidad.";
  if (!SHA256_PATTERN.test(form.approvalEvidenceSha256.trim().toLowerCase())) return "La evidencia requiere un digest sha256 válido.";
  return "";
}

export function SupplierProductionAcceptancePanel({
  orderId,
  bid,
  disabled = false,
  onDecision,
}: {
  orderId: string;
  bid: string;
  disabled?: boolean;
  onDecision?: (status: "passed" | "failed") => void;
}) {
  const basePath = useMemo(
    () => `/api/admin/supplier-orders/${encodeURIComponent(orderId)}/sub-batches/${encodeURIComponent(bid)}/production-acceptance`,
    [bid, orderId],
  );
  const [acceptance, setAcceptance] = useState<ProductionAcceptanceState | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(() => ({ ...EMPTY_PLAN_FORM }));
  const [decisionForm, setDecisionForm] = useState<DecisionForm>(() => ({ ...EMPTY_DECISION_FORM }));
  const [ceremony, setCeremony] = useState<SessionCeremony | null>(null);
  const [observations, setObservations] = useState<Record<string, ObservationDraft>>({});
  const [snapshotUrls, setSnapshotUrls] = useState("");
  const [notes, setNotes] = useState("");
  const [finalReceipt, setFinalReceipt] = useState<FinalizeReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [mutation, setMutation] = useState("");
  const [notice, setNotice] = useState("Cargando el contrato autoritativo de aceptación...");
  const operationKeys = useRef(new Map<string, string>());
  const loadVersion = useRef(0);

  const operationKey = useCallback((action: string, payload: unknown) => {
    const signature = `${basePath}:${action}:${JSON.stringify(payload)}`;
    const existing = operationKeys.current.get(signature);
    if (existing) return existing;
    const created = `production-qa:${action}:${crypto.randomUUID()}`;
    operationKeys.current.set(signature, created);
    return created;
  }, [basePath]);

  const refreshState = useCallback(async (signal?: AbortSignal) => {
    const version = ++loadVersion.current;
    setAcceptance(null);
    setLoading(true);
    try {
      const payload = await requestJson<ProductionAcceptanceResponse>(basePath, { signal });
      if (version !== loadVersion.current) return;
      setAcceptance(payload.production_acceptance);
      setNotice("Estado autoritativo actualizado. Ninguna acción de esta pantalla habilita activación.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    const controller = new AbortController();
    setAcceptance(null);
    setPlanForm({ ...EMPTY_PLAN_FORM });
    setDecisionForm({ ...EMPTY_DECISION_FORM });
    setCeremony(null);
    setObservations({});
    setSnapshotUrls("");
    setNotes("");
    setFinalReceipt(null);
    setNotice("Cargando el contrato autoritativo de aceptación...");
    void refreshState(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "No se pudo cargar aceptación de producción.");
    });
    return () => controller.abort();
  }, [refreshState]);

  const contractReady = acceptance?.schema_version === PRODUCTION_ACCEPTANCE_SCHEMA
    && acceptance.activation_allowed === false;
  const latestPlan = acceptance?.latest_plan || null;
  const approvedPlan = acceptance?.approved_plan || null;
  const latestSession = acceptance?.sessions?.[0] || null;
  const displayedSamples = ceremony?.samples || latestSession?.samples || [];
  const planValidation = validatePlan(planForm, Number(acceptance?.scope.expected_quantity || 0));
  const decisionValidation = validateDecision(decisionForm);
  const snapshots = parseSnapshotReferences(snapshotUrls);
  const canApproveFromBackend = acceptance?.permissions.can_approve_tenant_quality_plan === true;
  const busy = disabled || loading || Boolean(mutation);

  const planBlockReason = !contractReady
    ? "El contrato autoritativo no está disponible o no conserva activación bloqueada."
    : !PLAN_ACTIONS.has(acceptance.next_action)
      ? latestPlan?.decision_status === "approved"
        ? "Ya existe un plan aprobado y vigente para este BID."
        : latestPlan && !latestPlan.decision_status
          ? "El plan vigente espera una decisión de Calidad; no se abre otra revisión."
          : `El backend indica como próxima acción: ${humanToken(acceptance.next_action)}.`
      : planValidation.reason;
  const decisionBlockReason = !contractReady
    ? "El contrato autoritativo no está disponible."
    : !canApproveFromBackend
      ? `El backend no habilitó aprobación para este principal (${acceptance.permissions.approval_permission}).`
      : acceptance.next_action !== "tenant_quality_decision" || !latestPlan || latestPlan.decision_status !== null
        ? "No hay un plan vigente pendiente de decisión."
        : decisionValidation;
  const sessionBlockReason = !contractReady
    ? "El contrato autoritativo no está disponible."
    : !approvedPlan
      ? "Falta un plan aprobado por Calidad del tenant."
      : !SESSION_ACTIONS.has(acceptance.next_action)
        ? `El backend indica como próxima acción: ${humanToken(acceptance.next_action)}.`
        : "";

  let observationBlockReason = "";
  if (!contractReady) observationBlockReason = "El contrato autoritativo no está disponible; no se envían observaciones.";
  else if (!ceremony?.challenge) observationBlockReason = "Abrí una sesión en esta pestaña para conservar el challenge efímero.";
  else if (Date.parse(ceremony.expires_at) <= Date.now()) observationBlockReason = "La sesión venció; el backend debe seleccionar una muestra nueva.";
  else if (!ceremony.samples.length) observationBlockReason = "La sesión no contiene una muestra seleccionada por el servidor.";
  else {
    for (const sample of ceremony.samples) {
      const draft = observations[sample.tag_id];
      if (!draft?.outcome) {
        observationBlockReason = "Registrá una observación explícita para cada unidad seleccionada.";
        break;
      }
      const codes = parseDefectCodes(draft.defectCodes);
      if (codes === null || (draft.outcome === "nonconforming" && codes.length === 0) || (draft.outcome === "conforming" && codes.length > 0)) {
        observationBlockReason = "Los defectos deben ser códigos únicos; conforming no admite códigos y nonconforming exige al menos uno.";
        break;
      }
    }
  }
  if (!observationBlockReason && !snapshots.ok) observationBlockReason = snapshots.reason;
  if (!observationBlockReason && notes.length > 2_000) observationBlockReason = "Las notas no pueden superar 2000 caracteres.";

  async function submitPlan() {
    if (planBlockReason || !planValidation.payload) {
      setNotice(planBlockReason || "El plan está incompleto.");
      return;
    }
    const payload = planValidation.payload;
    setMutation("plan");
    setNotice("Enviando el plan suministrado por Calidad. NexID sólo valida coherencia interna.");
    try {
      await requestJson(basePath, {
        method: "POST",
        headers: { "Idempotency-Key": operationKey(`plan:${latestPlan?.id || "initial"}`, payload) },
        body: JSON.stringify(payload),
      });
      setPlanForm({ ...EMPTY_PLAN_FORM });
      await refreshState();
      setNotice("Plan registrado. Permanece sin aprobar hasta la decisión explícita de Calidad del tenant.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo registrar el plan.");
    } finally {
      setMutation("");
    }
  }

  async function decidePlan() {
    if (decisionBlockReason || !latestPlan || !decisionForm.decision) {
      setNotice(decisionBlockReason || "La decisión está incompleta.");
      return;
    }
    const payload = {
      decision: decisionForm.decision,
      reason: decisionForm.reason.trim(),
      approval_evidence_ref: decisionForm.approvalEvidenceRef.trim(),
      approval_evidence_sha256: decisionForm.approvalEvidenceSha256.trim().toLowerCase(),
    };
    setMutation("decision");
    setNotice("Registrando la decisión del principal de Calidad autorizado por el backend...");
    try {
      await requestJson(`${basePath}/plan/${encodeURIComponent(latestPlan.id)}/decision`, {
        method: "POST",
        headers: { "Idempotency-Key": operationKey(`decision:${latestPlan.id}`, payload) },
        body: JSON.stringify(payload),
      });
      setDecisionForm({ ...EMPTY_DECISION_FORM });
      await refreshState();
      setNotice("Decisión registrada. La activación continúa bloqueada; el siguiente gate lo determina el backend.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo registrar la decisión.");
    } finally {
      setMutation("");
    }
  }

  async function createSession() {
    if (sessionBlockReason || !approvedPlan) {
      setNotice(sessionBlockReason || "No hay plan aprobado.");
      return;
    }
    const payload = { plan_id: approvedPlan.id };
    setMutation("session");
    setNotice("Solicitando al servidor una muestra estratificada y un challenge efímero...");
    try {
      const response = await requestJson<SessionResponse>(`${basePath}/sessions`, {
        method: "POST",
        headers: { "Idempotency-Key": operationKey(`session:${latestSession?.id || "initial"}`, payload) },
        body: JSON.stringify(payload),
      });
      setCeremony(response.session);
      setObservations(Object.fromEntries(response.session.samples.map((sample) => [
        sample.tag_id,
        { outcome: "", defectCodes: "" } satisfies ObservationDraft,
      ])));
      setSnapshotUrls("");
      setNotes("");
      setFinalReceipt(null);
      await refreshState();
      setNotice("Muestra seleccionada por el servidor. Conservá esta pestaña y completá la inspección física de cada unidad.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir la sesión.");
    } finally {
      setMutation("");
    }
  }

  async function finalizeSession() {
    if (observationBlockReason || !ceremony?.challenge) {
      setNotice(observationBlockReason || "La sesión no está disponible.");
      return;
    }
    const productionObservations = ceremony.samples.map((sample) => {
      const draft = observations[sample.tag_id];
      return {
        tag_id: sample.tag_id,
        outcome: draft.outcome as "conforming" | "nonconforming",
        defect_codes: parseDefectCodes(draft.defectCodes) || [],
      };
    });
    const payload = {
      challenge: ceremony.challenge,
      observations: productionObservations,
      snapshot_urls: snapshots.values,
      notes: notes.trim(),
    };
    setMutation("finalize");
    setNotice("Enviando observaciones. El servidor derivará conteos, decisión y disposición; el navegador no los declara.");
    try {
      const receipt = await requestJson<FinalizeReceipt>(
        `${basePath}/sessions/${encodeURIComponent(ceremony.session_id)}/finalize`,
        {
          method: "POST",
          headers: { "Idempotency-Key": operationKey("finalize", payload) },
          body: JSON.stringify(payload),
        },
      );
      setFinalReceipt(receipt);
      setCeremony(null);
      setObservations({});
      onDecision?.(receipt.qa_status);
      await refreshState();
      setNotice(`Recibo autoritativo: ${receipt.qa_status}. Activación sigue bloqueada por ${receipt.activation_gate}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo finalizar la sesión.");
    } finally {
      setMutation("");
    }
  }

  function updateObservation(tagId: string, patch: Partial<ObservationDraft>) {
    setObservations((current) => {
      const previous = current[tagId] || { outcome: "", defectCodes: "" };
      const next = { ...previous, ...patch };
      if (next.outcome === "conforming") next.defectCodes = "";
      return { ...current, [tagId]: next };
    });
  }

  return (
    <section
      className="rounded-2xl border-2 border-violet-300/35 bg-violet-500/10 p-4"
      aria-labelledby="production-acceptance-title"
      data-testid="supplier-production-acceptance-v2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-100">Production acceptance v2</p>
          <h3 id="production-acceptance-title" className="mt-1 text-lg font-black text-white">Plan tenant + receiving QA por BID</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-50">
            Calidad del tenant suministra AQL, muestra, Ac/Re y política. El servidor selecciona la muestra; el operador inspecciona físicamente cada unidad y sólo aporta observaciones y referencias de resultados SUN cuando correspondan.
          </p>
        </div>
        <Button type="button" variant="secondary" className="gap-2" disabled={busy} onClick={() => void refreshState().catch((error) => setNotice(error instanceof Error ? error.message : "No se pudo actualizar."))}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
        <QaMetric label="BID" value={bid} />
        <QaMetric label="Estado físico" value={acceptance?.manufacturing_state || "cargando"} />
        <QaMetric label="Próxima acción" value={acceptance ? humanToken(acceptance.next_action) : "cargando"} />
        <QaMetric label="Activación" value="BLOQUEADA" tone="rose" />
      </div>

      <div className="mt-3 rounded-xl border border-amber-300/25 bg-slate-950/65 px-3 py-2 text-xs leading-5 text-amber-50" role="note">
        Este flujo no modifica K_META, K_FILE, UID, BID, SDM ni la criptografía física NFC. La evidencia digital acompaña la recepción, pero no reemplaza la inspección presencial. Ningún botón de este panel activa productos.
      </div>

      {acceptance && !contractReady ? (
        <p className="mt-3 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-50" role="alert">
          Contrato inesperado: se esperaba {PRODUCTION_ACCEPTANCE_SCHEMA} con activation_allowed=false. Todas las mutaciones quedan bloqueadas.
        </p>
      ) : null}

      {acceptance?.blockers.length ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/55 p-3 text-xs text-slate-300">
          <b className="text-white">Gates autoritativos</b>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {acceptance.blockers.map((blocker) => <li key={blocker}>{humanToken(blocker)}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <fieldset className="rounded-2xl border border-white/10 bg-slate-950/55 p-4" disabled={busy || Boolean(planBlockReason)}>
          <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-violet-100">1 · Plan suministrado por el tenant</legend>
          {latestPlan ? <PlanSummary plan={latestPlan} /> : <p className="text-xs text-slate-400">Sin plan vigente.</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <QaInput id="production-inspection-level" label="Nivel de inspección" value={planForm.inspectionLevel} placeholder="Valor de la política del tenant" onChange={(value) => setPlanForm((current) => ({ ...current, inspectionLevel: value }))} />
            <QaInput id="production-target-aql" label="AQL objetivo" value={planForm.targetAql} placeholder="Sin valor por defecto" inputMode="decimal" onChange={(value) => setPlanForm((current) => ({ ...current, targetAql: value }))} />
            <QaInput id="production-sample-size" label="Tamaño de muestra" value={planForm.sampleSize} placeholder="Definido por Calidad" inputMode="numeric" onChange={(value) => setPlanForm((current) => ({ ...current, sampleSize: value }))} />
            <QaInput id="production-accept-number" label="Ac" value={planForm.acceptNumber} placeholder="Entero" inputMode="numeric" onChange={(value) => setPlanForm((current) => ({ ...current, acceptNumber: value }))} />
            <QaInput id="production-reject-number" label="Re = Ac + 1" value={planForm.rejectNumber} placeholder="Entero" inputMode="numeric" onChange={(value) => setPlanForm((current) => ({ ...current, rejectNumber: value }))} />
            <label className="block" htmlFor="production-stratification">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Estratificación</span>
              <select id="production-stratification" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" value={planForm.stratificationDimension} onChange={(event) => setPlanForm((current) => ({ ...current, stratificationDimension: event.target.value as PlanForm["stratificationDimension"] }))}>
                <option value="">Seleccionar explícitamente</option>
                <option value="roll_id">Roll ID</option>
                <option value="case_id">Case ID</option>
                <option value="pallet_id">Pallet ID</option>
              </select>
            </label>
            <QaInput id="production-policy-reference" label="Referencia de política" value={planForm.policyReference} placeholder="Documento y revisión" onChange={(value) => setPlanForm((current) => ({ ...current, policyReference: value }))} />
            <QaInput id="production-policy-sha" label="SHA-256 de política" value={planForm.policyDocumentSha256} placeholder="sha256:..." mono onChange={(value) => setPlanForm((current) => ({ ...current, policyDocumentSha256: value }))} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" className="gap-2" disabled={busy || Boolean(planBlockReason)} title={planBlockReason || "Registrar plan tenant-supplied"} onClick={() => void submitPlan()}>
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Registrar plan
            </Button>
            <span className="text-xs leading-5 text-slate-400">{planBlockReason || "NexID no elige ni aprueba el AQL."}</span>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-white/10 bg-slate-950/55 p-4" disabled={busy || Boolean(decisionBlockReason)}>
          <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-violet-100">2 · Decisión de Calidad</legend>
          <p className="text-xs leading-5 text-slate-300">
            El control sólo se habilita cuando el GET autoritativo confirma principal tenant_admin, MFA y permiso exacto. El navegador no envía tenant, actor, digest del plan ni timestamps.
          </p>
          <label className="mt-3 block" htmlFor="production-plan-decision">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Decisión explícita</span>
            <select id="production-plan-decision" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" value={decisionForm.decision} onChange={(event) => setDecisionForm((current) => ({ ...current, decision: event.target.value as DecisionForm["decision"] }))}>
              <option value="">Seleccionar</option>
              <option value="approved">Aprobar plan</option>
              <option value="rejected">Rechazar plan</option>
            </select>
          </label>
          <label className="mt-3 block" htmlFor="production-decision-reason">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Razón auditada</span>
            <textarea id="production-decision-reason" className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" minLength={16} maxLength={1000} value={decisionForm.reason} onChange={(event) => setDecisionForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <QaInput id="production-approval-evidence-ref" label="Referencia de evidencia" value={decisionForm.approvalEvidenceRef} placeholder="artifact://..." onChange={(value) => setDecisionForm((current) => ({ ...current, approvalEvidenceRef: value }))} />
            <QaInput id="production-approval-evidence-sha" label="SHA-256 de evidencia" value={decisionForm.approvalEvidenceSha256} placeholder="sha256:..." mono onChange={(value) => setDecisionForm((current) => ({ ...current, approvalEvidenceSha256: value }))} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" className="gap-2" disabled={busy || Boolean(decisionBlockReason)} title={decisionBlockReason || "Registrar decisión de Calidad"} onClick={() => void decidePlan()}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Registrar decisión
            </Button>
            <span className="text-xs leading-5 text-slate-400">{decisionBlockReason || "Autorización confirmada por el backend."}</span>
          </div>
        </fieldset>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">3 · Sesión y muestra comprometida</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              El servidor fija TTL, seed, challenge y selección estratificada. Esta pantalla nunca permite elegir UIDs ni muestra seed/ciphertext.
            </p>
          </div>
          <Button type="button" className="gap-2" disabled={busy || Boolean(sessionBlockReason)} title={sessionBlockReason || "Abrir sesión de receiving QA"} onClick={() => void createSession()}>
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Abrir sesión
          </Button>
        </div>
        {sessionBlockReason ? <p className="mt-2 text-xs text-cyan-100">{sessionBlockReason}</p> : null}
        {latestSession ? (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
            <QaMetric label="Sesión" value={shortDigest(latestSession.id)} />
            <QaMetric label="Vence" value={dateLabel(latestSession.expires_at)} />
            <QaMetric label="Muestra" value={String(latestSession.sample_size)} />
            <QaMetric label="Decisión" value={latestSession.decision_status || "pendiente"} />
          </div>
        ) : null}
        {latestSession && !latestSession.decision_id && !ceremony ? (
          <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-50" role="alert">
            Hay una sesión abierta, pero esta pestaña no conserva su challenge. El challenge no se reconstruye desde GET: mantené la pestaña de creación o esperá el vencimiento para una nueva selección.
          </p>
        ) : null}
      </div>

      {displayedSamples.length ? (
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-slate-950/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">4 · Inspección física de la muestra</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">UID enmascarado, fingerprint y estrato son recibos no secretos. `SUN requerido` sólo aplica al subconjunto criptográfico preseleccionado.</p>
            </div>
            <span className="rounded-full border border-emerald-300/25 px-3 py-1 text-xs font-black text-emerald-100">{displayedSamples.length} unidades</span>
          </div>
          <div className="mt-3 max-h-[34rem] space-y-2 overflow-auto pr-1" style={{ contentVisibility: "auto" }}>
            {displayedSamples.map((sample) => {
              const draft = observations[sample.tag_id] || { outcome: "", defectCodes: "" };
              return (
                <fieldset key={sample.tag_id} className="rounded-xl border border-white/10 bg-slate-950/75 p-3" disabled={busy || !ceremony}>
                  <legend className="px-1 text-xs font-black text-white">#{sample.ordinal} · {sample.uid_masked}</legend>
                  <div className="grid gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
                    <span>Estrato <b className="text-cyan-100">{sample.stratum_key}</b></span>
                    <span>Fingerprint <b className="font-mono text-cyan-100">{shortDigest(sample.uid_fingerprint)}</b></span>
                    <span>{sample.cryptographic_required ? <b className="text-amber-100">SUN requerido</b> : "Inspección física"}</span>
                  </div>
                  {ceremony ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[0.5fr_1fr]">
                      <label className="block" htmlFor={`production-outcome-${sample.ordinal}`}>
                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Observación</span>
                        <select id={`production-outcome-${sample.ordinal}`} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white" value={draft.outcome} onChange={(event) => updateObservation(sample.tag_id, { outcome: event.target.value as ObservationDraft["outcome"] })}>
                          <option value="">Registrar</option>
                          <option value="conforming">Conforming</option>
                          <option value="nonconforming">Nonconforming</option>
                        </select>
                      </label>
                      <label className="block" htmlFor={`production-defects-${sample.ordinal}`}>
                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Códigos de defecto</span>
                        <input id={`production-defects-${sample.ordinal}`} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 font-mono text-xs text-white disabled:opacity-50" value={draft.defectCodes} disabled={draft.outcome !== "nonconforming"} placeholder="ej. LABEL_SHIFT, RF_READ_FAIL" onChange={(event) => updateObservation(sample.tag_id, { defectCodes: event.target.value })} />
                      </label>
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
          </div>

          {ceremony ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <label className="block" htmlFor="production-snapshot-urls">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Referencias de resultados SUN</span>
                <textarea id="production-snapshot-urls" className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white" value={snapshotUrls} onChange={(event) => setSnapshotUrls(event.target.value)} placeholder="https://.../sun?snapshot=123&trace=nexid_..." />
                <span className="mt-1 block text-xs leading-5 text-slate-400">El servidor las exige si sus observaciones derivan aceptación y valida el subconjunto SUN seleccionado. Para rechazo derivado puede no haber referencias. No pegues URL SUN cruda con picc_data/enc/cmac.</span>
              </label>
              <label className="mt-3 block" htmlFor="production-observation-notes">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Notas de inspección</span>
                <textarea id="production-observation-notes" className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" className="gap-2" disabled={busy || Boolean(observationBlockReason)} title={observationBlockReason || "Finalizar desde observaciones"} onClick={() => void finalizeSession()}>
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Finalizar observaciones
                </Button>
                <span className="text-xs leading-5 text-slate-400">{observationBlockReason || "El backend deriva pass/fail, conteos y disposición. Activation permanece false."}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {finalReceipt ? (
        <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-xs text-cyan-50" data-testid="production-acceptance-receipt">
          <b>Recibo autoritativo</b>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <QaMetric label="QA" value={finalReceipt.qa_status} />
            <QaMetric label="Disposición" value={finalReceipt.disposition} />
            <QaMetric label="Muestra observada" value={String(finalReceipt.observed_sample_count)} />
            <QaMetric label="Activación" value="BLOQUEADA" tone="rose" />
          </div>
          <p className="mt-2 font-mono text-[11px]">{finalReceipt.evidence_digest}</p>
        </div>
      ) : null}

      <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2 text-sm text-slate-200" aria-live="polite" aria-atomic="true">
        {mutation ? "Procesando operación auditada… " : ""}{notice}
      </p>
    </section>
  );
}

function PlanSummary({ plan }: { plan: ProductionQaPlan }) {
  const tone = plan.decision_status === "approved"
    ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-50"
    : plan.decision_status === "rejected"
      ? "border-rose-300/25 bg-rose-500/10 text-rose-50"
      : "border-amber-300/25 bg-amber-500/10 text-amber-50";
  return (
    <div className={`rounded-xl border p-3 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>Plan r{plan.revision} · {plan.decision_status || "pendiente de decisión"}</b>
        <span className="font-mono">{shortDigest(plan.plan_digest)}</span>
      </div>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <span>Lote {plan.lot_size} · muestra {plan.sample_size}</span>
        <span>AQL {plan.target_aql} · Ac {plan.accept_number} · Re {plan.reject_number}</span>
        <span>Estrato {plan.stratification_dimension}</span>
        <span>SUN {plan.cryptographic_sample_size} unidades</span>
        <span className="sm:col-span-2">Política {plan.policy_reference} · {shortDigest(plan.policy_document_sha256)}</span>
      </div>
      {plan.decision_status ? <p className="mt-2">Decisión: {plan.approver_email || "principal registrado"} · {dateLabel(plan.decided_at)} · {plan.decision_reason || "sin razón visible"}</p> : null}
    </div>
  );
}

function QaInput({
  id,
  label,
  value,
  placeholder,
  inputMode,
  mono = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  inputMode?: "text" | "decimal" | "numeric";
  mono?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input id={id} className={`mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 ${mono ? "font-mono text-xs" : ""}`} value={value} inputMode={inputMode} autoComplete="off" spellCheck={!mono} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function QaMetric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "rose" }) {
  return (
    <div className={`rounded-xl border p-2 ${tone === "rose" ? "border-rose-300/25 bg-rose-500/10" : "border-white/10 bg-slate-950/65"}`}>
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <b className={`mt-1 block truncate ${tone === "rose" ? "text-rose-100" : "text-white"}`}>{value}</b>
    </div>
  );
}
