"use client";
import type { SupplierRequest } from "../lib/supplier-request-client";
import { supplierCaseSnapshot, supplierCaseTimestamp } from "../lib/supplier-request-case-summary";
import styles from "./supplier-request-case-summary.module.css";
export function SupplierRequestCaseSummary({request,isNexid}:{request:SupplierRequest;isNexid:boolean}) {
  const snapshot=supplierCaseSnapshot(request,isNexid);
  return <section className={styles.case} data-testid="supplier-request-case-summary" aria-labelledby="supplier-case-title">
    <div className={styles.header}><div><p className={styles.eyebrow}>Expediente de solicitud</p><h3 id="supplier-case-title">{request.title}</h3></div><span className={styles.badge}>{snapshot.stateLabel}</span></div>
    <dl className={styles.grid}><div className={styles.metric}><dt>Responsable actual</dt><dd>{snapshot.ownerLabel}</dd></div><div className={styles.metric}><dt>Última actividad</dt><dd>{snapshot.activityLabel}</dd></div><div className={styles.metric}><dt>Versión</dt><dd>{request.revision}</dd></div></dl>
    <div className={styles.next} data-testid="supplier-case-next-step"><strong>Siguiente paso</strong>{snapshot.nextStep}</div>
    {snapshot.quotationLabel?<p className={styles.hint} data-testid="supplier-case-quotation">{snapshot.quotationLabel}. Consultá el módulo correspondiente para su estado completo.</p>:null}
    <div className={styles.refs}><div><p>Referencia del expediente</p><code data-testid="supplier-case-reference">{request.id}</code>{request.order_id?<><p>Pedido vinculado</p><code>{request.order_id}</code></>:null}</div>
      <div className={styles.actions}>{snapshot.orderHref?<a className={styles.button} data-testid="supplier-case-order-link" href={snapshot.orderHref}>Abrir pedido</a>:null}</div></div>
    <details className={styles.trace} data-testid="supplier-case-trace"><summary>Ver trazabilidad básica</summary><ul>{snapshot.milestones.map(item=><li key={item.id}><strong>{item.label}</strong> · <time dateTime={item.at}>{supplierCaseTimestamp(item.at)}</time></li>)}</ul></details>
    <p className={styles.hint}>Esta guía resume el expediente ya leído. No concede permisos, no cambia estados y no confirma fabricación, entrega ni recepción física.</p>
  </section>;
}
