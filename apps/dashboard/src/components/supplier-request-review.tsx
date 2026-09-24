"use client";
import { useEffect, useRef, useState } from "react";
import { SupplierRequestError, type SupplierRequest, type SupplierRequestReviewSummary } from "../lib/supplier-request-client";
import { supplierRequestReviewCall, supplierRequestReviewErrorCopy, type SupplierRequestReviewCommand, type SupplierRequestReviewEnvelope } from "../lib/supplier-request-review-client";
import styles from "./supplier-request-workspace.module.css";

export type SupplierRequestReviewGuard = { dirty: boolean; locked: boolean };
type Props = { request: SupplierRequest; isNexid: boolean; operatorId?: string; canWrite?: boolean; onAccessUnavailable?: (status: number) => void; onAccessWithdrawn?: () => void; suspended: boolean; canInteract: () => boolean; onGuard: (guard: SupplierRequestReviewGuard) => void; onReview: (summary: SupplierRequestReviewSummary) => void };
const stateCopy = { pending: "NexID debe revisar la solicitud.", needs_information: "La empresa debe responder la aclaración de NexID.", answered: "NexID debe revisar la respuesta de la empresa." };
const timestamp = (date: string) => { const utc = new Date(date).toISOString(); return `${utc.slice(0, 10)} · ${utc.slice(11, 16)} UTC`; };
export function SupplierRequestReview({ request, isNexid, operatorId, canWrite = true, onAccessUnavailable, onAccessWithdrawn, suspended, canInteract, onGuard, onReview }: Props) {
  const [data, setData] = useState<SupplierRequestReviewEnvelope | null>(null), [message, setMessage] = useState("");
  const [reading, setReading] = useState(false), [phase, setPhase] = useState<"idle" | "saving" | "uncertain" | "conflict" | "error" | "saved">("idle");
  const [error, setError] = useState(""), [confirming, setConfirming] = useState(false), [receiptRevision, setReceiptRevision] = useState<number | null>(null);
  const [accessWithdrawn, setAccessWithdrawn] = useState(false);
  const alive = useRef(true), readController = useRef<AbortController | null>(null), writeController = useRef<AbortController | null>(null);
  const busy = useRef(false), unresolved = useRef(false), command = useRef<SupplierRequestReviewCommand | null>(null), text = useRef(""), sequence = useRef(0), readingRef = useRef(false);
  const blocked = phase === "saving" || phase === "uncertain" || suspended;
  const action = isNexid ? "request_information" : "respond";
  const currentRequest = data?.request_revision === request.revision;
  const canAct = Boolean(canWrite && !accessWithdrawn && currentRequest && request.status === "submitted" && data && (isNexid ? data.review.state !== "needs_information" : data.review.state === "needs_information"));
  const actionLabel = isNexid ? "Pedir aclaración a la empresa" : "Responder a NexID";

  useEffect(() => {
    alive.current = true; void refresh();
    return () => { alive.current = false; sequence.current++; readController.current?.abort(); writeController.current?.abort(); };
    // The parent keys this panel to the request, authenticated scope and request revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function guard() { onGuard({ dirty: Boolean(text.current.trim()), locked: busy.current || unresolved.current }); }
  function withdrawAccess(status: number) { setAccessWithdrawn(true); setData(null); onAccessUnavailable?.(status); }
  async function refresh(older = false) {
    if (!canInteract() || busy.current || unresolved.current || readingRef.current || (older && !data?.next_before_revision)) return;
    const seq = ++sequence.current, controller = new AbortController(); readController.current = controller; readingRef.current = true;
    setReading(true); setError(""); setConfirming(false);
    try {
      const result = await supplierRequestReviewCall({ tenant: request.tenant_slug, tenantId: request.tenant_id, id: request.id, operatorId, ...(older ? { beforeRevision: data!.next_before_revision! } : {}), signal: controller.signal });
      if (!alive.current || seq !== sequence.current) return;
      if (older && (result.review.revision !== data!.review.revision || result.request_revision !== data!.request_revision)) throw new SupplierRequestError("supplier_request_review_revision_conflict", 409);
      if (older) {
        if (!result.history.length || result.history.at(-1)!.revision + 1 !== data!.history[0]?.revision || result.history.some(item => data!.history.some(existing => existing.id === item.id || existing.revision === item.revision))) throw new SupplierRequestError("contract_invalid");
        setData({ ...result, history: [...result.history, ...data!.history], count: result.count + data!.count });
        setPhase("idle");
      } else { setData(result); setReceiptRevision(null); setPhase("idle"); }
      onReview(result.review);
    } catch (issue) {
      if (!alive.current || seq !== sequence.current) return;
      if (operatorId && issue instanceof SupplierRequestError && [401, 403, 404].includes(issue.status)) withdrawAccess(issue.status);
      setError(supplierRequestReviewErrorCopy(issue instanceof SupplierRequestError ? issue : new SupplierRequestError("unavailable")));
      // An unconfirmed refresh cannot authorize a new action using the older view.
      setPhase("error");
    } finally { if (alive.current && seq === sequence.current) { readingRef.current = false; setReading(false); } if (readController.current === controller) readController.current = null; }
  }
  function edit(value: string) {
    if (!canInteract() || busy.current || unresolved.current || readingRef.current) return;
    text.current = value; setMessage(value); setConfirming(false); guard();
  }
  async function execute(operation: SupplierRequestReviewCommand) {
    if (!canInteract() || busy.current || readingRef.current) return;
    busy.current = true; command.current = operation; guard(); setPhase("saving"); setError(""); setConfirming(false);
    const controller = new AbortController(); writeController.current = controller;
    try {
      const result = await supplierRequestReviewCall({ tenant: request.tenant_slug, tenantId: request.tenant_id, id: request.id, operatorId, command: operation, signal: controller.signal });
      if (!alive.current) return;
      unresolved.current = false; command.current = null; text.current = ""; setMessage(""); setData(result); onReview(result.review); setReceiptRevision(result.receipt!.revision); setPhase("saved");
    } catch (issue) {
      if (!alive.current) return;
      const failure = issue instanceof SupplierRequestError ? issue : new SupplierRequestError("unavailable", 0, true);
      if (operatorId && [401, 403, 404].includes(failure.status)) withdrawAccess(failure.status);
      unresolved.current ||= failure.uncertain;
      setPhase(unresolved.current ? "uncertain" : failure.status === 409 ? "conflict" : "error"); setError(supplierRequestReviewErrorCopy(failure));
      if (!unresolved.current) command.current = null;
    } finally { busy.current = false; if (alive.current) guard(); if (writeController.current === controller) writeController.current = null; }
  }
  function send() {
    if (!canInteract() || !confirming || !canAct || !data || busy.current || unresolved.current || readingRef.current || phase === "conflict" || phase === "error") return;
    const value = text.current.trim(); if (!value || value.length > 2000) return;
    void execute(Object.freeze({ tenant: request.tenant_slug, id: request.id, operatorId, key: crypto.randomUUID(), body: Object.freeze({ action, message: value, expected_revision: data.review.revision, expected_request_revision: request.revision }) }));
  }
  if (accessWithdrawn && operatorId) return <section className={styles.notice} data-testid="supplier-request-access-withdrawn"><h3>Tu acceso a esta solicitud ya no está disponible</h3><p>{unresolved.current ? "El resultado del mensaje sigue sin confirmar. Salir no lo cancela ni lo vuelve a enviar. Pedí al administrador de NexID que consulte el historial." : "La fuente ya no permite consultar o gestionar esta solicitud. Podés volver a tu bandeja para ver las asignaciones vigentes."}</p>{message ? <p className={styles.pre}>Tu mensaje: {message}</p> : null}<button className={styles.button} data-testid="supplier-request-exit-withdrawn" type="button" disabled={busy.current} onClick={() => { if (busy.current || !window.confirm(unresolved.current ? "¿Salir dejando el resultado sin confirmar? No se reenviará el mensaje. Consultá con NexID antes de volver a intentarlo." : "¿Cerrar esta solicitud y volver a tus asignaciones? El texto local se descartará.")) return; unresolved.current = false; command.current = null; text.current = ""; onGuard({ dirty: false, locked: false }); onAccessWithdrawn?.(); }}>{unresolved.current ? "Salir con resultado sin confirmar" : "Volver a mis asignaciones"}</button></section>;
  const confirmedCurrent = Boolean(data && currentRequest && phase !== "error" && phase !== "conflict" && !reading);
  return <section className={styles.reviewPanel} aria-labelledby="supplier-review-heading" data-testid="supplier-request-review-panel">
    <div className={styles.heading}><div><h3 id="supplier-review-heading">Aclaraciones con {isNexid ? "la empresa" : "NexID"}</h3><p className={styles.muted}>Este historial es visible para ambas partes. No cambia los datos comerciales enviados ni envía mensajes fuera de NexID.</p></div><button className={styles.button} data-testid="supplier-request-review-refresh" type="button" disabled={blocked || reading} onClick={() => void refresh()}>Consultar estado actual</button></div>
    <p className={styles.notice} role="status" data-testid="supplier-request-review-state">{reading ? "Consultando aclaraciones…" : phase === "saving" ? "Guardando el mensaje…" : phase === "uncertain" ? "Mensaje sin confirmar. La misma operación sigue pendiente." : !data || phase === "error" ? "No se confirmó el estado de revisión. La preparación técnica sigue bloqueada." : !currentRequest ? "La solicitud cambió. Volvé a abrir su versión actual; tu texto se conserva hasta que decidas salir." : request.status === "cancelled" ? "Solicitud cancelada: historial disponible para consulta; no admite nuevas aclaraciones." : request.status === "provisioned" ? "Pedido preparado: historial disponible para consulta." : stateCopy[data.review.state]}</p>
    {receiptRevision ? <p role="status" data-testid="supplier-request-review-receipt">Mensaje guardado · revisión {receiptRevision}{data && data.review.revision > receiptRevision ? `; el historial actual ya está en la revisión ${data.review.revision}` : ""}.</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {phase === "uncertain" ? <button className={styles.button} data-testid="supplier-request-review-retry" type="button" onClick={() => { if (command.current && !busy.current) void execute(command.current); }}>Comprobar el mismo mensaje</button> : null}
    {data ? <div data-testid="supplier-request-review-history"><h4 className={styles.historyTitle}>Historial de aclaraciones</h4>{data.history.length ? <ol className={styles.history}>{data.history.map(item => <li key={item.id}><div className={styles.historyMeta}><strong>{item.action === "request_information" ? "NexID pidió una aclaración" : "La empresa respondió"}</strong><time dateTime={item.created_at}>{timestamp(item.created_at)}</time></div><p className={styles.pre}>{item.message}</p><span className={styles.muted}>Revisión {item.revision} · solicitud versión {item.request_revision}</span></li>)}</ol> : <p className={styles.muted}>Todavía no hay aclaraciones registradas.</p>}{data.truncated ? <button className={styles.button} data-testid="supplier-request-review-older" disabled={blocked || reading} type="button" onClick={() => void refresh(true)}>Ver aclaraciones anteriores</button> : null}</div> : null}
    {request.status === "submitted" && (canAct || message) ? <div className={styles.messageForm}><label htmlFor="supplier-review-message">{isNexid ? "Qué necesita aclarar la empresa" : "Respuesta de la empresa"}<textarea id="supplier-review-message" data-testid="supplier-request-review-message" maxLength={2000} rows={4} value={message} disabled={blocked || reading} onChange={event => edit(event.target.value)} /></label><p className={styles.muted}>{message.length}/2000 caracteres. No incluyas llaves, tokens, contraseñas ni datos personales innecesarios.</p><button className={styles.primary} data-testid="supplier-request-review-inspect" type="button" disabled={!canAct || !confirmedCurrent || blocked || !message.trim()} onClick={() => { if (!busy.current && !unresolved.current && !readingRef.current && canAct && confirmedCurrent && text.current.trim()) setConfirming(true); }}>Revisar {isNexid ? "aclaración" : "respuesta"}</button></div> : null}
    {confirming ? <div className={styles.review} data-testid="supplier-request-review-confirmation"><h4 className={styles.historyTitle}>{actionLabel}</h4><p className={styles.pre}>{message.trim()}</p><p>{isNexid ? "La preparación del pedido quedará bloqueada hasta que la empresa responda." : "NexID podrá revisar tu respuesta y continuar la preparación. Esto no confirma precio, compra ni aprobación de calidad."}</p><div className={styles.actions}><button className={styles.primary} data-testid="supplier-request-review-confirm" type="button" disabled={blocked} onClick={send}>{actionLabel}</button><button className={styles.button} type="button" disabled={blocked} onClick={() => setConfirming(false)}>Volver al mensaje</button></div></div> : null}
    {isNexid && !operatorId && request.status === "submitted" ? confirmedCurrent && data!.review.state !== "needs_information" && !message.trim() && !blocked ? <a className={styles.primary} data-testid="supplier-request-prepare" href={`/supplier-orders/create?request=${request.id}&tenant=${encodeURIComponent(request.tenant_slug)}`} onClick={event => { if (!canInteract() || busy.current || unresolved.current || text.current.trim() || readingRef.current) event.preventDefault(); }}>Preparar pedido técnico</a> : <p className={styles.muted} data-testid="supplier-request-prepare-blocked">{data?.review.state === "needs_information" ? "Preparación bloqueada: falta la respuesta de la empresa." : message.trim() ? "Revisá o descartá el mensaje escrito antes de preparar el pedido." : "La preparación requiere un estado de revisión confirmado."}</p> : null}
  </section>;
}
