"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@product/ui";

type Row = Record<string, any>;

type PackagingLabPayload = {
  ok?: boolean;
  order?: Row;
  carrier_specs?: Row[];
  placements?: Row[];
  projects?: Row[];
  tests?: Row[];
  activation_gates?: Row[];
  presets?: Row[];
  principal?: { user_id?: string; scope?: string };
  permissions?: { can_manage?: boolean; can_approve?: boolean; can_override?: boolean };
  contract?: Row;
};

const packagingTypes = [
  ["seed_bag", "Bolsa de semillas"],
  ["woven_bag", "Bolsa tejida"],
  ["laminated_bag", "Bolsa laminada"],
  ["jerry_can", "Bidon"],
  ["cap", "Tapa"],
  ["box", "Caja"],
  ["pallet", "Pallet"],
  ["other", "Otro"],
] as const;

const deliveryFormats = [
  ["white_label", "Smart label blanca"],
  ["transparent_pet", "PET transparente"],
  ["void_label", "Etiqueta VOID"],
  ["wet_inlay", "Wet inlay"],
  ["dry_inlay", "Dry inlay / converter"],
  ["hard_tag", "Hard tag / on-metal"],
] as const;

function operationKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function statusTone(status: string) {
  if (status === "APPROVED" || status === "PASS") return "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
  if (status === "FAILED" || status === "FAIL") return "border-rose-300/30 bg-rose-500/10 text-rose-100";
  if (status === "WAIVED") return "border-amber-300/30 bg-amber-500/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
}

function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
    </label>
  );
}

export function PackagingLabPanel({ orderId, initialData }: { orderId: string; initialData: PackagingLabPayload | null }) {
  const router = useRouter();
  const [data, setData] = useState<PackagingLabPayload | null>(initialData);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [presetCode, setPresetCode] = useState("");
  const [carrierSpecId, setCarrierSpecId] = useState(String(initialData?.order?.packaging_carrier_spec_id || ""));
  const [placementId, setPlacementId] = useState("");
  const [carrierSpecName, setCarrierSpecName] = useState(`${initialData?.order?.order_name || "Piloto"} construction`);
  const [deliveryFormat, setDeliveryFormat] = useState("white_label");
  const [productId, setProductId] = useState("");
  const [sku, setSku] = useState("");
  const [packagingType, setPackagingType] = useState("seed_bag");
  const [placementZone, setPlacementZone] = useState("");
  const [placementImageUrl, setPlacementImageUrl] = useState("");
  const [objective, setObjective] = useState("Validar construccion, placement, lectura, linea y seguridad para el piloto productivo.");
  const [crossesOpening, setCrossesOpening] = useState(initialData?.order?.carrier_profile_code === "ntag424_dna_tt");
  const [requiresTailBreak, setRequiresTailBreak] = useState(initialData?.order?.carrier_profile_code === "ntag424_dna_tt");
  const [testDrafts, setTestDrafts] = useState<Record<string, { result: string; evidence: string }>>({});
  const [recommendation, setRecommendation] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const projects = data?.projects || [];
  const activeProject = projects.find((project) => project.status !== "ARCHIVED") || null;
  const tests = useMemo(
    () => (data?.tests || []).filter((test) => String(test.project_id) === String(activeProject?.id)),
    [activeProject?.id, data?.tests],
  );
  const isTt = data?.order?.carrier_profile_code === "ntag424_dna_tt";
  const nonTtSecure = data?.order?.carrier_profile_code === "ntag424_dna";
  const sameOperator = Boolean(activeProject && data?.principal?.user_id && activeProject.owner_user_id === data.principal.user_id);
  const unresolvedTests = tests.filter((test) => test.required && !["PASS", "WAIVED"].includes(test.status));
  const criticalNotPassed = tests.filter((test) => ["substrate_identification", "secure_sample_validates", "replay_rejected", "tt_closed", "tt_opened"].includes(test.code) && test.status !== "PASS");
  const createChecks = [
    { id: "permission", label: "Permiso para gestionar Packaging Lab", ok: data?.permissions?.can_manage === true },
    { id: "construction", label: "Construccion identificada", ok: Boolean(carrierSpecId || carrierSpecName.trim()) },
    { id: "sku", label: "SKU vinculado", ok: Boolean(sku.trim()) },
    { id: "placement", label: "Placement o zona exacta definidos", ok: Boolean(placementId || placementZone.trim()) },
    { id: "objective", label: "Objetivo de ensayo definido", ok: Boolean(objective.trim()) },
    ...(isTt ? [
      { id: "tt-crosses-opening", label: "La cola TT cruza la apertura real", ok: crossesOpening },
      { id: "tt-tail-break", label: "La apertura obliga a romper la cola TT", ok: requiresTailBreak },
    ] : []),
  ];
  const createBlockers = createChecks.filter((check) => !check.ok);
  const approvalChecks = [
    { id: "approval-permission", label: "Permiso para aprobar", ok: data?.permissions?.can_approve === true },
    { id: "required-tests", label: "Pruebas obligatorias resueltas", ok: unresolvedTests.length === 0 },
    { id: "critical-tests", label: "Pruebas criticas en PASS", ok: criticalNotPassed.length === 0 },
    {
      id: "separation-of-duties",
      label: "Separacion de funciones o excepcion auditada",
      ok: !sameOperator || (data?.permissions?.can_override === true && override && overrideReason.trim().length >= 16),
    },
  ];
  const approvalBlockers = approvalChecks.filter((check) => !check.ok);

  function applyPreset(code: string) {
    setPresetCode(code);
    const preset = (data?.presets || []).find((candidate) => candidate.code === code);
    if (!preset) return;
    setCarrierSpecId("");
    setPlacementId("");
    setCarrierSpecName(String(preset.carrier_spec_name || "Agro secure packaging pilot"));
    setDeliveryFormat(String(preset.delivery_format || "transparent_pet"));
    setPackagingType(String(preset.packaging_type || "seed_bag"));
    setPlacementZone(String(preset.placement_zone || ""));
    setObjective(String(preset.objective || ""));
    setCrossesOpening(preset.crosses_opening === true);
    setRequiresTailBreak(preset.requires_tail_break === true);
  }

  async function reload() {
    const response = await fetch(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/packaging-lab`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.reason || "No se pudo recargar Packaging Lab.");
    setData(payload);
    router.refresh();
  }

  async function post(body: Row, key?: string) {
    const response = await fetch(`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/packaging-lab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.reason || "Packaging Lab operation failed.");
    return payload;
  }

  async function createProject() {
    setPending(true);
    setMessage("");
    try {
      const payload = await post({
        action: "create_project",
        preset_code: presetCode || undefined,
        ...(carrierSpecId ? { carrier_spec_id: carrierSpecId } : {
          carrier_spec_name: carrierSpecName,
          delivery_format: deliveryFormat,
        }),
        ...(placementId ? { placement_id: placementId } : {
          placement_zone: placementZone,
          placement_image_url: placementImageUrl || undefined,
          crosses_opening: isTt ? crossesOpening : false,
          requires_tail_break: isTt ? requiresTailBreak : false,
        }),
        product_id: productId || undefined,
        sku: sku || undefined,
        packaging_type: packagingType,
        objective,
      }, operationKey("packaging-lab-create"));
      setMessage(`Proyecto creado con ${payload.project?.test_count || 0} pruebas controladas.`);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el proyecto.");
    } finally {
      setPending(false);
    }
  }

  async function recordTest(test: Row, status: "PASS" | "FAIL" | "WAIVED") {
    if (!activeProject) return;
    const draft = testDrafts[test.id] || { result: test.result || "", evidence: "" };
    setPending(true);
    setMessage("");
    try {
      await post({
        action: "record_test",
        project_id: activeProject.id,
        test_case_id: test.id,
        expected_version: test.version,
        status,
        result: draft.result,
        evidence_urls: draft.evidence.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      });
      setMessage(`${test.name}: ${status} registrado.`);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la prueba.");
    } finally {
      setPending(false);
    }
  }

  async function decide(decision: "APPROVE" | "FAIL" | "ARCHIVE") {
    if (!activeProject) return;
    setPending(true);
    setMessage("");
    try {
      await post({
        action: "decide_project",
        project_id: activeProject.id,
        decision,
        reason: decision === "APPROVE" ? undefined : decisionReason,
        recommendation: recommendation || undefined,
        override: decision === "APPROVE" ? override : false,
        override_reason: decision === "APPROVE" && override ? overrideReason : undefined,
      }, operationKey("packaging-lab-decision"));
      setMessage(`Decision ${decision} registrada con recibo auditable.`);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la decision.");
    } finally {
      setPending(false);
    }
  }

  if (!data) {
    return (
      <Card className="border-rose-300/25 bg-rose-500/10 p-5 text-sm text-rose-100">
        Packaging Lab no esta disponible. La migracion 0087 debe estar aplicada; produccion queda cerrada mientras tanto.
      </Card>
    );
  }

  return (
    <Card className="p-5" data-testid="packaging-lab-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Packaging Lab</p>
          <h2 className="mt-1 text-xl font-black text-white">Construccion fisica, placement y gate de activacion</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Este laboratorio conecta el carrier aprobado con producto/SKU, evidencia fisica y pruebas reproducibles. Un lote productivo no puede activarse hasta que el recibo del Lab, el manifiesto, la cantidad y Supplier Production Acceptance esten vigentes.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${statusTone(activeProject?.status || "DRAFT")}`}>
          {activeProject?.status || "SIN PROYECTO"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Carrier" value={data.order?.carrier_profile_code || "-"} />
        <Metric label="Assurance" value={activeProject?.assurance_model || (nonTtSecure ? "sun_sdm" : isTt ? "sun_sdm_tamper" : "declarative/server")} />
        <Metric label="Tests" value={activeProject ? `${tests.filter((test) => test.status === "PASS").length}/${tests.length}` : "0"} />
        <Metric label="Gate de lotes" value={`${(data.activation_gates || []).filter((gate) => gate.packaging_lab_ready).length}/${(data.activation_gates || []).length}`} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <TruthRule ok={!nonTtSecure || activeProject?.tamper_evidence_mode === "none"} title="424 sin TT" body="Autentica SUN/CMAC y replay; no infiere ni expone tamper." />
        <TruthRule ok={!isTt || activeProject?.crosses_opening === true} title="424 TT" body="TT solo se aprueba si la cola conductiva cruza la apertura real y se rompe al abrir." />
        <TruthRule ok title="GS1 / UHF" body="GS1 es identidad declarada. UHF es trazabilidad logistica y nunca recibe K_META/K_FILE SUN." />
      </div>

      {!activeProject ? (
        <section className="mt-6 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/5 p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-fuchsia-100">Crear proyecto sin CLI</h3>
          {data.order?.packaging_governance_status !== "approved" ? (
            <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-100">
              Primero aproba la especificacion industrial de packaging. El Lab se liga a esa revision y hash; no acepta un draft mutable.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Preset operativo
                  <select value={presetCode} onChange={(event) => applyPreset(event.target.value)} className="mt-1 w-full rounded-lg border border-fuchsia-300/25 bg-slate-950 px-3 py-2 text-sm text-white">
                    <option value="">Configuracion manual</option>
                    {(data.presets || []).map((preset) => <option key={preset.code} value={preset.code}>{preset.name} / v{preset.version}</option>)}
                  </select>
                </label>
                {presetCode ? <p className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-500/10 p-2 text-xs leading-5 text-fuchsia-100">
                  AGRO_SECURE_PACKAGING_PILOT propone construccion y placement; no aprueba nada. Exige ensayos fisicos, recibo inmutable y mantiene las claves fuera del Lab.
                </p> : null}
                <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Construccion existente
                  <select value={carrierSpecId} onChange={(event) => { setCarrierSpecId(event.target.value); setPlacementId(""); }} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                    <option value="">Crear desde spec aprobada</option>
                    {(data.carrier_specs || []).map((spec) => <option key={spec.id} value={spec.id}>{spec.name} / {spec.delivery_format}</option>)}
                  </select>
                </label>
                {!carrierSpecId ? <>
                  <Field label="Nombre de construccion" value={carrierSpecName} onChange={setCarrierSpecName} />
                  <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Formato de entrega
                    <select value={deliveryFormat} onChange={(event) => setDeliveryFormat(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                      {deliveryFormats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </> : null}
                <Field label="Producto ID (opcional)" value={productId} onChange={setProductId} placeholder="product-family-..." />
                <Field label="SKU" value={sku} onChange={setSku} placeholder="SYN-SEED-001" />
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Tipo de packaging
                  <select value={packagingType} onChange={(event) => { setPackagingType(event.target.value); setPlacementId(""); }} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                    {packagingTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Placement existente
                  <select value={placementId} onChange={(event) => {
                    const next = event.target.value;
                    setPlacementId(next);
                    const selected = (data.placements || []).find((placement) => placement.id === next);
                    if (selected) {
                      setProductId(selected.product_id || "");
                      setSku(selected.sku || "");
                      setPackagingType(selected.packaging_type || "other");
                    }
                  }} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
                    <option value="">Crear placement</option>
                    {(data.placements || []).filter((placement) => !carrierSpecId || placement.carrier_spec_id === carrierSpecId).map((placement) => <option key={placement.id} value={placement.id}>{placement.packaging_type} / {placement.placement_zone}</option>)}
                  </select>
                </label>
                {!placementId ? <>
                  <Field label="Zona exacta" value={placementZone} onChange={setPlacementZone} placeholder="Bajo etiqueta trasera, fuera de costura..." />
                  <Field label="Foto/evidencia HTTPS sin query" value={placementImageUrl} onChange={setPlacementImageUrl} placeholder="https://.../placement.jpg" />
                  {isTt ? <div className="grid gap-2">
                    <Toggle label="La cola cruza la apertura real" checked={crossesOpening} onChange={setCrossesOpening} />
                    <Toggle label="Abrir obliga a romper la cola" checked={requiresTailBreak} onChange={setRequiresTailBreak} />
                  </div> : <p className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-2 text-xs text-cyan-100">Tamper electronico deshabilitado para este carrier.</p>}
                </> : null}
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Objetivo
                  <textarea value={objective} onChange={(event) => setObjective(event.target.value)} className="mt-1 min-h-32 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
                <GateChecklist id="packaging-lab-create-readiness" title="Listo para crear" checks={createChecks} />
                <button
                  type="button"
                  disabled={pending || createBlockers.length > 0}
                  aria-describedby="packaging-lab-create-readiness"
                  title={createBlockers[0]?.label || "Crear Packaging Lab"}
                  onClick={() => void createProject()}
                  className="w-full rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >Crear Lab y plantilla de pruebas</button>
                <p className="text-xs leading-5 text-slate-500">La plantilla se elige por packaging y agrega secure sample/replay; TT agrega cerrado/abierto sacrificial. Ninguna clave NFC se copia al Lab.</p>
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.55fr)]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-fuchsia-100">Plan de ensayos</h3>
              <span className="text-xs text-slate-400">{activeProject.template_code} / {activeProject.packaging_type} / {activeProject.placement_zone}</span>
            </div>
            {tests.map((test) => {
              const draft = testDrafts[test.id] || { result: test.result || "", evidence: "" };
              return (
                <article key={test.id} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{test.sequence}. {test.category} / {test.code}</p>
                      <h4 className="mt-1 text-sm font-bold text-white">{test.name}</h4>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusTone(test.status)}`}>{test.status}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400"><b className="text-slate-200">Metodo:</b> {test.method}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400"><b className="text-slate-200">Target:</b> {test.target}</p>
                  {activeProject.status !== "APPROVED" && activeProject.status !== "ARCHIVED" ? <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <textarea value={draft.result} onChange={(event) => setTestDrafts({ ...testDrafts, [test.id]: { ...draft, result: event.target.value } })} placeholder="Resultado medido y unidades" className="min-h-20 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                    <textarea value={draft.evidence} onChange={(event) => setTestDrafts({ ...testDrafts, [test.id]: { ...draft, evidence: event.target.value } })} placeholder="evidence://... o HTTPS sin query, uno por linea" className="min-h-20 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
                    <div className="grid content-start gap-1">
                      <TestButton label="PASS" disabled={pending || !draft.result.trim()} onClick={() => void recordTest(test, "PASS")} />
                      <TestButton label="FAIL" disabled={pending || !draft.result.trim()} onClick={() => void recordTest(test, "FAIL")} />
                      {test.waiver_allowed ? <TestButton label="WAIVE" disabled={pending || !draft.result.trim()} onClick={() => void recordTest(test, "WAIVED")} /> : null}
                    </div>
                  </div> : <p className="mt-2 text-xs text-slate-300">{test.result || "Sin resultado"} {Array.isArray(test.evidence_urls) && test.evidence_urls.length ? ` / ${test.evidence_urls.length} evidencia(s)` : ""}</p>}
                </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Gate de aprobacion</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">Pendientes obligatorios: <b className="text-white">{unresolvedTests.length}</b>. Criticos sin PASS: <b className="text-white">{criticalNotPassed.length}</b>.</p>
              {isTt ? <p className="mt-2 text-xs text-cyan-100">TT exige placement cruzando apertura + tt_closed + tt_opened.</p> : <p className="mt-2 text-xs text-cyan-100">Este carrier no puede generar estado de tamper.</p>}
              <label className="mt-3 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Recomendacion al cliente
                <textarea value={recommendation} onChange={(event) => setRecommendation(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
              </label>
              {sameOperator ? <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 p-3 text-xs text-amber-100">
                <b>Separacion de funciones:</b> sos el owner del proyecto. Debe aprobar otro operador o usar una excepcion autorizada y auditada.
                {data.permissions?.can_override ? <div className="mt-2"><Toggle label="Usar excepcion de un solo operador" checked={override} onChange={setOverride} />{override ? <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Razon obligatoria, minimo 16 caracteres" className="mt-2 min-h-20 w-full rounded-lg border border-amber-200/25 bg-slate-950 px-3 py-2 text-xs text-white" /> : null}</div> : null}
              </div> : null}
              <label className="mt-3 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Motivo de fallo/archivo
                <textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" />
              </label>
              <GateChecklist id="packaging-lab-approval-readiness" title="Listo para aprobar" checks={approvalChecks} />
              <div className="mt-3 grid gap-2">
                {activeProject.status === "TESTING" ? <>
                  <button type="button" disabled={pending || approvalBlockers.length > 0} aria-describedby="packaging-lab-approval-readiness" title={approvalBlockers[0]?.label || "Aprobar construccion y placement"} onClick={() => void decide("APPROVE")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Aprobar construccion y placement</button>
                  <button type="button" disabled={pending || !data.permissions?.can_approve || !decisionReason.trim()} onClick={() => void decide("FAIL")} className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-40">Marcar FAILED</button>
                </> : null}
                {activeProject.status === "FAILED" || activeProject.status === "APPROVED" ? <button type="button" disabled={pending || !data.permissions?.can_approve || !decisionReason.trim()} onClick={() => void decide("ARCHIVE")} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-40">Archivar proyecto</button> : null}
              </div>
              {activeProject.override_used ? <p className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 p-2 text-xs font-bold text-amber-100">Advertencia: esta aprobacion uso una excepcion auditada.</p> : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Reporte cliente</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">PDF ejecutivo y CSV detallado. Excluyen claves NFC y queries SUN crudas.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/packaging-lab/report?projectId=${encodeURIComponent(activeProject.id)}&format=pdf`} className="rounded-lg border border-fuchsia-300/25 bg-fuchsia-500/10 px-3 py-2 text-center text-xs font-black text-fuchsia-100">Descargar PDF</a>
                <a href={`/api/admin/supplier-orders/${encodeURIComponent(orderId)}/packaging-lab/report?projectId=${encodeURIComponent(activeProject.id)}&format=csv`} className="rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-center text-xs font-black text-cyan-100">Descargar CSV</a>
              </div>
              {activeProject.receipt_digest ? <p className="mt-3 break-all font-mono text-[10px] text-emerald-200">{activeProject.receipt_digest}</p> : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-200">Lotes vinculados</h3>
              <div className="mt-2 space-y-2">
                {(data.activation_gates || []).map((gate) => <div key={gate.supplier_sub_batch_id} className="rounded-lg border border-white/10 p-2 text-xs text-slate-300"><div className="flex justify-between gap-2"><b className="font-mono text-white">{gate.bid}</b><span className={gate.packaging_lab_ready ? "text-emerald-300" : "text-amber-300"}>{gate.packaging_lab_ready ? "LAB READY" : "BLOCKED"}</span></div><span className="mt-1 block text-slate-500">Manifest {gate.manifest_count}/{gate.expected_quantity} / {gate.manifest_status}</span></div>)}
              </div>
            </div>
          </aside>
        </div>
      )}

      {message ? <p className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-200" role="status" aria-live="polite">{message}</p> : null}
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-start gap-2 text-xs leading-5 text-slate-200"><input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function TestButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-black text-slate-200 disabled:opacity-35">{label}</button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span><b className="mt-1 block truncate text-sm text-white">{value}</b></div>;
}

function TruthRule({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return <div className={`rounded-xl border p-3 ${ok ? "border-cyan-300/20 bg-cyan-500/5" : "border-rose-300/30 bg-rose-500/10"}`}><div className="flex items-center justify-between gap-2"><b className="text-xs text-white">{title}</b><span className={ok ? "text-emerald-300" : "text-rose-300"}>{ok ? "OK" : "REVISAR"}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{body}</p></div>;
}

function GateChecklist({ id, title, checks }: { id: string; title: string; checks: Array<{ id: string; label: string; ok: boolean }> }) {
  return (
    <div id={id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {checks.map((check) => (
          <li key={check.id} className={`flex items-start gap-2 text-xs ${check.ok ? "text-emerald-200" : "text-amber-100"}`}>
            <span aria-hidden="true" className="mt-px font-black">{check.ok ? "✓" : "!"}</span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
