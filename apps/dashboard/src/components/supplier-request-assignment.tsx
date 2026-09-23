"use client";
import { useEffect, useRef, useState } from "react";
import { SupplierRequestError, type SupplierRequest } from "../lib/supplier-request-client";
import { supplierAssignmentCall, supplierOperatorsCall, type SupplierAssignmentCommand, type SupplierAssignmentEnvelope } from "../lib/supplier-request-assignment-client";
import type { SupplierRequestReviewGuard } from "./supplier-request-review";
import styles from "./supplier-request-workspace.module.css";
type Props = { request: SupplierRequest; canManageUsers?: boolean; suspended: boolean; canInteract: () => boolean; onGuard: (value: SupplierRequestReviewGuard) => void };
export function SupplierRequestAssignment({ request, canManageUsers = false, suspended, canInteract, onGuard }: Props) {
  const [data, setData] = useState<SupplierAssignmentEnvelope | null>(null), [operators, setOperators] = useState<Array<{ id: string; display_name: string }> | null>(null), [truncatedOperators, setTruncatedOperators] = useState(false);
  const [choice, setChoice] = useState(""), [loading, setLoading] = useState(false), [confirming, setConfirming] = useState(false), [phase, setPhase] = useState<"idle" | "saving" | "uncertain" | "error" | "conflict" | "saved">("idle"), [error, setError] = useState(""), [candidatesError, setCandidatesError] = useState(""), [receiptRevision, setReceiptRevision] = useState<number | null>(null);
  const alive = useRef(true), read = useRef<AbortController | null>(null), write = useRef<AbortController | null>(null), busy = useRef(false), unresolved = useRef(false), operation = useRef<SupplierAssignmentCommand | null>(null), choiceRef = useRef(""), dirty = useRef(false);
  const blocked = suspended || phase === "saving" || phase === "uncertain";
  const current = Boolean(data && data.request_revision === request.revision);
  const changed = Boolean(data && choice !== (data.assignment.operator_id || ""));
  const eligible = !choice || Boolean(operators?.some(item => item.id === choice));
  const canSave = current && changed && eligible && (request.status === "submitted" || (request.status === "provisioned" && !choice));
  const operatorName = (id: string | null) => !id ? "Sin responsable asignado" : operators?.find(item => item.id === id)?.display_name || `Operador ${id} · fuera del catálogo cargado`;
  const signalGuard = () => onGuard({ dirty: dirty.current, locked: busy.current || unresolved.current });
  useEffect(() => { alive.current = true; void refresh(); return () => { alive.current = false; read.current?.abort(); write.current?.abort(); }; /* Parent keys authenticated request context. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function refresh(older = false) {
    if (!canInteract() || read.current || busy.current || unresolved.current || (older && !data?.next_before_revision)) return;
    const controller = new AbortController(); read.current = controller; setLoading(true); setError(""); setConfirming(false);
    try {
      const [result, candidates] = await Promise.all([supplierAssignmentCall({ tenant: request.tenant_slug, tenantId: request.tenant_id, id: request.id, ...(older ? { beforeRevision: data!.next_before_revision! } : {}), signal: controller.signal }), older ? Promise.resolve(null) : supplierOperatorsCall(controller.signal).then(value => ({ value }), () => ({ value: null }))]);
      if (!alive.current || read.current !== controller) return;
      if (older) {
        if (result.assignment.revision !== data!.assignment.revision || result.request_revision !== data!.request_revision || !result.history.length || result.history.at(-1)!.revision + 1 !== data!.history[0]?.revision || result.history.some(item => data!.history.some(previous => previous.id === item.id || previous.revision === item.revision))) throw new SupplierRequestError("assignment_changed", 409);
        setData({ ...result, history: [...result.history, ...data!.history], count: result.count + data!.count });
      } else {
        setData(result); setReceiptRevision(null);
        if (!dirty.current) { choiceRef.current = result.assignment.operator_id || ""; setChoice(choiceRef.current); }
        dirty.current = choiceRef.current !== (result.assignment.operator_id || ""); signalGuard();
        if (candidates?.value) { setOperators(candidates.value.operators); setTruncatedOperators(candidates.value.truncated); setCandidatesError(""); }
        else { setOperators(null); setCandidatesError("No se confirmó el catálogo de operadores habilitados. No se pueden asignar nuevos responsables."); }
      }
      setPhase("idle");
    } catch { if (alive.current) { setPhase("error"); setError("No se confirmó la asignación actual. Conservamos tu selección; consultá otra vez antes de continuar."); } }
    finally { if (read.current === controller) read.current = null; if (alive.current) setLoading(false); }
  }
  async function execute(command: SupplierAssignmentCommand) {
    if (!canInteract() || read.current || busy.current) return;
    busy.current = true; operation.current = command; signalGuard(); setPhase("saving"); setConfirming(false); setError("");
    const controller = new AbortController(); write.current = controller;
    try {
      const result = await supplierAssignmentCall({ tenant: request.tenant_slug, tenantId: request.tenant_id, id: request.id, command, signal: controller.signal });
      if (!alive.current) return;
      unresolved.current = false; operation.current = null; dirty.current = false; choiceRef.current = result.assignment.operator_id || ""; setChoice(choiceRef.current); setData(result); setReceiptRevision(result.receipt!.revision); setPhase("saved");
    } catch (issue) {
      if (!alive.current) return;
      const failure = issue instanceof SupplierRequestError ? issue : new SupplierRequestError("unavailable", 0, true); unresolved.current ||= failure.uncertain;
      setPhase(unresolved.current ? "uncertain" : failure.status === 409 ? "conflict" : "error");
      setError(unresolved.current ? "No se confirmó el cambio de responsable. Comprobá la misma operación antes de continuar." : failure.status === 409 ? "La solicitud o la asignación cambió. Tu selección sigue aquí; consultá el estado actual antes de revisarla otra vez." : "No se pudo confirmar el cambio. Conservamos tu selección; verificá el acceso y el estado actual.");
      if (!unresolved.current) operation.current = null;
    } finally { busy.current = false; if (alive.current) signalGuard(); if (write.current === controller) write.current = null; }
  }
  function confirm() {
    if (!canInteract() || !confirming || !canSave || !data || read.current || busy.current || unresolved.current || phase === "error" || phase === "conflict") return;
    void execute(Object.freeze({ tenant: request.tenant_slug, id: request.id, key: crypto.randomUUID(), body: Object.freeze({ operator_id: choiceRef.current || null, expected_revision: data.assignment.revision, expected_request_revision: request.revision }) }));
  }
  return <section className={styles.reviewPanel} data-testid="supplier-request-assignment-panel" aria-labelledby="supplier-assignment-heading"><div className={styles.heading}><div><h3 id="supplier-assignment-heading">Responsable interno de NexID</h3><p className={styles.muted}>La asignación habilita la consulta y las aclaraciones de esta solicitud. No concede acceso general a la empresa ni permite preparar pedidos.</p></div><button className={styles.button} data-testid="supplier-request-assignment-refresh" disabled={blocked || loading} onClick={() => void refresh()}>Consultar asignación</button></div>
    <p role="status" className={styles.notice}>{loading ? "Consultando responsable e historial…" : phase === "saving" ? "Guardando asignación…" : phase === "uncertain" ? "Asignación sin confirmar; conservamos la misma operación." : data ? `${operatorName(data.assignment.operator_id)} · revisión ${data.assignment.revision}${!current ? ". La solicitud cambió: volvé a abrir su versión actual." : ""}` : "Asignación todavía sin confirmar."}</p>
    {receiptRevision ? <p role="status">Cambio confirmado · revisión {receiptRevision}{data && data.assignment.revision > receiptRevision ? `; la asignación actual ya está en ${data.assignment.revision}` : ""}.</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}{candidatesError ? <p role="alert" className={styles.error}>{candidatesError}</p> : null}
    {operators?.length === 0 ? <p className={styles.notice} data-testid="supplier-request-operators-empty">No hay operadores habilitados en el catálogo confirmado. {canManageUsers ? <a href="/users" onClick={event => { if (!canInteract() || busy.current || unresolved.current || (dirty.current && !window.confirm("Hay una selección sin guardar. ¿Descartarla y abrir Usuarios?"))) event.preventDefault(); }}>Administrar el perfil Operador de solicitudes en Usuarios</a> : "Pedí a un administrador con permiso de gestión de usuarios que habilite un Operador de solicitudes."} Crear el perfil no asigna solicitudes automáticamente.</p> : null}
    {phase === "uncertain" ? <button className={styles.button} data-testid="supplier-request-assignment-retry" onClick={() => { if (operation.current && !busy.current) void execute(operation.current); }}>Comprobar la misma asignación</button> : null}
    {data ? <><label>Operador responsable<select data-testid="supplier-request-assignment-select" value={choice} disabled={blocked || loading || !current} onChange={event => { if (!canInteract() || read.current || busy.current || unresolved.current) return; choiceRef.current = event.target.value; setChoice(event.target.value); dirty.current = event.target.value !== (data.assignment.operator_id || ""); setConfirming(false); signalGuard(); }}><option value="">Sin responsable asignado</option>{choice && !operators?.some(item => item.id === choice) ? <option value={choice} disabled>{operatorName(choice)}</option> : null}{operators?.map(item => <option key={item.id} value={item.id} disabled={request.status === "provisioned"}>{item.display_name}</option>)}</select></label>{truncatedOperators ? <p className={styles.muted}>Se muestran hasta 100 operadores habilitados; el catálogo tiene más registros.</p> : null}<p className={styles.muted}>{request.status === "provisioned" ? "El pedido ya está preparado. Sólo se puede retirar la asignación vigente." : "Cambiar el responsable retira el acceso del anterior. No se envía una notificación externa."}</p><button className={styles.primary} data-testid="supplier-request-assignment-inspect" disabled={blocked || loading || !canSave || phase === "error" || phase === "conflict"} onClick={() => { if (canInteract() && !busy.current && !unresolved.current && !read.current && canSave) setConfirming(true); }}>Revisar cambio de responsable</button>
    {confirming ? <div className={styles.review}><h4 className={styles.historyTitle}>Confirmar asignación</h4><p>De: {operatorName(data.assignment.operator_id)}</p><p>A: {operatorName(choice || null)}</p><p>Se aplicará sólo a {request.title}, de {request.tenant_slug}.</p><div className={styles.actions}><button className={styles.primary} data-testid="supplier-request-assignment-confirm" disabled={blocked} onClick={confirm}>Confirmar cambio</button><button className={styles.button} disabled={blocked} onClick={() => setConfirming(false)}>Volver</button></div></div> : null}
    <details className={styles.commercial}><summary>Historial de responsables</summary><div data-testid="supplier-request-assignment-history">{data.history.length ? <ol className={styles.history}>{data.history.map(item => <li key={item.id}><strong>{item.action === "assign" ? "Responsable asignado" : "Asignación retirada"}</strong><p>{operatorName(item.operator_id)}</p><p className={styles.muted}>Superadministración NexID · revisión {item.revision} · <time dateTime={item.created_at}>{new Date(item.created_at).toISOString().slice(0, 16).replace("T", " · ")} UTC</time></p></li>)}</ol> : <p>Todavía no hay asignaciones registradas.</p>}{data.truncated ? <button className={styles.button} data-testid="supplier-request-assignment-older" disabled={blocked || loading} onClick={() => void refresh(true)}>Ver asignaciones anteriores</button> : null}</div></details></> : null}
  </section>;
}
