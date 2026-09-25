'use client';
import { SUPPLIER_DRAFT_LABELS, supplierDraftNextStep, validateSupplierDraft, type SupplierDraftField, type SupplierDraftFields } from '../lib/supplier-request-draft-guidance';
import styles from './supplier-request-draft-guide.module.css';
type Props={fields:SupplierDraftFields;saved:boolean;dirty:boolean;waiting:boolean;uncertain:boolean;conflict:boolean;reviewing:boolean;onField:(field:SupplierDraftField)=>void};
export function SupplierRequestDraftGuide(props:Props){
 const check=validateSupplierDraft(props.fields),step=props.reviewing?3:!props.saved||props.dirty?1:check.readyForReview?3:2;
 return <section className={styles.guide} aria-labelledby="supplier-draft-guide-title" data-testid="supplier-draft-guide">
  <div className={styles.header}><h3 id="supplier-draft-guide-title">Del borrador al envío</h3><span className={styles.local}>Guía de esta edición · no es un recibo</span></div>
  <ol className={styles.steps} aria-label="Etapas de la solicitud">
   <li data-current={step===1} aria-current={step===1?'step':undefined}><strong>1. Datos</strong></li>
   <li data-current={step===2} aria-current={step===2?'step':undefined}><strong>2. Guardado</strong></li>
   <li data-current={step===3} aria-current={step===3?'step':undefined}><strong>3. Envío</strong></li>
  </ol>
  <p id="supplier-draft-next-step" className={styles.next} data-testid="supplier-draft-next-step">{supplierDraftNextStep(props)}</p>
  {check.missing.length?<><p className={styles.local}>Pendientes para revisar el envío:</p><ul className={styles.pending}>{check.missing.map(field=><li key={field}><button className={styles.jump} type="button" disabled={props.waiting||props.uncertain} onClick={()=>props.onField(field)} aria-label={'Ir al campo '+SUPPLIER_DRAFT_LABELS[field]}>{SUPPLIER_DRAFT_LABELS[field]}</button></li>)}</ul></>:null}
 </section>;
}
