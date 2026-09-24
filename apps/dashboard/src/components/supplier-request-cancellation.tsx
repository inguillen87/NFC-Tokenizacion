"use client";
import { useEffect, useRef, useState } from "react";
import { SupplierRequestError, type SupplierRequest } from "../lib/supplier-request-client";
import { supplierCancellationCall, type SupplierCancellationCommand } from "../lib/supplier-request-cancellation-client";
import type { SupplierRequestReviewGuard } from "./supplier-request-review";
import styles from "./supplier-request-workspace.module.css";
type Props = { request: SupplierRequest; suspended: boolean; canInteract: () => boolean; onGuard: (value: SupplierRequestReviewGuard) => void; onCurrent: (value: SupplierRequest) => void; onUncertainExit: () => void };
export function SupplierRequestCancellation({ request, suspended, canInteract, onGuard, onCurrent, onUncertainExit }: Props) {
 const [phase, setPhase] = useState<"idle" | "reading" | "ready" | "confirming" | "saving" | "uncertain" | "error">("idle");
 const [current, setCurrent] = useState<SupplierRequest | null>(null), [reason, setReason] = useState(""), [error, setError] = useState("");
 const alive = useRef(true), epoch = useRef(0), controller = useRef<AbortController | null>(null), busy = useRef(false), unresolved = useRef(false);
 const restoreFocus = useRef(false);
 const operation = useRef<SupplierCancellationCommand | null>(null), text = useRef(""), opener = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement | null>(null);
 useEffect(() => { alive.current = true; return () => { alive.current = false; epoch.current++; controller.current?.abort(); }; }, []);
 useEffect(() => { if (phase === "confirming") heading.current?.focus({ preventScroll: true }); if (phase === "idle" && restoreFocus.current) { restoreFocus.current = false; opener.current?.focus(); } }, [phase]);
 const scope = { tenant: request.tenant_slug, tenantId: request.tenant_id, id: request.id };
 function close() {
  if (busy.current || unresolved.current) return;
  if (text.current.trim() && !window.confirm("¿Descartar el motivo escrito y volver a la solicitud?")) return;
  restoreFocus.current = true; epoch.current++; controller.current?.abort(); controller.current = null; setPhase("idle"); setCurrent(null); setError(""); setReason(""); text.current = ""; onGuard({ dirty: false, locked: false });
 }
 async function refresh() {
  if (busy.current || unresolved.current || controller.current || !canInteract()) return;
  const generation = ++epoch.current, read = new AbortController(); controller.current = read;
  onGuard({ dirty: Boolean(text.current.trim()), locked: true }); setPhase("reading"); setCurrent(null); setError("");
  try {
   const result = await supplierCancellationCall({ ...scope, signal: read.signal });
   if (!alive.current || generation !== epoch.current) return;
   setCurrent(result.request); setPhase("ready");
  } catch {
   if (alive.current && generation === epoch.current) { setPhase("error"); setError("No se confirmó la disponibilidad de cancelación ni la versión actual. No se envió una cancelación; el motivo permanece aquí."); }
  } finally { if (controller.current === read) controller.current = null; }
 }
 async function execute(command: SupplierCancellationCommand) {
  if (busy.current || controller.current || !canInteract()) return;
  busy.current = true; operation.current = command; const generation = epoch.current, write = new AbortController(); controller.current = write;
  onGuard({ dirty: true, locked: true }); setPhase("saving"); setError("");
  try {
   const result = await supplierCancellationCall({ ...scope, command, signal: write.signal });
   if (!alive.current || generation !== epoch.current) return;
   unresolved.current = false; operation.current = null; text.current = ""; onGuard({ dirty: false, locked: false }); onCurrent(result.request);
  } catch (issue) {
   if (!alive.current || generation !== epoch.current) return;
   const failure = issue instanceof SupplierRequestError ? issue : new SupplierRequestError("unavailable", 0, true);
   unresolved.current ||= failure.uncertain; setPhase(unresolved.current ? "uncertain" : "error");
   setError(unresolved.current ? "No se confirmó el resultado. Comprobá la misma operación: no se generará otra cancelación."
    : failure.status === 409 ? "La solicitud o sus aclaraciones cambiaron. Tu motivo se conserva; consultá la versión actual y revisá nuevamente antes de confirmar."
    : failure.code === "supplier_request_secret_content_rejected" ? "Retirá llaves, tokens o secretos del motivo. No se registró la cancelación."
    : "No se autorizó o confirmó la cancelación. Conservamos el motivo; revisá el acceso y el estado antes de volver a confirmar.");
   if (!unresolved.current) operation.current = null;
  } finally { busy.current = false; if (controller.current === write) controller.current = null; }
 }
 function confirm() {
  if (phase !== "confirming" || !current || current.status !== "submitted" || !current.review_summary || busy.current || unresolved.current || !canInteract()) return;
  const value = text.current.trim(); if (!value || value.length > 2000) return;
  void execute(Object.freeze({ key: crypto.randomUUID(), body: Object.freeze({ expected_revision: current.revision, expected_review_revision: current.review_summary.revision, reason: value }) }));
 }
 if (phase === "idle") return <section className={styles.reviewPanel}><h3>Cancelación comercial</h3><p className={styles.muted}>Sólo para solicitudes enviadas que todavía no tienen una orden técnica preparada. El historial se conserva.</p>
  <button ref={opener} className={styles.button} type="button" data-testid="supplier-cancel-start" disabled={suspended} onClick={() => { if (!canInteract()) { setError("Guardá o descartá las aclaraciones y cambios de responsable antes de cancelar."); return; } void refresh(); }}>Revisar cancelación</button>{error ? <p role="alert">{error}</p> : null}</section>;
 return <section className={styles.reviewPanel} data-testid="supplier-cancel-panel" aria-labelledby="supplier-cancel-heading" aria-busy={phase === "reading" || phase === "saving"}>
  <h3 id="supplier-cancel-heading">Cancelar la solicitud enviada</h3><p className={styles.notice}>Este paso cierra la solicitud comercial. No cancela compras, pagos, fabricación ni pedidos técnicos ya preparados; no envía mensajes a terceros.</p>
  {phase === "reading" || phase === "saving" ? <p role="status">{phase === "reading" ? "Consultando la versión y disponibilidad actuales…" : "Registrando la cancelación…"}</p> : null}
  {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  {current && current.status !== "submitted" ? <><p role="status">La fuente informa que esta solicitud ya no está pendiente de preparación. No puede cancelarse desde este paso.</p><button className={styles.button} type="button" onClick={() => { onGuard({ dirty: false, locked: false }); onCurrent(current); }}>Actualizar expediente</button></> : null}
  {(phase === "ready" && current?.status === "submitted") || phase === "error" ? <><label htmlFor="supplier-cancel-reason">Motivo de cancelación<textarea id="supplier-cancel-reason" data-testid="supplier-cancel-reason" maxLength={2000} rows={4} value={reason} onChange={event => { text.current = event.target.value; setReason(event.target.value); onGuard({ dirty: Boolean(event.target.value.trim()), locked: true }); }} /></label><p className={styles.muted}>{reason.length}/2000 caracteres. Visible en el historial de la empresa y NexID. No incluyas secretos.</p></> : null}
  {phase === "ready" && current?.status === "submitted" ? <button className={styles.button} type="button" data-testid="supplier-cancel-review" disabled={!reason.trim()} onClick={() => { if (canInteract() && !controller.current && text.current.trim()) setPhase("confirming"); }}>Revisar motivo y alcance</button> : null}
  {phase === "confirming" && current ? <div className={styles.review} data-testid="supplier-cancel-confirmation"><h3 ref={heading} tabIndex={-1}>Confirmar cancelación</h3><p><strong>{current.title}</strong><br />Empresa: {current.tenant_slug}<br />Referencia: {current.id}<br />Solicitud versión {current.revision} · aclaraciones versión {current.review_summary?.revision}</p><p className={styles.pre}>{reason.trim()}</p><p>La solicitud quedará cerrada para preparación. No se borrarán los datos ni las aclaraciones anteriores. Esta acción no se puede deshacer desde el panel.</p><div className={styles.actions}><button className={styles.primary} type="button" data-testid="supplier-cancel-confirm" onClick={confirm}>Confirmar cancelación de solicitud</button><button className={styles.button} type="button" onClick={() => setPhase("ready")}>Volver al motivo</button></div></div> : null}
  {phase === "uncertain" ? <><button className={styles.button} type="button" data-testid="supplier-cancel-retry" onClick={() => { if (operation.current && !busy.current) void execute(operation.current); }}>Comprobar la misma cancelación</button><button className={styles.button} type="button" data-testid="supplier-cancel-exit-uncertain" onClick={() => { if (busy.current || !window.confirm("¿Salir con el resultado sin confirmar? Salir no revierte ni reenvía la operación. Consultá el expediente antes de volver a intentar.")) return; unresolved.current = false; operation.current = null; text.current = ""; setReason(""); onGuard({ dirty: false, locked: false }); onUncertainExit(); }}>Salir con resultado sin confirmar</button></> : null}
  {phase === "error" ? <button className={styles.button} type="button" data-testid="supplier-cancel-refresh" onClick={() => void refresh()}>Consultar versión actual</button> : null}
  {phase !== "saving" && phase !== "uncertain" ? <button className={styles.button} type="button" data-testid="supplier-cancel-close" onClick={close}>Volver sin cancelar</button> : null}
 </section>;
}
