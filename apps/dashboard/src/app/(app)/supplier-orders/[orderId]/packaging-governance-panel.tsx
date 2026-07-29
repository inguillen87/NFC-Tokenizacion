"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@product/ui";

type Issue = { code?: string; field?: string; message?: string };
type Governance = {
  status?: string;
  spec_revision?: number;
  spec_hash?: string | null;
  spec_snapshot?: Record<string, any> | null;
  evidence_refs?: Record<string, string[]>;
  validation_snapshot?: {
    ok?: boolean;
    productionReady?: boolean;
    errors?: Issue[];
    readinessGaps?: Issue[];
    warnings?: Issue[];
  } | null;
  decided_by?: string | null;
  updated_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
};

type PackagingPayload = {
  ok?: boolean;
  order?: { id?: string; order_name?: string; carrier_profile_code?: string };
  governance?: Governance;
  history?: Array<Record<string, any>>;
  permissions?: { can_draft?: boolean; can_submit?: boolean; can_approve_or_reject?: boolean };
};

const evidenceKinds = [
  ["rf_sample", "RF sobre envase real"],
  ["line_trial", "Prueba de línea"],
  ["adhesive", "Adhesivo y durabilidad"],
  ["artwork_dieline", "Arte / troquel"],
  ["encoding_readback", "Codificación y read-back"],
  ["tagtamper_placement", "Colocación TagTamper"],
] as const;

function emptySpec(carrierProfileCode = "") {
  const tagTamper = carrierProfileCode.toLowerCase() === "ntag424_dna_tt";
  return {
    version: 1,
    inlayForm: "converted_smart_label",
    applicationSurface: "plastic_hdpe",
    placement: tagTamper ? "cap" : "under_existing_label",
    applicationMode: "automatic_labeler",
    substrateMaterial: "",
    faceStock: "",
    adhesive: "",
    liner: "",
    geometry: {
      labelWidthMm: "",
      labelHeightMm: "",
      antennaWidthMm: "",
      antennaHeightMm: "",
      pitchMm: "",
      webWidthMm: "",
    },
    roll: {
      coreDiameterMm: "",
      maxOuterDiameterMm: "",
      winding: "face_out",
      unwindDirection: "",
      quantityPerRoll: "",
    },
    line: { unitsPerMinute: "", printerEncoderModel: "" },
    environment: {
      minTemperatureC: "",
      maxTemperatureC: "",
      liquidProximity: false,
      metalProximity: false,
      outdoorUv: false,
      chemicalExposure: [],
    },
    tagTamper: {
      required: tagTamper,
      bridgesOpening: tagTamper ? false : null,
      tailLengthMm: "",
      placementApproved: false,
    },
    qa: {
      rfSampleApproved: false,
      lineTrialApproved: false,
      adhesiveApproved: false,
      artworkApproved: false,
      encodingTrialApproved: false,
    },
    notes: "",
  };
}

function normalizeInitialSpec(data: PackagingPayload | null) {
  const base = emptySpec(data?.order?.carrier_profile_code);
  const saved = data?.governance?.spec_snapshot;
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    geometry: { ...base.geometry, ...(saved.geometry || {}) },
    roll: { ...base.roll, ...(saved.roll || {}) },
    line: { ...base.line, ...(saved.line || {}) },
    environment: { ...base.environment, ...(saved.environment || {}) },
    tagTamper: { ...base.tagTamper, ...(saved.tagTamper || {}) },
    qa: { ...base.qa, ...(saved.qa || {}) },
  };
}

function asOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanSpec(spec: ReturnType<typeof emptySpec>) {
  return {
    ...spec,
    geometry: Object.fromEntries(Object.entries(spec.geometry).map(([key, value]) => [key, asOptionalNumber(value)])),
    roll: {
      ...spec.roll,
      coreDiameterMm: asOptionalNumber(spec.roll.coreDiameterMm),
      maxOuterDiameterMm: asOptionalNumber(spec.roll.maxOuterDiameterMm),
      unwindDirection: asOptionalNumber(spec.roll.unwindDirection),
      quantityPerRoll: asOptionalNumber(spec.roll.quantityPerRoll),
    },
    line: { ...spec.line, unitsPerMinute: asOptionalNumber(spec.line.unitsPerMinute) },
    environment: {
      ...spec.environment,
      minTemperatureC: asOptionalNumber(spec.environment.minTemperatureC),
      maxTemperatureC: asOptionalNumber(spec.environment.maxTemperatureC),
      chemicalExposure: Array.isArray(spec.environment.chemicalExposure)
        ? spec.environment.chemicalExposure
        : String(spec.environment.chemicalExposure || "").split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
    },
    tagTamper: { ...spec.tagTamper, tailLengthMm: asOptionalNumber(spec.tagTamper.tailLengthMm) },
  };
}

function refsFromPayload(data: PackagingPayload | null) {
  const saved = data?.governance?.evidence_refs || {};
  return Object.fromEntries(evidenceKinds.map(([kind]) => [kind, (saved[kind] || []).join("\n")])) as Record<string, string>;
}

function parseRefs(refs: Record<string, string>) {
  return Object.fromEntries(evidenceKinds.map(([kind]) => [
    kind,
    String(refs[kind] || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
  ]));
}

function statusTone(status: string) {
  if (status === "approved") return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
  if (status === "submitted") return "border-cyan-300/35 bg-cyan-500/10 text-cyan-100";
  if (status === "rejected") return "border-rose-300/35 bg-rose-500/10 text-rose-100";
  return "border-amber-300/35 bg-amber-500/10 text-amber-100";
}

function TextField({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function PackagingGovernancePanel({ orderId, initialData }: { orderId: string; initialData: PackagingPayload | null }) {
  const router = useRouter();
  const [data, setData] = useState<PackagingPayload | null>(initialData);
  const [spec, setSpec] = useState<any>(() => normalizeInitialSpec(initialData));
  const [refs, setRefs] = useState<Record<string, string>>(() => refsFromPayload(initialData));
  const [decisionReason, setDecisionReason] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const governance = data?.governance || {};
  const status = String(governance.status || "legacy_unverified");
  const validation = governance.validation_snapshot;
  const issues = useMemo(() => [
    ...(validation?.errors || []),
    ...(validation?.readinessGaps || []),
  ], [validation]);

  const setNested = (section: string, field: string, value: unknown) => {
    setSpec((current: any) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  };

  async function reload() {
    const response = await fetch(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/packaging`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.reason || "No se pudo recargar packaging.");
    setData(payload);
    setSpec(normalizeInitialSpec(payload));
    setRefs(refsFromPayload(payload));
    router.refresh();
  }

  async function decide(nextStatus: "draft" | "submitted" | "approved" | "rejected") {
    setPending(true);
    setMessage("");
    try {
      const approvalDecision = nextStatus === "approved" || nextStatus === "rejected";
      const response = await fetch(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/packaging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(approvalDecision ? {} : { spec: cleanSpec(spec) }),
          evidence_refs: parseRefs(refs),
          decision_reason: decisionReason || undefined,
          single_operator_override: nextStatus === "approved" ? override : false,
          override_reason: nextStatus === "approved" && override ? overrideReason : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const gaps = Array.isArray(payload?.gaps) ? payload.gaps.map((item: Issue) => item.message || item.code).filter(Boolean).join(" · ") : "";
        throw new Error([payload?.reason || "Packaging decision failed", gaps].filter(Boolean).join(": "));
      }
      setMessage(`Decisión ${nextStatus} registrada en revisión ${payload.decision?.specRevision || "nueva"}.`);
      setDecisionReason("");
      setOverride(false);
      setOverrideReason("");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la decisión.");
    } finally {
      setPending(false);
    }
  }

  if (!data) {
    return (
      <Card className="border-rose-300/25 bg-rose-500/10 p-5 text-sm text-rose-100">
        La gobernanza de packaging no está disponible. Verificá que la migración 0063 esté aplicada antes de liberar un pack de fábrica.
      </Card>
    );
  }

  const canEdit = status !== "submitted";
  const canApprove = data.permissions?.can_approve_or_reject === true;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Industrial packaging release</p>
          <h2 className="mt-1 text-xl font-black text-white">Especificación física y aprobación de fábrica</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Un dry inlay es un componente para converter; para una línea autoadhesiva existente el entregable recomendado es una smart label terminada en rollo. La exportación de claves queda cerrada hasta aprobar RF, adhesivo, línea, arte/troquel y read-back sobre el envase real.
          </p>
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${statusTone(status)}`}>
          {status} · rev {governance.spec_revision || 0}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
        <div className={`space-y-5 ${canEdit ? "" : "pointer-events-none opacity-70"}`}>
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">1. Construcción y aplicación</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-slate-400">Construcción
                <select value={spec.inlayForm} onChange={(e) => setSpec({ ...spec, inlayForm: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="converted_smart_label">Smart label terminada</option><option value="wet_inlay">Wet inlay</option><option value="dry_inlay">Dry inlay / converter</option><option value="hard_tag">Hard tag / on-metal</option><option value="undecided">A definir</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">Superficie
                <select value={spec.applicationSurface} onChange={(e) => setSpec({ ...spec, applicationSurface: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                  {[["paper","Papel"],["corrugated","Cartón corrugado"],["glass","Vidrio"],["plastic_hdpe","HDPE"],["plastic_pet","PET"],["flexible_bag","Bolsa flexible"],["composite","Compuesto"],["metal","Metal"],["other","Otra"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">Ubicación
                <select value={spec.placement} onChange={(e) => setSpec({ ...spec, placement: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                  {[["cap","Tapa"],["neck","Cuello"],["body","Cuerpo"],["back_label","Etiqueta trasera"],["under_existing_label","Bajo etiqueta existente"],["bag_seam","Costura de bolsa"],["carton","Caja"],["pallet","Pallet"],["custom","Especial"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">Modo
                <select value={spec.applicationMode} onChange={(e) => setSpec({ ...spec, applicationMode: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="automatic_labeler">Etiquetadora automática</option><option value="manual">Manual / piloto</option><option value="label_converter">Converter</option><option value="in_mold">In-mold</option><option value="undecided">A definir</option>
                </select>
              </label>
              <TextField label="Sustrato real" value={spec.substrateMaterial} onChange={(value) => setSpec({ ...spec, substrateMaterial: value })} placeholder="HDPE lleno, bolsa BOPP..." />
              <TextField label="Face stock" value={spec.faceStock} onChange={(value) => setSpec({ ...spec, faceStock: value })} />
              <TextField label="Adhesivo" value={spec.adhesive} onChange={(value) => setSpec({ ...spec, adhesive: value })} />
              <TextField label="Liner" value={spec.liner} onChange={(value) => setSpec({ ...spec, liner: value })} />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">2. Geometría, rollo y línea</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[["labelWidthMm","Ancho etiqueta mm"],["labelHeightMm","Alto etiqueta mm"],["antennaWidthMm","Ancho antena mm"],["antennaHeightMm","Alto antena mm"],["pitchMm","Pitch mm"],["webWidthMm","Web width mm"]].map(([field,label]) => <TextField key={field} label={label} type="number" value={spec.geometry[field]} onChange={(value) => setNested("geometry", field, value)} />)}
              <TextField label="Core mm" type="number" value={spec.roll.coreDiameterMm} onChange={(value) => setNested("roll", "coreDiameterMm", value)} />
              <TextField label="Diámetro exterior máx. mm" type="number" value={spec.roll.maxOuterDiameterMm} onChange={(value) => setNested("roll", "maxOuterDiameterMm", value)} />
              <TextField label="Unwind 1-8" type="number" value={spec.roll.unwindDirection} onChange={(value) => setNested("roll", "unwindDirection", value)} />
              <TextField label="Unidades por rollo" type="number" value={spec.roll.quantityPerRoll} onChange={(value) => setNested("roll", "quantityPerRoll", value)} />
              <TextField label="Unidades/minuto" type="number" value={spec.line.unitsPerMinute} onChange={(value) => setNested("line", "unitsPerMinute", value)} />
              <TextField label="Impresora/encoder" value={spec.line.printerEncoderModel} onChange={(value) => setNested("line", "printerEncoderModel", value)} />
              <label className="text-xs text-slate-400">Bobinado
                <select value={spec.roll.winding} onChange={(e) => setNested("roll", "winding", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="face_out">Face out</option><option value="face_in">Face in</option><option value="sheets">Hojas</option><option value="not_applicable">No aplica</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">3. Ambiente, tamper y QA físico</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <TextField label="Temperatura mínima °C" type="number" value={spec.environment.minTemperatureC} onChange={(value) => setNested("environment", "minTemperatureC", value)} />
              <TextField label="Temperatura máxima °C" type="number" value={spec.environment.maxTemperatureC} onChange={(value) => setNested("environment", "maxTemperatureC", value)} />
              <TextField label="Químicos (separados por coma)" value={Array.isArray(spec.environment.chemicalExposure) ? spec.environment.chemicalExposure.join(", ") : spec.environment.chemicalExposure} onChange={(value) => setNested("environment", "chemicalExposure", value)} />
              <Toggle label="Próximo a líquido" checked={Boolean(spec.environment.liquidProximity)} onChange={(value) => setNested("environment", "liquidProximity", value)} />
              <Toggle label="Próximo a metal" checked={Boolean(spec.environment.metalProximity)} onChange={(value) => setNested("environment", "metalProximity", value)} />
              <Toggle label="Exposición UV exterior" checked={Boolean(spec.environment.outdoorUv)} onChange={(value) => setNested("environment", "outdoorUv", value)} />
              <Toggle label="TagTamper requerido" checked={Boolean(spec.tagTamper.required)} onChange={(value) => setNested("tagTamper", "required", value)} />
              <Toggle label="La cola cruza la apertura" checked={spec.tagTamper.bridgesOpening === true} onChange={(value) => setNested("tagTamper", "bridgesOpening", value)} />
              <Toggle label="Placement TT aprobado" checked={Boolean(spec.tagTamper.placementApproved)} onChange={(value) => setNested("tagTamper", "placementApproved", value)} />
              <TextField label="Largo cola TT mm" type="number" value={spec.tagTamper.tailLengthMm} onChange={(value) => setNested("tagTamper", "tailLengthMm", value)} />
              {[["rfSampleApproved","RF en muestra real"],["lineTrialApproved","Prueba de línea"],["adhesiveApproved","Adhesivo"],["artworkApproved","Arte/troquel"],["encodingTrialApproved","Encoding/read-back"]].map(([field,label]) => <Toggle key={field} label={`Aprobado: ${label}`} checked={Boolean(spec.qa[field])} onChange={(value) => setNested("qa", field, value)} />)}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/65 p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Evidencia independiente</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Una referencia por línea: ID de ensayo, hash, URL de documento controlado o artefacto del Tenant Vault. No pegues claves ni secretos.</p>
            <div className="mt-3 space-y-3">
              {evidenceKinds.map(([kind, label]) => (
                <label key={kind} className="block text-[11px] text-slate-400">{label}
                  <textarea value={refs[kind] || ""} onChange={(event) => setRefs({ ...refs, [kind]: event.target.value })} className="mt-1 min-h-16 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="evidence://... o sha256:..." />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/65 p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Readiness</h3>
            <p className="mt-2 text-xs text-slate-400">Hash: <span className="font-mono text-slate-300">{governance.spec_hash || "todavía no emitido"}</span></p>
            {issues.length ? <ul className="mt-3 space-y-2 text-xs text-amber-100">{issues.map((issue, index) => <li key={`${issue.code}-${index}`} className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-2"><b>{issue.field || issue.code}:</b> {issue.message || issue.code}</li>)}</ul> : <p className="mt-3 rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-2 text-xs text-emerald-100">Sin gaps registrados en la última validación.</p>}
            {(validation?.warnings || []).map((issue, index) => <p key={`${issue.code}-${index}`} className="mt-2 text-xs text-slate-400">Advertencia: {issue.message || issue.code}</p>)}
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/65 p-4">
            <label className="block text-[11px] text-slate-400">Motivo de decisión
              <textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            {status === "submitted" && canApprove ? <div className="mt-3 space-y-2"><Toggle label="Excepción: aprueba el mismo operador" checked={override} onChange={setOverride} />{override ? <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} className="min-h-16 w-full rounded-lg border border-amber-300/25 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="Justificación auditada obligatoria" /> : null}</div> : null}
            <div className="mt-4 grid gap-2">
              {status === "submitted" ? (
                <>
                  {canApprove ? <button disabled={pending} onClick={() => void decide("approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Aprobar release físico</button> : null}
                  {canApprove ? <button disabled={pending || !decisionReason.trim()} onClick={() => void decide("rejected")} className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-50">Rechazar con motivo</button> : null}
                  <button disabled={pending} onClick={() => void decide("draft")} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-50">Volver a draft</button>
                </>
              ) : (
                <>
                  <button disabled={pending} onClick={() => void decide("draft")} className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-50">Guardar nueva revisión draft</button>
                  {status === "draft" ? <button disabled={pending} onClick={() => void decide("submitted")} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Enviar a aprobación</button> : null}
                </>
              )}
            </div>
            {message ? <p className="mt-3 rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-slate-200">{message}</p> : null}
          </div>
        </aside>
      </div>
    </Card>
  );
}
