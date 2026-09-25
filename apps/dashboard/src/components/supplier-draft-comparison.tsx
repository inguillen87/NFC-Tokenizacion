'use client';
import {useEffect,useRef,useState} from 'react';
import {SUPPLIER_DRAFT_LABELS,type SupplierDraftFields} from '../lib/supplier-request-draft-guidance';
import {DRAFT_CHANGE_LABELS,prepareDraftComparison,resolveDraftComparison,draftComparisonValue,type DraftChoices,type DraftComparisonRecord} from '../lib/supplier-draft-comparison';
import styles from './supplier-draft-comparison.module.css';
type Props={base:DraftComparisonRecord;server:DraftComparisonRecord;local:SupplierDraftFields;disabled:boolean;canInteract:()=>boolean;onApply:(token:string,choices:DraftChoices)=>void;onLoadServer:(token:string)=>void;onClose:()=>void};
export function SupplierDraftComparison(props:Props){
  try{const plan=prepareDraftComparison(props.base,props.server,props.local);return <Comparison key={JSON.stringify([props.base.id,props.base.tenant_id,props.base.tenant_slug,plan.baseRevision,plan.serverRevision,plan.serverStatus])} {...props}/>;}
  catch{return <section className={styles.root} role="alert"><h3>Comparación no disponible</h3><p>No se pudo vincular esta versión con tu borrador. Conservamos tu edición; consultá nuevamente el expediente.</p></section>;}
}
function Comparison({base,server,local,disabled,canInteract,onApply,onLoadServer,onClose}:Props){
  const plan=prepareDraftComparison(base,server,local);
  const [decision,setDecision]=useState<{token:string;choices:DraftChoices}>(()=>({token:plan.token,choices:{}}));
  const choices=decision.token===plan.token?decision.choices:{};
  const heading=useRef<HTMLHeadingElement|null>(null),changed=plan.rows.filter(row=>row.kind!=='unchanged'),same=plan.rows.filter(row=>row.kind==='unchanged');
  const resolution=resolveDraftComparison(base,server,local,choices);
  useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'auto'});},[]);
  function act(fn:()=>void){if(!disabled&&canInteract())fn();}
  return <section className={styles.root} data-testid="draft-comparison" aria-labelledby="draft-comparison-heading" aria-busy={disabled} onKeyDown={event=>{if(event.key==='Escape'&&!disabled&&canInteract()){event.preventDefault();onClose();}}}>
    <p className={styles.eyebrow}>Resolver diferencias · sólo en este formulario</p>
    <h3 id="draft-comparison-heading" ref={heading} tabIndex={-1}>Versión actual del servidor: {server.revision}</h3>
    <p>Compará tu edición con la versión que acabás de consultar. La base de tu borrador es la versión {base.revision}. Otra sesión puede volver a cambiarla; guardar comprobará la revisión nuevamente.</p>
    <div className={styles.summary}><span><strong>{changed.length}</strong> campos con cambios</span><span><strong>{plan.conflicts}</strong> cambios distintos en ambas ediciones</span></div>
    {!plan.editable?<p role="status" className={styles.notice} data-testid="draft-comparison-terminal">La solicitud ya no es un borrador. No se puede combinar ni guardar esta edición sobre el expediente enviado. Podés comparar el texto y decidir si cargar la versión del servidor para consulta.</p>:<p className={styles.notice}>Los cambios en campos diferentes se proponen juntos. Cuando ambas ediciones cambiaron el mismo campo de forma distinta, la elección queda pendiente. Aplicar la selección no guarda ni envía la solicitud.</p>}
    {changed.length?<div className={styles.rows}>{changed.map(row=><fieldset key={row.field} disabled={disabled||!plan.editable} className={styles.row} data-testid={'draft-comparison-'+row.field}>
      <legend>{SUPPLIER_DRAFT_LABELS[row.field]}</legend><p className={row.kind==='conflict'?styles.conflict:styles.hint}>{DRAFT_CHANGE_LABELS[row.kind]}</p>
      <div className={styles.values}><div><span className={styles.caption}>Tu texto local</span><p tabIndex={0} aria-label={'Texto local de '+SUPPLIER_DRAFT_LABELS[row.field]} data-testid={'comparison-local-'+row.field}>{draftComparisonValue(row.field,row.local)}</p></div><div><span className={styles.caption}>Servidor · versión {server.revision}</span><p tabIndex={0} aria-label={'Texto del servidor de '+SUPPLIER_DRAFT_LABELS[row.field]} data-testid={'comparison-server-'+row.field}>{draftComparisonValue(row.field,row.server)}</p></div></div>
      <details><summary>Ver valor de partida · versión {base.revision}</summary><p tabIndex={0} className={styles.base}>{draftComparisonValue(row.field,row.base)}</p></details>
      {plan.editable&&row.kind!=='same_change'?<div className={styles.choices} role="group" aria-label={'Elegir '+SUPPLIER_DRAFT_LABELS[row.field]}>
        <label><input type="radio" name={'draft-choice-'+row.field} value="local" data-testid={'choice-local-'+row.field} checked={(choices[row.field]||row.suggestion)==='local'} onChange={()=>act(()=>setDecision(c=>({token:plan.token,choices:{...(c.token===plan.token?c.choices:{}),[row.field]:'local'}})))}/>Conservar mi texto</label>
        <label><input type="radio" name={'draft-choice-'+row.field} value="server" data-testid={'choice-server-'+row.field} checked={(choices[row.field]||row.suggestion)==='server'} onChange={()=>act(()=>setDecision(c=>({token:plan.token,choices:{...(c.token===plan.token?c.choices:{}),[row.field]:'server'}})))}/>Usar el del servidor</label>
      </div>:null}
    </fieldset>)}</div>:<p>No hay diferencias en los datos editables. No se enviará otro guardado al cargar esta revisión.</p>}
    {same.length?<details className={styles.same}><summary>Campos sin cambios ({same.length})</summary><dl>{same.map(row=><div key={row.field}><dt>{SUPPLIER_DRAFT_LABELS[row.field]}</dt><dd tabIndex={0}>{draftComparisonValue(row.field,row.server)}</dd></div>)}</dl></details>:null}
    {plan.editable?<><p role="status" className={styles.hint} data-testid="draft-comparison-status">{resolution.ok?'La selección está lista para pasar al borrador. Después revisala y guardá explícitamente.':resolution.reason==='unresolved'?'Elegí qué conservar en '+resolution.pending.length+' campo'+(resolution.pending.length===1?'':'s')+' antes de continuar.':'La selección incluye datos inválidos. Elegí el valor del servidor o volvé al formulario para corregir tu texto.'}</p>
    <button type="button" className={styles.primary} data-testid="draft-comparison-apply" disabled={disabled||!resolution.ok} onClick={()=>act(()=>{if(resolution.ok)onApply(plan.token,choices);})}>Aplicar selección al borrador</button></>:null}
    <div className={styles.actions}><button type="button" className={styles.button} data-testid="draft-comparison-load" disabled={disabled} onClick={()=>act(()=>onLoadServer(plan.token))}>Cargar esta versión y descartar mis cambios</button><button type="button" className={styles.button} data-testid="draft-comparison-close" disabled={disabled} onClick={()=>act(onClose)}>Seguir editando sin aplicar</button></div>
    <p className={styles.hint}>Esta comparación vive sólo en la pestaña. No es un guardado automático ni un recibo del servidor.</p>
  </section>;
}
