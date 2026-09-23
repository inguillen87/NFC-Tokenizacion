"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPLIER_CONSTRUCTIONS } from "../lib/supplier-order-draft";
import { supplierOperatorCan } from "../lib/supplier-operator-access";
import { supplierAssignedRequestCall, type SupplierAssignedRequest } from "../lib/supplier-assigned-request-client";
import { SupplierRequestError, type SupplierRequestReviewSummary } from "../lib/supplier-request-client";
import { ASSIGNED_WORKBENCH_LABELS, assignedWorkbenchActivity, assignedWorkbenchNextStep, assignedWorkbenchState, buildAssignedWorkbench, createAssignedReadScope, assignedReadDenialScope, type AssignedReadKind, type AssignedWorkbenchFilter, type AssignedWorkbenchSort } from "../lib/supplier-assigned-workbench";
import { SupplierRequestReview, type SupplierRequestReviewGuard } from "./supplier-request-review";
import type { SupplierRequestAccess } from "./supplier-request-workspace";
import styles from "./supplier-request-workspace.module.css";
import workbench from "./supplier-assigned-workbench.module.css";

const summaryCards: { filter: AssignedWorkbenchFilter; label: string }[] = [
  { filter: "all", label: "Solicitudes cargadas" },
  { filter: "actionable", label: "Para revisión de NexID" },
  { filter: "needs_information", label: "Esperando a la empresa" },
  { filter: "provisioned", label: "Pedidos preparados" },
];
function activityLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Fecha sin confirmar";
  return `${new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

export function SupplierAssignedRequestWorkspace({ access, initialRequestId = "" }: { access: SupplierRequestAccess; initialRequestId?: string }) {
  const allowed = supplierOperatorCan(access, "supplier_request.assigned.read");
  const canWrite = supplierOperatorCan(access, "supplier_request.assigned.review");
  const [items, setItems] = useState<SupplierAssignedRequest[] | null>(null), [truncated, setTruncated] = useState(false);
  const [listLoading, setListLoading] = useState(false), [listError, setListError] = useState("");
  const [selected, setSelected] = useState<SupplierAssignedRequest | null>(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [revoked, setRevoked] = useState(false);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState<AssignedWorkbenchFilter>("all");
  const [sort, setSort] = useState<AssignedWorkbenchSort>("review_first");
  const [blocked, setBlocked] = useState(false), [selectionVersion, setSelectionVersion] = useState(0);
  const alive = useRef(true), bootstrap = useRef(0), reads = useRef(createAssignedReadScope());
  const guard = useRef<SupplierRequestReviewGuard>({ dirty: false, locked: false }), heading = useRef<HTMLHeadingElement | null>(null);
  const onGuard = useCallback((value: SupplierRequestReviewGuard) => { guard.current = value; setBlocked(value.locked); }, []);
  // This ref-based check also prevents a send in the same event loop as a list refresh.
  const canInteract = useCallback(() => !reads.current.pending(), []);
  const withdrawAccess = useCallback((status: number) => {
    setRevoked(true);
    reads.current.invalidate(); setListLoading(false); setLoading(false);
    setItems(current => assignedReadDenialScope(status, "detail") === "all" ? null : current?.filter(item => item.id !== selected?.id) || current);
    // Keep the review mounted: it owns any uncertain write and its explicit exit confirmation.
  }, [selected?.id]);
  const onReview = useCallback((summary: SupplierRequestReviewSummary) => {
    setSelected(current => current && current.id === selected?.id ? { ...current, review_summary: summary } : current);
    setItems(current => current?.map(item => item.id === selected?.id ? { ...item, review_summary: summary } : item) || current);
  }, [selected?.id]);

  useEffect(() => {
    alive.current = true;
    const generation = ++bootstrap.current;
    if (allowed) void refresh().then(result => {
      // Mount the review only after the initial list read settles, so its initial history read is not suppressed.
      if ((result === "confirmed" || result === "unavailable") && alive.current && generation === bootstrap.current && initialRequestId) void open(initialRequestId);
    });
    const warn = (event: BeforeUnloadEvent) => { if (guard.current.dirty || guard.current.locked) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { alive.current = false; bootstrap.current++; reads.current.invalidate(); window.removeEventListener("beforeunload", warn); };
    // Parent remounts on every authenticated scope transition, including A -> B -> A.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (selectionVersion) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start", behavior: "auto" }); }
  }, [selectionVersion]);

  function denyRead(status: number, kind: AssignedReadKind, id?: string) {
    const scope = assignedReadDenialScope(status, kind);
    if (!scope) return;
    reads.current.invalidate(); setListLoading(false); setLoading(false);
    setItems(current => scope === "all" ? null : current?.filter(item => item.id !== id) || current);
    setSelected(null); setRevoked(true); onGuard({ dirty: false, locked: false });
    setNotice("El acceso cambió. Se ocultó el contenido anterior; no se envió ni se reintentó ningún mensaje.");
  }
  async function refresh(): Promise<"confirmed" | "denied" | "unavailable" | "ignored"> {
    if (!allowed || guard.current.locked || reads.current.pending()) return "ignored";
    const ticket = reads.current.begin("list");
    let denialKind: AssignedReadKind = "list", denialId: string | undefined;
    setListLoading(true); setListError(""); setItems(null);
    try {
      const result = await supplierAssignedRequestCall({ operatorId: access.userId!, signal: ticket.controller.signal });
      if (!alive.current || !reads.current.isCurrent(ticket)) return "ignored";
      if (!("items" in result)) throw Error();
      setItems(result.items); setTruncated(result.truncated);
      if (selected && !revoked) {
        // A successful or truncated list is not proof of access to the open record.
        // Reauthorize independently without remounting the review or discarding its draft.
        denialKind = "detail"; denialId = selected.id;
        const detail = await supplierAssignedRequestCall({ operatorId: access.userId!, id: selected.id, signal: ticket.controller.signal });
        if (!alive.current || !reads.current.isCurrent(ticket)) return "ignored";
        if (!("request" in detail)) throw new SupplierRequestError("contract_invalid");
      }
      return "confirmed";
    } catch (issue) {
      if (alive.current && reads.current.isCurrent(ticket)) {
        const status = issue instanceof SupplierRequestError ? issue.status : 0;
        const denial = assignedReadDenialScope(status, denialKind);
        denyRead(status, denialKind, denialId);
        setListError(denialKind === "detail"
          ? denial ? "La solicitud abierta ya no está disponible con tu acceso actual. No se envió ningún mensaje." : "La bandeja se actualizó, pero no se pudo volver a confirmar la solicitud abierta. Sus datos anteriores no se actualizaron."
          : denial ? "No se confirmó acceso a tu bandeja. Revisá tu sesión o consultá al administrador de NexID." : "No se confirmó tu bandeja. Esto no significa que no tengas solicitudes asignadas.");
        return denial ? "denied" : "unavailable";
      }
      return "ignored";
    } finally { if (reads.current.finish(ticket) && alive.current) setListLoading(false); }
  }
  async function open(id: string) {
    if (!allowed || guard.current.locked || reads.current.pending() || (guard.current.dirty && !window.confirm("Hay un mensaje sin guardar. ¿Descartarlo y abrir otra solicitud?"))) return;
    const ticket = reads.current.begin("detail");
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await supplierAssignedRequestCall({ operatorId: access.userId!, id, signal: ticket.controller.signal });
      if (!alive.current || !reads.current.isCurrent(ticket)) return;
      if (!("request" in result)) throw Error();
      onGuard({ dirty: false, locked: false }); setRevoked(false); setSelected(result.request); setSelectionVersion(value => value + 1);
    } catch (issue) {
      if (alive.current && reads.current.isCurrent(ticket)) {
        denyRead(issue instanceof SupplierRequestError ? issue.status : 0, "detail", id);
        setError("No se confirmó el acceso a esa solicitud. Puede haber cambiado tu asignación; actualizá la bandeja.");
      }
    } finally { if (reads.current.finish(ticket) && alive.current) setLoading(false); }
  }
  const { visible, counts } = buildAssignedWorkbench(items || [], search, filter, sort);
  const reading = loading || listLoading;

  return <main className={styles.root} data-testid="supplier-assigned-workspace">
    <header className={styles.hero}><div><p className={styles.eyebrow}>Operación interna de NexID</p><h1>Mis solicitudes asignadas</h1><p>Revisá las solicitudes a tu cargo y resolvé las aclaraciones con cada empresa.</p>
      <div className={workbench.scope}><span className={workbench.mode}>{canWrite ? "Revisión y aclaraciones" : "Solo lectura"}</span><span>Sin permisos de fabricación, stock ni programación NFC.</span></div>
    </div></header>
    {!allowed ? <p role="alert" className={styles.notice}>No se confirmó acceso a solicitudes asignadas. No se consultaron datos.</p> : <>
      <section className={styles.card} aria-labelledby="assigned-inbox" aria-busy={listLoading}>
        <div className={styles.heading}><h2 id="assigned-inbox">Tu bandeja</h2><button type="button" className={styles.button} disabled={blocked || reading} onClick={() => void refresh()}>Actualizar mis asignaciones</button></div>
        {items ? <><div className={workbench.summary} role="group" aria-label="Filtrar solicitudes por próximo paso">
          {summaryCards.map(card => <button key={card.filter} type="button" className={workbench.metric} aria-pressed={filter === card.filter} aria-label={`${card.label}: ${counts[card.filter]}. Filtrar bandeja`} onClick={() => setFilter(card.filter)}><strong aria-hidden="true">{counts[card.filter]}</strong><span>{card.label}</span></button>)}
        </div><p className={styles.muted}>Contadores de las solicitudes cargadas, antes de aplicar la búsqueda. No representan toda la cuenta ni un plazo de atención.</p></> : null}
        <div className={styles.toolbar}>
          <label>Buscar entre las solicitudes cargadas<input data-testid="supplier-request-inbox-search" type="search" placeholder="Empresa, título o referencia" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label>Estado de gestión<select data-testid="supplier-request-inbox-filter" value={filter} onChange={event => setFilter(event.target.value as AssignedWorkbenchFilter)}><option value="all">Todos los estados</option><option value="actionable">Para revisión de NexID</option>{Object.entries(ASSIGNED_WORKBENCH_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Ordenar solicitudes<select data-testid="supplier-assigned-sort" value={sort} onChange={event => setSort(event.target.value as AssignedWorkbenchSort)}><option value="review_first">Revisión primero</option><option value="oldest_activity">Actividad más antigua</option><option value="recent_activity">Actividad más reciente</option></select></label>
        </div>
        <p role="status" aria-live="polite">{listLoading ? "Consultando tus asignaciones…" : listError || (items?.length === 0 ? "La fuente confirmó que no tenés solicitudes asignadas en esta respuesta." : items && !visible.length ? "No hay coincidencias entre las solicitudes cargadas." : "")}</p>
        {items ? <p className={styles.muted} data-testid="supplier-request-inbox-count" role="status">{visible.length} de {items.length} solicitudes cargadas. {truncated ? "Hay más registros fuera de esta respuesta." : "Filtros aplicados sólo a esta respuesta."}</p> : null}
        {items && items.length > 0 && !visible.length ? <div className={workbench.empty}><strong>Ninguna solicitud coincide con estos filtros</strong><p>La búsqueda se limita a las asignaciones que recibiste en esta consulta.</p><button type="button" className={styles.button} onClick={() => { setSearch(""); setFilter("all"); }}>Limpiar búsqueda y filtros</button></div> : null}
        <ul className={styles.list}>{visible.map(item => <li key={item.id} className={!revoked && selected?.id === item.id ? workbench.itemSelected : undefined}>
          <div><strong>{item.title}</strong><span>{item.tenant_slug} · {ASSIGNED_WORKBENCH_LABELS[assignedWorkbenchState(item)]}</span><span className={workbench.nextStep}>{assignedWorkbenchNextStep(item, canWrite)}</span><span className={workbench.reference}>Referencia {item.id}</span><span>Actividad de revisión: <time dateTime={assignedWorkbenchActivity(item)}>{activityLabel(assignedWorkbenchActivity(item))}</time></span></div>
          <button type="button" className={styles.button} data-testid="supplier-request-open" disabled={blocked || reading} aria-label={`Ver solicitud ${item.title} de ${item.tenant_slug}, referencia ${item.id}`} aria-current={!revoked && selected?.id === item.id ? "true" : undefined} onClick={() => void open(item.id)}>Ver solicitud</button>
        </li>)}</ul>
      </section>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}{notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {selected ? <section className={styles.card} aria-busy={reading}><h2 ref={heading} tabIndex={-1} data-testid="supplier-request-detail-heading">{revoked ? "Acceso a la solicitud no disponible" : selected.title}</h2>
        {!revoked ? <><p className={styles.muted}>{selected.tenant_slug} · asignación versión {selected.assignment.revision} · {selected.id}</p><p className={styles.notice}>{assignedWorkbenchNextStep(selected, canWrite)}</p></> : null}
        <SupplierRequestReview key={`${selected.id}:${selected.revision}:${selectionVersion}`} request={selected} operatorId={access.userId} isNexid canWrite={canWrite} suspended={reading} canInteract={canInteract} onGuard={onGuard} onReview={onReview} onAccessUnavailable={withdrawAccess} onAccessWithdrawn={() => { onGuard({ dirty: false, locked: false }); setSelected(null); setNotice("Se cerró la solicitud. Cualquier mensaje sin recibo sigue sin confirmar; no se volvió a enviar."); void refresh(); }} />
        {!revoked ? <details className={styles.commercial}><summary>Consultar los datos comerciales enviados</summary><dl><dt>Construcción</dt><dd>{SUPPLIER_CONSTRUCTIONS.find(item => item.id === selected.construction_id)?.label}</dd><dt>Cantidad</dt><dd>{selected.quantity}</dd><dt>Destino</dt><dd>{selected.pack_purpose === "trial_integration" ? "Ensayo de integración" : "Producción"}</dd></dl><p className={styles.pre}>{selected.notes || "Sin notas"}</p></details> : null}
      </section> : null}
    </>}
  </main>;
}
