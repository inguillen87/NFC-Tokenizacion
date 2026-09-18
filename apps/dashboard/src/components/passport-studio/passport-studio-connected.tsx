"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {PassportStudio} from './passport-studio';
import {parseStudioEnvelope,type StudioEnvelope} from '../../lib/passport-studio-envelope';
import type {StudioSnapshot} from '../../lib/passport-studio-contract';
import {boundedDossierJson} from '../../lib/batch-dossier-readings';
import styles from '../batch-dossier.module.css';
type Props={initial:StudioEnvelope;scope:{tenantId:string;batchId:string;bid:string}};
export function PassportStudioConnected({initial,scope}:Props){
 const [source,setSource]=useState(initial),[epoch,setEpoch]=useState(0),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [template,setTemplate]=useState(initial.enrollment?.template||'general'),[locale,setLocale]=useState(initial.enrollment?.locale||'es-AR');
 const pending=useRef<{action:'start'|'reopen';body:Record<string,unknown>}|null>(null),inflight=useRef(false),dirty=useRef(false);
 const endpoint=`/api/admin/batches/${encodeURIComponent(scope.bid)}/passport-editorial`;
 async function reload(){
  if(inflight.current)return;
  if(dirty.current&&!window.confirm('Hay cambios locales sin guardar. ¿Descartarlos y consultar la revisión guardada?'))return;
  inflight.current=true;setBusy(true);setMessage('');
  try{const r=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();const next=parseStudioEnvelope(await boundedDossierJson(r),scope);setSource(next);setEpoch(v=>v+1);dirty.current=false;setUncertain(false);pending.current=null;setConfirmed(false);setMessage('Estado actualizado desde el servidor.');}
  catch{setMessage('No se pudo consultar el estado. Se conserva la vista anterior; no se interpreta como un borrador vacío.');}
  finally{inflight.current=false;setBusy(false);}
 }
 async function send(action:'start'|'reopen',retry=false){
  if(inflight.current||(!retry&&!confirmed))return;
  const body=retry?pending.current?.body:action==='start'&&source.enrollment?{action,operationId:crypto.randomUUID(),scope:{tenantId:scope.tenantId,batchId:scope.batchId},template,locale,expectedPublicDigest:source.enrollment.currentPublicDigest}:source.snapshot?{action,operationId:crypto.randomUUID(),scope:{tenantId:scope.tenantId,batchId:scope.batchId},draftId:source.snapshot.draft.id,expectedRevision:source.snapshot.draft.revision,expectedContentDigest:source.snapshot.draft.contentDigest}:null;
  if(!body)return;
  pending.current={action,body};inflight.current=true;setBusy(true);setMessage('');
  try{
   const r=await fetch(`${endpoint}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!r.ok){if(r.status>=500)throw new Error();setUncertain(false);pending.current=null;setMessage(r.status===403?'La cuenta no tiene el permiso necesario.':'El estado cambió o el servidor rechazó la solicitud. Actualizá la revisión antes de repetir.');return;}
   const raw=await boundedDossierJson(r) as any,next=parseStudioEnvelope(raw,scope);
   if(!next.snapshot||raw.receipt?.operationId!==body.operationId||raw.receipt?.action!==action||raw.receipt?.committed!==true||typeof raw.receipt.replayed!=='boolean')throw new Error();
   if(next.snapshot.actorId!==(source.enrollment?.actorId||source.snapshot?.actorId))throw new Error();
   if(next.snapshot.draft.state!=='draft'||(action==='start'?next.snapshot.draft.revision!==1:next.snapshot.draft.revision!==Number(body.expectedRevision)+1))throw new Error();
   setSource(next);setEpoch(v=>v+1);dirty.current=false;setUncertain(false);pending.current=null;setConfirmed(false);setMessage(raw.receipt.replayed?'El intento anterior quedó confirmado; no se duplicó.':'Borrador guardado. El pasaporte público no fue modificado.');
  }catch{setUncertain(true);setMessage('Resultado incierto. Conservamos el intento: repetilo con el mismo identificador o consultá el estado antes de iniciar otro.');}
  finally{inflight.current=false;setBusy(false);}
 }
 const current=source.snapshot;
 const canReopen=!!current&&current.capabilities.edit&&['approved','published'].includes(current.draft.state);
 return <main className={styles.root} data-testid="passport-studio-connected">
  <div className={styles.topline}><Link prefetch={false} href={`/batches/${encodeURIComponent(scope.bid)}#dossier-product`}>← Expediente del lote</Link><button type="button" className={styles.button} disabled={busy} onClick={()=>void reload()}>Actualizar estado</button></div>
  {message&&<p role="status" className={styles.notice}>{message}</p>}
  {uncertain&&pending.current&&<button type="button" className={styles.button} disabled={busy} onClick={()=>{if(pending.current)void send(pending.current.action,true);}}>Reconciliar el mismo intento</button>}
  {source.enrollment&&<section className={styles.card} data-testid="studio-enrollment">
   <p className={styles.eyebrow}>Passport Studio · revisión antes de publicar</p><h1 className={styles.title}>El pasaporte de tu producto, bajo control.</h1>
   <p className={styles.note}>Creá un borrador desde la información actual del lote. Podrás editar, comparar, solicitar revisión independiente y publicar una versión con historial.</p>
   <div className={styles.facts}><div><dt>Producto actual</dt><dd>{source.enrollment.document.identity.product_name||'Sin nombre declarado'}</dd></div><div><dt>Empresa</dt><dd>{source.enrollment.scope.tenantLabel}</dd></div></div>
   <div className={styles.toolbar}><label className={styles.field}>Plantilla<select value={template} disabled={busy||uncertain||source.enrollment.template==='agro'} onChange={e=>setTemplate(e.target.value as 'general'|'agro')}><option value="general">General · identidad de producto</option><option value="agro">Agro · identidad y documentación</option></select></label><label className={styles.field}>Idioma editorial<select value={locale} disabled={busy||uncertain} onChange={e=>setLocale(e.target.value as 'es-AR'|'en'|'pt-BR')}><option value="es-AR">Español</option><option value="en">English</option><option value="pt-BR">Português</option></select></label></div>
   <p className={styles.notice}>Activar Studio no publica cambios. Este lote pasa a revisión editorial: la edición directa anterior queda protegida. La aprobación requiere otro usuario autorizado; no cambia los permisos de tu equipo. Esta entrega edita identidad común y perfil agro. Los campos avanzados de otros rubros se conservan publicados, pero no se editan desde Studio.</p>
   {source.enrollment.capabilities.edit?<><label className={styles.note} style={{display:'flex',gap:10,margin:'18px 0'}}><input type="checkbox" checked={confirmed} disabled={busy||uncertain} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo activar el flujo editorial para este lote, sin modificar el pasaporte publicado.</label><button type="button" className={`${styles.button} ${styles.primary}`} disabled={!confirmed||busy||uncertain} onClick={()=>void send('start')}>{busy?'Guardando…':'Crear borrador del lote'}</button></>:<p className={styles.notice}>Tu cuenta puede consultar, pero necesita batch.product.configure para iniciar el borrador.</p>}
  </section>}
  {current&&<>
   {canReopen&&<details className={styles.card}><summary>Preparar una nueva revisión del contenido</summary><p className={styles.note}>Reabre un borrador sin cambiar la publicación vigente. Se requiere volver a revisar y aprobar. En Historial podés recuperar contenido anterior en ese borrador.</p><label className={styles.note} style={{display:'flex',gap:10,margin:'12px 0'}}><input type="checkbox" checked={confirmed} disabled={busy||uncertain} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo crear una nueva revisión de trabajo.</label><button type="button" className={styles.button} disabled={!confirmed||busy||uncertain} onClick={()=>void send('reopen')}>Abrir nueva revisión</button></details>}
   <PassportStudio key={`${scope.batchId}:${epoch}`} initial={current} endpoint={endpoint} onSnapshot={(snapshot:StudioSnapshot)=>{setSource({snapshot});setMessage('');}} onDirtyChange={value=>{dirty.current=value;}} onReload={()=>void reload()}/>
  </>}
 </main>;
}
