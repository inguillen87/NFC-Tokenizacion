"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPLIER_CONSTRUCTIONS } from "../lib/supplier-order-draft";
import { supplierOperatorCan } from "../lib/supplier-operator-access";
import { supplierAssignedRequestCall, type SupplierAssignedRequest } from "../lib/supplier-assigned-request-client";
import { filterSupplierRequestInbox, supplierRequestManagementState, SupplierRequestError, type SupplierRequestInboxFilter, type SupplierRequestReviewSummary } from "../lib/supplier-request-client";
import { SupplierRequestReview, type SupplierRequestReviewGuard } from "./supplier-request-review";
import type { SupplierRequestAccess } from "./supplier-request-workspace";
import styles from "./supplier-request-workspace.module.css";
const labels = { pending: "Revisión de NexID pendiente", needs_information: "Esperando respuesta de la empresa", answered: "Respuesta recibida", provisioned: "Pedido preparado", unknown: "Revisión sin confirmar", draft: "Borrador" };
export function SupplierAssignedRequestWorkspace({ access, initialRequestId = "" }: { access: SupplierRequestAccess; initialRequestId?: string }) {
  const allowed = supplierOperatorCan(access, "supplier_request.assigned.read"), canWrite = supplierOperatorCan(access, "supplier_request.assigned.review");
  const [items, setItems] = useState<SupplierAssignedRequest[] | null>(null), [truncated, setTruncated] = useState(false), [listLoading, setListLoading] = useState(false), [listError, setListError] = useState("");
  const [selected, setSelected] = useState<SupplierAssignedRequest | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [revoked, setRevoked] = useState(false);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState<SupplierRequestInboxFilter>("all"), [blocked, setBlocked] = useState(false), [selectionVersion, setSelectionVersion] = useState(0);
  const alive = useRef(true), read = useRef<AbortController | null>(null), listSequence = useRef(0), guard = useRef<SupplierRequestReviewGuard>({ dirty: false, locked: false }), heading = useRef<HTMLHeadingElement | null>(null);
  const onGuard = useCallback((value: SupplierRequestReviewGuard) => { guard.current = value; setBlocked(value.locked); }, []);
  const withdrawAccess = useCallback((status: number) => {
    setRevoked(true);
    // A list started before the denial must not put the removed data back on screen.
    listSequence.current++; setListLoading(false);
    setItems(current => status === 401 ? null : current?.filter(item => item.id !== selected?.id) || current);
  }, [selected?.id]);
  const canInteract = useCallback(() => !read.current, []);
  const onReview = useCallback((summary: SupplierRequestReviewSummary) => {
    setSelected(current => current && current.id === selected?.id ? { ...current, review_summary: summary } : current);
    setItems(current => current?.map(item => item.id === selected?.id ? { ...item, review_summary: summary } : item) || current);
  }, [selected?.id]);
  useEffect(() => {
    alive.current = true;
    if (allowed) { void refresh(); if (initialRequestId) void open(initialRequestId); }
    const warn = (event: BeforeUnloadEvent) => { if (guard.current.dirty || guard.current.locked) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { alive.current = false; read.current?.abort(); listSequence.current++; window.removeEventListener("beforeunload", warn); };
    // Parent remounts on every authenticated scope transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (selectionVersion) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start", behavior: "auto" }); } }, [selectionVersion]);
  async function refresh() {
    if (!allowed || guard.current.locked) return;
    const sequence = ++listSequence.current; setListLoading(true); setListError(""); setItems(null);
    try { const result = await supplierAssignedRequestCall({ operatorId: access.userId! }); if (!alive.current || sequence !== listSequence.current) return; if (!("items" in result)) throw Error(); setItems(result.items); setTruncated(result.truncated); }
    catch { if (alive.current && sequence === listSequence.current) setListError("No se confirmó tu bandeja. Esto no significa que no tengas solicitudes asignadas."); }
    finally { if (alive.current && sequence === listSequence.current) setListLoading(false); }
  }
  async function open(id: string) {
    if (!allowed || guard.current.locked || read.current || (guard.current.dirty && !window.confirm("Hay un mensaje sin guardar. ¿Descartarlo y abrir otra solicitud?"))) return;
    const controller = new AbortController(); read.current = controller; setLoading(true); setError(""); setNotice("");
    try { const result = await supplierAssignedRequestCall({ operatorId: access.userId!, id, signal: controller.signal }); if (!alive.current || read.current !== controller) return; if (!("request" in result)) throw Error(); onGuard({ dirty: false, locked: false }); setRevoked(false); setSelected(result.request); setSelectionVersion(value => value + 1); }
    catch (issue) { if (alive.current && read.current === controller) { if (issue instanceof SupplierRequestError && [401, 403, 404].includes(issue.status)) { listSequence.current++; setListLoading(false); setItems(current => issue.status === 401 ? null : current?.filter(item => item.id !== id) || current); setSelected(null); onGuard({ dirty: false, locked: false }); } setError("No se confirmó el acceso a esa solicitud. Puede haber cambiado tu asignación; actualizá la bandeja."); } }
    finally { if (read.current === controller) read.current = null; if (alive.current) setLoading(false); }
  }
  const visible = filterSupplierRequestInbox(items || [], search, filter);
  return <main className={styles.root} data-testid="supplier-assigned-workspace"><header className={styles.hero}><div><p className={styles.eyebrow}>Operación interna de NexID</p><h1>Mis solicitudes asignadas</h1><p>Revisá las solicitudes a tu cargo y resolvé las aclaraciones con cada empresa.</p></div></header>{!allowed ? <p role="alert" className={styles.notice}>No se confirmó acceso a solicitudes asignadas. No se consultaron datos.</p> : <>
    <section className={styles.card} aria-labelledby="assigned-inbox"><div className={styles.heading}><h2 id="assigned-inbox">Tu bandeja</h2><button className={styles.button} disabled={blocked || loading || listLoading} onClick={() => void refresh()}>Actualizar mis asignaciones</button></div><div className={styles.toolbar}><label>Buscar entre las solicitudes cargadas<input data-testid="supplier-request-inbox-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Estado de gestión<select data-testid="supplier-request-inbox-filter" value={filter} onChange={event => setFilter(event.target.value as SupplierRequestInboxFilter)}><option value="all">Todos los estados</option>{Object.entries(labels).filter(([key]) => key !== "draft").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><p role="status">{listLoading ? "Consultando tus asignaciones…" : listError || (items?.length === 0 ? "La fuente confirmó que no tenés solicitudes asignadas en esta respuesta." : items && !visible.length ? "No hay coincidencias entre las solicitudes cargadas." : "")}</p>{items ? <p className={styles.muted} data-testid="supplier-request-inbox-count">{visible.length} de {items.length} solicitudes cargadas. {truncated ? "Hay más registros fuera de esta respuesta." : "Filtros aplicados sólo a esta respuesta."}</p> : null}<ul className={styles.list}>{visible.map(item => <li key={item.id}><div><strong>{item.title}</strong><span>{item.tenant_slug} · {labels[supplierRequestManagementState(item)]}</span><span>Referencia {item.id.slice(0, 8)}</span></div><button className={styles.button} data-testid="supplier-request-open" disabled={blocked || loading} onClick={() => void open(item.id)}>Ver solicitud</button></li>)}</ul></section>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}{notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    {selected ? <section className={styles.card}><h2 ref={heading} tabIndex={-1} data-testid="supplier-request-detail-heading">{revoked ? "Acceso a la solicitud no disponible" : selected.title}</h2>{!revoked ? <p className={styles.muted}>{selected.tenant_slug} · asignación versión {selected.assignment.revision} · {selected.id}</p> : null}<SupplierRequestReview key={`${selected.id}:${selected.revision}:${selectionVersion}`} request={selected} operatorId={access.userId} isNexid canWrite={canWrite} suspended={loading} canInteract={canInteract} onGuard={onGuard} onReview={onReview} onAccessUnavailable={withdrawAccess} onAccessWithdrawn={() => { onGuard({ dirty: false, locked: false }); setSelected(null); setNotice("Se cerró la solicitud. Cualquier mensaje sin recibo sigue sin confirmar; no se volvió a enviar."); void refresh(); }} />{!revoked ? <details className={styles.commercial}><summary>Consultar los datos comerciales enviados</summary><dl><dt>Construcción</dt><dd>{SUPPLIER_CONSTRUCTIONS.find(item => item.id === selected.construction_id)?.label}</dd><dt>Cantidad</dt><dd>{selected.quantity}</dd><dt>Destino</dt><dd>{selected.pack_purpose === "trial_integration" ? "Ensayo de integración" : "Producción"}</dd></dl><p className={styles.pre}>{selected.notes || "Sin notas"}</p></details> : null}</section> : null}
  </>}</main>;
}
