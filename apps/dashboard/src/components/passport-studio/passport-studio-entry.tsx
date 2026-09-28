"use client";
import {useEffect,useRef,useState} from 'react';
import {BookOpen,FileCheck2,Smartphone} from 'lucide-react';
import {PassportStudio} from './passport-studio';
import type {StudioEnrollment} from '../../lib/passport-studio-entry';
import type {StudioSnapshot} from '../../lib/passport-studio-contract';
import {EnrollmentError,enrollmentFailure,prepareEnrollment,startPassportEnrollment,type EnrollmentAttempt} from '../../lib/passport-enrollment';
import styles from './passport-enrollment.module.css';
type Props={initial:StudioSnapshot|null;enrollment:StudioEnrollment|null;endpoint:string;tenantSlug?:string};
/** Identity and authority transitions remount; incidental rerenders preserve local choices. */
export function PassportStudioEntry(props:Props){
 const e=props.enrollment,s=props.initial;
 const context=JSON.stringify([props.endpoint,props.tenantSlug,e&&[e.scope,e.actorId,e.capabilities,e.currentPublicDigest,e.template,e.locale],s&&[s.scope,s.actorId,s.capabilities,s.draft.id,s.draft.revision,s.draft.state,s.draft.contentDigest,s.published?.contentDigest]]);
 return <Enrollment key={context} {...props}/>;
}
function Enrollment({initial,enrollment,endpoint,tenantSlug=''}:Props){
 const [snapshot,setSnapshot]=useState(initial),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false),[reviewing,setReviewing]=useState(false),[accessLost,setAccessLost]=useState(false),[conflict,setConflict]=useState(false);
 const [template,setTemplate]=useState(enrollment?.template||'general'),[locale,setLocale]=useState(enrollment?.locale||'es-AR');
 const attempt=useRef<EnrollmentAttempt|null>(null),flight=useRef<AbortController|null>(null),mounted=useRef(true),unresolved=useRef(false);
 const reviewHeading=useRef<HTMLHeadingElement|null>(null),reviewButton=useRef<HTMLButtonElement|null>(null),returnFocus=useRef(false),status=useRef<HTMLParagraphElement|null>(null);
 useEffect(()=>{mounted.current=true;const warn=(e:BeforeUnloadEvent)=>{if(flight.current||unresolved.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>{mounted.current=false;flight.current?.abort();window.removeEventListener('beforeunload',warn);};},[]);
 useEffect(()=>{if(reviewing){reviewHeading.current?.focus({preventScroll:true});reviewHeading.current?.scrollIntoView({block:'center',behavior:'auto'});}else if(returnFocus.current){returnFocus.current=false;reviewButton.current?.focus();}},[reviewing]);
 useEffect(()=>{if(message&&!busy)status.current?.focus({preventScroll:true});},[message,busy]);
 function back(){if(flight.current||unresolved.current)return;returnFocus.current=true;setReviewing(false);}
 function review(){if(!enrollment?.capabilities.edit||!confirmed||flight.current||unresolved.current||accessLost||conflict)return;setMessage('');setReviewing(true);}
 async function start(){
  if(!enrollment?.capabilities.edit||flight.current||(!unresolved.current&&(!reviewing||!confirmed||accessLost||conflict)))return;
  try{if(!attempt.current)attempt.current=prepareEnrollment(enrollment,endpoint,tenantSlug,template,locale,crypto.randomUUID());}catch{setMessage('No se confirmó el alcance de este pasaporte. Volvé a consultar el lote.');return;}
  const operation=attempt.current,controller=new AbortController();flight.current=controller;setBusy(true);setMessage('');setReviewing(false);
  try{const result=await startPassportEnrollment(operation,{signal:controller.signal});if(!mounted.current||flight.current!==controller)return;unresolved.current=false;attempt.current=null;setSnapshot(result);}
  catch(issue){if(!mounted.current||flight.current!==controller)return;const failure=enrollmentFailure(issue instanceof EnrollmentError?issue:new EnrollmentError('unconfirmed',true),unresolved.current);unresolved.current=failure.uncertain;setUncertain(failure.uncertain);setAccessLost(failure.accessLost);setConflict(!failure.uncertain&&issue instanceof EnrollmentError&&issue.code==='conflict');setMessage(failure.message);if(!failure.uncertain)attempt.current=null;}
  finally{if(flight.current===controller){flight.current=null;if(mounted.current)setBusy(false);}}
 }
 if(snapshot)return <PassportStudio key={`${snapshot.scope.tenantId}:${snapshot.scope.batchId}:${snapshot.draft.id}`} initial={snapshot} endpoint={endpoint} tenantSlug={tenantSlug}/>;
 if(!enrollment)return <p>Fuente editorial no disponible.</p>;
 const blocked=busy||uncertain||accessLost||conflict||!enrollment.capabilities.edit;
 const language={"es-AR":'Español',en:'English','pt-BR':'Português'}[locale];
 const retryHref=`/batches/${encodeURIComponent(enrollment.scope.bid)}/passport${tenantSlug?'?'+new URLSearchParams({tenant:tenantSlug}):''}`;
 return <section className={styles.root} data-testid="passport-enrollment" aria-busy={busy}>
  <header className={styles.header}><span className={styles.mark}><BookOpen aria-hidden="true"/></span><div><p className={styles.kicker}>PASAPORTE DIGITAL · INICIO EDITORIAL</p><h1>Preparar el pasaporte de este lote</h1><p>Creá un borrador sin modificar el contenido público. La revisión y la publicación son pasos separados.</p></div></header>
  {!accessLost?<><dl className={styles.identity}><div><dt>Empresa</dt><dd>{enrollment.scope.tenantLabel}</dd></div><div><dt>Lote seleccionado</dt><dd>{enrollment.scope.bid}</dd></div><div><dt>Producto declarado</dt><dd>{enrollment.document.identity.product_name||'Nombre por completar'}</dd></div></dl>
  <div className={styles.steps} aria-label="Recorrido editorial"><article><BookOpen aria-hidden="true"/><h2>1. Preparar borrador</h2><p>Editá identidad, contenido y documentación.</p></article><article><FileCheck2 aria-hidden="true"/><h2>2. Revisión independiente</h2><p>Otra persona autorizada revisa esta versión.</p></article><article><Smartphone aria-hidden="true"/><h2>3. Publicar el pasaporte</h2><p>Publicá el contenido aprobado con historial.</p></article></div>
  <div className={styles.layout}><div className={styles.explanation}><h2>Qué cambia al iniciar</h2><p>Este lote pasa a gestión editorial. Sus cambios de contenido deberán realizarse desde Passport Studio; la edición directa y los campos avanzados de vino quedan bloqueados, conservando sus valores.</p><p className={styles.notice}>Iniciar crea un borrador: no publica el pasaporte, no programa etiquetas y no modifica claves NFC ni el precinto.</p><p>La aprobación necesita otro usuario autorizado. Esta acción no crea cuentas ni concede permisos.</p></div>
  <div className={styles.form}><h2>Opciones del borrador</h2><label htmlFor="enrollment-template">Plantilla<select id="enrollment-template" disabled={blocked||reviewing||enrollment.template==='agro'} value={template} onChange={e=>{if(flight.current||unresolved.current)return;setTemplate(e.target.value as typeof template);setConfirmed(false);}}><option value="general">General</option><option value="agro">Agro</option></select></label>
  <label htmlFor="enrollment-locale">Idioma del contenido<select id="enrollment-locale" disabled={blocked||reviewing} value={locale} onChange={e=>{if(flight.current||unresolved.current)return;setLocale(e.target.value as typeof locale);setConfirmed(false);}}><option value="es-AR">Español</option><option value="en">English</option><option value="pt-BR">Português</option></select></label>
  <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={blocked||reviewing} onChange={e=>{if(!flight.current&&!unresolved.current)setConfirmed(e.target.checked);}}/><span>Confirmo que este lote utilizará revisión editorial antes de publicar cambios.</span></label>
  <button ref={reviewButton} type="button" className={styles.primary} data-testid="enrollment-review" disabled={blocked||!confirmed||reviewing} onClick={review}>Revisar inicio editorial</button>
  {!enrollment.capabilities.edit?<p className={styles.notice}>Esta cuenta puede consultar, pero no iniciar la gestión editorial.</p>:null}</div></div></>:<div className={styles.notice} data-testid="enrollment-access-lost"><h2>Acceso al pasaporte no disponible</h2><p>Se retiraron los datos del lote de esta vista. Recuperá la sesión autorizada antes de continuar.</p></div>}
  {reviewing?<section className={styles.confirmation} data-testid="enrollment-confirmation" aria-labelledby="enrollment-confirm-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();back();}}}><h2 ref={reviewHeading} id="enrollment-confirm-title" tabIndex={-1}>Confirmar inicio editorial</h2><p><strong>{enrollment.scope.bid}</strong> · {template==='agro'?'Agro':'General'} · {language}</p><p>Se creará un borrador y se activará la gestión editorial del lote. Su contenido público no cambia en este paso.</p><div className={styles.actions}><button className={styles.primary} type="button" data-testid="enrollment-confirm" disabled={busy} onClick={()=>void start()}>Confirmar e iniciar</button><button className={styles.button} type="button" disabled={busy} onClick={back}>Volver a las opciones</button></div></section>:null}
  {busy?<p role="status" className={styles.notice}>Creando borrador… Esperá la confirmación antes de salir.</p>:null}
  {message?<p ref={status} tabIndex={-1} role="status" className={styles.notice} data-testid="enrollment-status">{message}</p>:null}
  {uncertain?<div className={styles.recovery}><p>Un error posterior no prueba que el primer intento haya fallado. Este control vuelve a comprobar la misma operación.</p><button className={styles.primary} type="button" data-testid="enrollment-retry" disabled={busy} onClick={()=>void start()}>Reconciliar el mismo inicio</button><p>Al cerrar o recargar se pierde la referencia local del intento; eso no revierte el cambio guardado en NexID.</p></div>:null}
  {conflict||accessLost?<a className={styles.button} href={retryHref}>Volver a consultar el pasaporte</a>:null}
 </section>;
}
