"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SUPPLIER_CONSTRUCTIONS } from "../lib/supplier-order-draft";
import { dashboardHighImpactPermissionMatches } from "../lib/permission-policy";
import { filterSupplierRequestInbox, supplierRequestManagementState, supplierRequestCall, supplierRequestErrorCopy, SupplierRequestError, type SupplierRequest, type SupplierRequestCommand, type SupplierRequestContent, type SupplierRequestEnvelope, type SupplierRequestInboxFilter, type SupplierRequestReviewSummary } from "../lib/supplier-request-client";
import { SupplierRequestReview, type SupplierRequestReviewGuard } from "./supplier-request-review";
import styles from "./supplier-request-workspace.module.css";

export type SupplierRequestAccess = { id: string; role: string; tenantSlug: string | null; permissions: string[]; deniedPermissions?: string[]; isDemo: boolean };
type Props = { access: SupplierRequestAccess; initialTenant?: string; initialRequestId?: string };
type Fields = { title: string; construction_id: string; quantity: string; pack_purpose: string; notes: string };
const empty = (): Fields => ({ title: "", construction_id: "", quantity: "", pack_purpose: "", notes: "" });
const fromItem = (item: SupplierRequest): Fields => ({ title: item.title, construction_id: item.construction_id, quantity: item.quantity === null ? "" : String(item.quantity), pack_purpose: item.pack_purpose || "", notes: item.notes });
const statusLabel = (status: SupplierRequest["status"]) => status === "draft" ? "Borrador de la empresa" : status === "submitted" ? "Enviada a NexID" : "Pedido técnico preparado";
const managementLabels = { draft: "Borrador de la empresa", pending: "Revisión de NexID pendiente", needs_information: "Esperando respuesta de la empresa", answered: "Respuesta recibida · revisión de NexID", provisioned: "Pedido técnico preparado", unknown: "Revisión sin confirmar" };
const activityTime = (item: SupplierRequest) => item.review_summary?.updated_at || item.updated_at;
export function SupplierRequestWorkspace(props: Props) {
  // A new mounted instance is required for every authenticated scope transition, including A → B → A.
  const context = JSON.stringify([props.access.id, props.access.role, props.access.tenantSlug, props.access.permissions, props.access.deniedPermissions, props.access.isDemo, props.initialTenant, props.initialRequestId]);
  return <RequestWorkspace key={context} {...props} />;
}
function RequestWorkspace({ access, initialTenant = "", initialRequestId = "" }: Props) {
  const allowed = !access.isDemo && dashboardHighImpactPermissionMatches(access.role, access.permissions, "supplier_order.create", access.deniedPermissions);
  const isNexid = access.role === "super-admin";
  const [tenant, setTenant] = useState(access.tenantSlug || initialTenant);
  const [tenantInput, setTenantInput] = useState(access.tenantSlug || initialTenant);
  const [items, setItems] = useState<SupplierRequest[] | null>(null), [truncated, setTruncated] = useState(false);
  const [inboxSearch, setInboxSearch] = useState(""), [inboxFilter, setInboxFilter] = useState<SupplierRequestInboxFilter>("all");
  const [listError, setListError] = useState(""), [listReading, setListReading] = useState(false), [requestReading, setRequestReading] = useState(false);
  const reading = listReading || requestReading;
  const [selected, setSelected] = useState<SupplierRequest | null>(null), [fields, setFields] = useState<Fields>(empty);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const [comparison, setComparison] = useState<SupplierRequest | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "uncertain" | "conflict" | "error">("idle");
  const [error, setError] = useState(""), [confirmedRevision, setConfirmedRevision] = useState<number | null>(null), [reviewing, setReviewing] = useState(false);
  const alive = useRef(true), epoch = useRef(0), busy = useRef(false), locked = useRef(false), unresolved = useRef(false), operation = useRef<SupplierRequestCommand | null>(null);
  const readSequence = useRef(0), listSequence = useRef(0), initialOpened = useRef(false);
  const reads = useRef<AbortController | null>(null), writes = useRef<AbortController | null>(null);
  const reviewGuard = useRef<SupplierRequestReviewGuard>({ dirty: false, locked: false });
  const [reviewBlocked, setReviewBlocked] = useState(false);
  const updateReviewGuard = useCallback((value: SupplierRequestReviewGuard) => { reviewGuard.current = value; setReviewBlocked(value.locked); }, []);
  const updateReview = useCallback((summary: SupplierRequestReviewSummary) => {
    setSelected(current => current && current.id === selected?.id && current.tenant_id === selected.tenant_id ? { ...current, review_summary: summary } : current);
    if (selected) setItems(current => current ? current.map(item => item.id === selected.id && item.tenant_id === selected.tenant_id ? { ...item, review_summary: summary } : item).sort((a, b) => activityTime(b).localeCompare(activityTime(a))) : current);
  }, [selected?.id, selected?.tenant_id]);
  const canReviewInteract = useCallback(() => !reads.current && !locked.current, []);
  const dirty = JSON.stringify(fields) !== JSON.stringify(selected ? fromItem(selected) : empty());
  const immutable = Boolean(selected && selected.status !== "draft"), blocked = phase === "saving" || phase === "uncertain" || unresolved.current || reviewBlocked;

  useEffect(() => { alive.current = true; return () => { alive.current = false; epoch.current++; reads.current?.abort(); writes.current?.abort(); }; }, []);
  useEffect(() => {
    if (!selectionVersion) return;
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [selectionVersion]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || locked.current || reviewGuard.current.dirty || reviewGuard.current.locked) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!allowed) return;
    void loadList(tenant);
    if (initialRequestId && !initialOpened.current) { initialOpened.current = true; void openRequest(initialRequestId, tenant, true); }
    // Initial request belongs to the keyed, authenticated context above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, allowed]);

  async function loadList(scope: string) {
    if (locked.current || reviewGuard.current.locked) return;
    const generation = epoch.current, sequence = ++listSequence.current;
    setItems(null); setListError(""); setListReading(true);
    try {
      const result = await supplierRequestCall({ tenant: scope });
      if (!alive.current || generation !== epoch.current || sequence !== listSequence.current) return;
      if (!("items" in result)) throw new SupplierRequestError("contract_invalid");
      setItems(result.items); setTruncated(result.truncated);
    } catch { if (alive.current && generation === epoch.current && sequence === listSequence.current) setListError("No se confirmó la bandeja. Esto no significa que no existan solicitudes."); }
    finally { if (alive.current && generation === epoch.current && sequence === listSequence.current) setListReading(false); }
  }
  function canLeave() {
    if (locked.current || reviewGuard.current.locked) return false;
    return !(dirty || reviewGuard.current.dirty) || window.confirm("Hay cambios sin guardar. ¿Descartarlos y continuar?");
  }
  function resetEditor() { updateReviewGuard({ dirty: false, locked: false }); setSelected(null); setFields(empty()); setComparison(null); setPhase("idle"); setError(""); setConfirmedRevision(null); setReviewing(false); setRequestReading(false); operation.current = null; }
  function changeTenant() {
    if (!canLeave()) return;
    const next = tenantInput.trim().toLowerCase();
    if (next && !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(next)) { setError("Revisá el identificador de la empresa."); return; }
    epoch.current++; reads.current?.abort(); resetEditor(); setItems(null);
    if (next === tenant) void loadList(next); else setTenant(next);
  }
  async function openRequest(id: string, scope: string, initial = false, compare = false) {
    if (!allowed || reviewGuard.current.locked || (!initial && !compare && !canLeave()) || busy.current || (locked.current && !compare)) return;
    if (!scope) { setError("Abrí la solicitud desde la empresa indicada en la bandeja."); return; }
    const generation = epoch.current, sequence = ++readSequence.current;
    reads.current?.abort(); const controller = new AbortController(); reads.current = controller;
    setRequestReading(true); setError("");
    try {
      const result = await supplierRequestCall({ tenant: scope, id, signal: controller.signal });
      if (!alive.current || generation !== epoch.current || sequence !== readSequence.current) return;
      if (!("request" in result)) throw new SupplierRequestError("contract_invalid");
      if (compare) setComparison(result.request);
      else { updateReviewGuard({ dirty: false, locked: false }); setSelectionVersion(current => current + 1); setSelected(result.request); setFields(fromItem(result.request)); setComparison(null); setPhase("idle"); setConfirmedRevision(null); setReviewing(false); }
    } catch (issue) { if (alive.current && generation === epoch.current && sequence === readSequence.current) setError(supplierRequestErrorCopy(issue instanceof SupplierRequestError ? issue : new SupplierRequestError("unavailable"))); }
    finally { if (reads.current === controller) reads.current = null; if (alive.current && generation === epoch.current && sequence === readSequence.current) setRequestReading(false); }
  }
  function content(): SupplierRequestContent | null {
    const title = fields.title.trim(), notes = fields.notes.trim();
    if (!title || title.length > 200 || notes.length > 4000) { setError("Ingresá un nombre de hasta 200 caracteres y notas de hasta 4000."); return null; }
    const quantity = fields.quantity.trim() ? Number(fields.quantity) : null;
    if (quantity !== null && (!/^\d+$/.test(fields.quantity.trim()) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100_000_000)) { setError("La cantidad debe ser un entero entre 1 y 100.000.000, o quedar vacía en un borrador."); return null; }
    return { title, notes, quantity, construction_id: fields.construction_id, pack_purpose: fields.pack_purpose === "trial_integration" || fields.pack_purpose === "production" ? fields.pack_purpose : null };
  }
  async function execute(command: SupplierRequestCommand) {
    if (!allowed || busy.current) return;
    busy.current = true; locked.current = true; operation.current = command;
    const generation = epoch.current, controller = new AbortController(); writes.current = controller;
    setPhase("saving"); setError(""); setReviewing(false);
    try {
      const result = await supplierRequestCall({ tenant: command.tenant, id: command.id, command, signal: controller.signal }) as SupplierRequestEnvelope;
      if (!alive.current || generation !== epoch.current) return;
      unresolved.current = false; locked.current = false; operation.current = null;
      setSelected(result.request); setFields(fromItem(result.request)); setConfirmedRevision(result.receipt!.revision); setPhase("saved"); setComparison(null);
      // The response, including later revisions returned by an idempotent replay, is authoritative.
      setItems(current => current ? [result.request, ...current.filter(item => item.id !== result.request.id)].filter(item => tenant || item.status !== "draft") : current);
    } catch (issue) {
      if (!alive.current || generation !== epoch.current) return;
      const failure = issue instanceof SupplierRequestError ? issue : new SupplierRequestError("unavailable", 0, true);
      unresolved.current ||= failure.uncertain;
      locked.current = unresolved.current;
      setPhase(unresolved.current ? "uncertain" : ["supplier_request_revision_conflict", "supplier_request_not_draft"].includes(failure.code) ? "conflict" : "error");
      setError(supplierRequestErrorCopy(failure));
      if (!unresolved.current) operation.current = null;
    } finally { busy.current = false; if (writes.current === controller) writes.current = null; }
  }
  function save() {
    if (!allowed || locked.current || reads.current || reading || immutable || !tenant && !selected) return;
    const value = content(); if (!value) return;
    const scope = selected?.tenant_slug || tenant;
    const command: SupplierRequestCommand = Object.freeze({ tenant: scope, ...(selected ? { id: selected.id } : {}), action: selected ? "patch" : "create", key: crypto.randomUUID(), body: Object.freeze({ ...value, ...(selected ? { expected_revision: selected.revision } : {}) }) });
    void execute(command);
  }
  function submit() {
    if (!reviewing || !selected || dirty || selected.status !== "draft" || locked.current || !allowed) return;
    void execute(Object.freeze({ tenant: selected.tenant_slug, id: selected.id, action: "submit", key: crypto.randomUUID(), body: Object.freeze({ expected_revision: selected.revision }) }));
  }
  function edit(field: keyof Fields, value: string) { if (locked.current || reads.current || immutable) return; setFields(current => ({ ...current, [field]: value })); setReviewing(false); }
  const complete = Boolean(selected?.construction_id && selected.quantity && selected.pack_purpose);
  const currentTenant = selected?.tenant_slug || tenant;
  const visibleItems = filterSupplierRequestInbox(items || [], inboxSearch, inboxFilter);

  return <main className={styles.root} data-testid="supplier-request-workspace">
    <header className={styles.hero}><div><p className={styles.eyebrow}>Empresa → NexID</p><h1>Solicitudes de etiquetas</h1><p>La empresa describe lo que necesita. NexID recibe la solicitud y prepara la orden técnica. Guardar o enviar aquí no genera llaves ni envía un pedido a fábrica.</p></div><a href="/batches/supplier" className={styles.button} onClick={event => { if (!canLeave()) event.preventDefault(); }}>Recepción y pedidos</a></header>
    {!allowed ? <p role="alert" className={styles.notice}>Tu sesión no tiene permiso para gestionar solicitudes. No se consultaron ni guardaron datos.</p> : <>
      {isNexid ? <div className={styles.toolbar}><label>Empresa (vacía: bandeja de NexID)<input data-testid="supplier-request-tenant" value={tenantInput} disabled={blocked} onChange={event => setTenantInput(event.target.value)} /></label><button type="button" className={styles.button} disabled={blocked || reading} onClick={changeTenant}>Consultar empresa</button></div> : <p className={styles.notice}>Empresa: <strong>{tenant}</strong>. La solicitud se guarda únicamente para esta empresa.</p>}
      <section className={styles.card} aria-labelledby="supplier-requests-inbox"><div className={styles.heading}><h2 id="supplier-requests-inbox">{isNexid && !tenant ? "Bandeja de NexID" : "Solicitudes de la empresa"}</h2><div className={styles.actions}><button className={styles.button} type="button" disabled={blocked || reading} onClick={() => { if (!locked.current) void loadList(tenant); }}>Actualizar bandeja</button><button className={styles.button} type="button" disabled={blocked || !tenant} onClick={() => { if (canLeave()) { epoch.current++; reads.current?.abort(); resetEditor(); } }}>Nueva solicitud</button></div></div>
        <p className={styles.muted}>{isNexid && !tenant ? "Sólo solicitudes enviadas y pedidos preparados. Los borradores internos no aparecen en la bandeja global." : "Los borradores siguen pendientes de envío; guardarlos no informa a NexID."}</p>
        <div className={styles.toolbar}><label>Buscar entre las solicitudes cargadas<input data-testid="supplier-request-inbox-search" type="search" value={inboxSearch} onChange={event => setInboxSearch(event.target.value)} placeholder="Producto, empresa o referencia" /></label><label>Estado de gestión<select data-testid="supplier-request-inbox-filter" value={inboxFilter} onChange={event => setInboxFilter(event.target.value as SupplierRequestInboxFilter)}><option value="all">Todos los estados</option>{Object.entries(managementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <p role="status">{listError || (listReading && items === null ? "Consultando la fuente…" : items?.length === 0 ? "La fuente no encontró solicitudes en este alcance." : items && visibleItems.length === 0 ? "No hay coincidencias entre las solicitudes cargadas. Probá otro filtro o búsqueda." : "")}</p>
        {items ? <p className={styles.muted} data-testid="supplier-request-inbox-count">{visibleItems.length} de {items.length} solicitudes cargadas{truncated ? "; no es el total del historial" : ""}. Los filtros se aplican sólo a esta respuesta.</p> : null}
        {visibleItems.length ? <ul className={styles.list}>{visibleItems.map(item => <li key={item.id}><div><strong>{item.title}</strong><span>{item.tenant_slug} · {managementLabels[supplierRequestManagementState(item)]} · versión {item.revision}</span><span>Última actividad: <time dateTime={activityTime(item)}>{activityTime(item).slice(0, 10)} · {activityTime(item).slice(11, 16)} UTC</time></span><code>{item.id}</code></div><button className={styles.button} data-testid="supplier-request-open" type="button" disabled={blocked || reading} onClick={() => void openRequest(item.id, item.tenant_slug)}>Ver solicitud</button></li>)}</ul> : null}
        {truncated && items ? <p className={styles.notice}>Se muestran las solicitudes más recientes; hay más registros fuera de esta respuesta.</p> : null}
      </section>
      {(tenant || selected) ? <section className={styles.card} aria-labelledby="supplier-request-editor">
        <div className={styles.heading}><div><h2 id="supplier-request-editor" ref={detailHeading} tabIndex={-1} data-testid="supplier-request-detail-heading">{selected ? selected.title : "Nueva solicitud"}</h2><p className={styles.muted}>{currentTenant}{selected ? ` · ${statusLabel(selected.status)} · ${selected.id}` : " · todavía sin guardar"}</p></div></div>
        <p role="status" data-testid="supplier-request-status" className={styles.notice}>{phase === "saving" ? "Guardando en el servidor…" : phase === "uncertain" ? "Resultado sin confirmar. Conservamos la misma operación." : confirmedRevision ? `Guardado confirmado · versión ${confirmedRevision}${selected && selected.revision > confirmedRevision ? `; la fuente ya está en la versión ${selected.revision}` : ""}${dirty ? " · cambios nuevos sin guardar" : ""}` : selected ? `Versión ${selected.revision}${dirty ? " · cambios sin guardar" : " · sin cambios"}` : "Borrador nuevo: aún no está guardado en el servidor."}</p>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {phase === "uncertain" ? <button className={styles.button} data-testid="supplier-request-retry" type="button" onClick={() => { if (operation.current && !busy.current) void execute(operation.current); }}>Comprobar el mismo guardado</button> : null}
        {phase === "conflict" && selected ? <div data-testid="supplier-request-conflict"><p>Tu texto permanece sin guardar. Consultá la versión actual; no se sobrescribe automáticamente.</p><button type="button" className={styles.button} disabled={reading} onClick={() => void openRequest(selected.id, selected.tenant_slug, false, true)}>Consultar versión actual</button></div> : null}
        {comparison ? <div className={styles.notice}><h3>Versión actual del servidor: {comparison.revision}</h3><p>{comparison.title} · {statusLabel(comparison.status)} · {comparison.quantity ?? "cantidad pendiente"}</p><p className={styles.pre}>{comparison.notes || "Sin notas"}</p><button className={styles.button} type="button" onClick={() => { if (locked.current || !window.confirm("¿Reemplazar los cambios locales por esta versión guardada?")) return; setSelected(comparison); setFields(fromItem(comparison)); setComparison(null); setConfirmedRevision(null); setError(""); setPhase("idle"); }}>Cargar esta versión y descartar mis cambios</button></div> : null}
        {selected && immutable ? <SupplierRequestReview key={`${selected.id}:${selected.revision}:${selected.status}:${selectionVersion}`} request={selected} isNexid={isNexid} suspended={requestReading} canInteract={canReviewInteract} onGuard={updateReviewGuard} onReview={updateReview} /> : null}
        <details className={styles.commercial} open={!immutable}><summary>{immutable ? "Consultar los datos comerciales enviados" : "Completar los datos de la solicitud"}</summary>
        <form onSubmit={event => { event.preventDefault(); save(); }}>
          <fieldset disabled={blocked || immutable || reading} className={styles.fields}><div className={styles.grid}>
            <label>Producto o proyecto<input data-testid="supplier-request-title" value={fields.title} maxLength={200} onChange={event => edit("title", event.target.value)} /></label>
            <label>Construcción solicitada<select data-testid="supplier-request-construction" value={fields.construction_id} onChange={event => edit("construction_id", event.target.value)}><option value="">Por definir</option>{SUPPLIER_CONSTRUCTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Cantidad solicitada<input data-testid="supplier-request-quantity" type="number" inputMode="numeric" min="1" max="100000000" step="1" value={fields.quantity} onChange={event => edit("quantity", event.target.value)} /></label>
            <label>Destino del pedido<select data-testid="supplier-request-purpose" value={fields.pack_purpose} onChange={event => edit("pack_purpose", event.target.value)}><option value="">Sin elegir</option><option value="trial_integration">Ensayo de integración · no vendible</option><option value="production">Producción · requiere aprobación de calidad</option></select></label>
          </div><label>Necesidades y notas<textarea data-testid="supplier-request-notes" rows={4} maxLength={4000} value={fields.notes} onChange={event => edit("notes", event.target.value)} /></label><p className={styles.muted}>No incluyas llaves ni secretos. Construcción, cantidad y destino pueden quedar pendientes en el borrador; el nombre permite encontrarlo después.</p></fieldset>
          {!immutable ? <div className={styles.actions}><button className={styles.primary} data-testid="supplier-request-save" type="submit" disabled={blocked || reading}>Guardar borrador</button><button className={styles.button} data-testid="supplier-request-review" type="button" disabled={blocked || reading || !selected || dirty || !complete} onClick={() => { if (!locked.current && selected && !dirty && complete) setReviewing(true); }}>Revisar envío a NexID</button></div> : null}
        </form>
        </details>
        {!immutable && selected && dirty ? <p className={styles.muted}>Guardá los cambios antes de revisar el envío.</p> : null}
        {reviewing && selected ? <div className={styles.review} data-testid="supplier-request-confirmation"><h3>Confirmar envío a NexID</h3><dl><div><dt>Empresa</dt><dd>{selected.tenant_slug}</dd></div><div><dt>Producto o proyecto</dt><dd>{selected.title}</dd></div><div><dt>Construcción</dt><dd>{SUPPLIER_CONSTRUCTIONS.find(item => item.id === selected.construction_id)?.label}</dd></div><div><dt>Cantidad</dt><dd>{selected.quantity}</dd></div><div><dt>Destino</dt><dd>{selected.pack_purpose === "trial_integration" ? "Ensayo no vendible" : "Producción sujeta a aprobación"}</dd></div></dl><p>La solicitud quedará cerrada para edición y visible para NexID. Esto no confirma precio, compra, envío a fábrica, generación de llaves ni aceptación de las etiquetas.</p><div className={styles.actions}><button className={styles.primary} data-testid="supplier-request-submit" type="button" disabled={blocked} onClick={submit}>Enviar solicitud a NexID</button><button className={styles.button} type="button" onClick={() => setReviewing(false)}>Volver</button></div></div> : null}
        {selected?.status === "submitted" ? <p className={styles.notice}>NexID recibió la solicitud. La preparación técnica y las pruebas siguen pendientes.</p> : null}
        {selected?.status === "provisioned" ? <p className={styles.notice}>La fuente confirma un pedido técnico vinculado. No significa que se haya enviado a fábrica ni aprobado QA. <a href={`/supplier-orders/${selected.order_id}?tenant=${encodeURIComponent(selected.tenant_slug)}`}>Ver pedido</a></p> : null}
      </section> : null}
    </>}
  </main>;
}
