"use client";
import {useEffect,useRef,useState} from "react";
import {PassportStudio} from "./passport-studio";
import {parseStudioEntry,type StudioEnrollment} from "../../lib/passport-studio-entry";
import {boundedJSON,studioRequestPath} from "../../lib/passport-studio-transport";
import type {StudioSnapshot} from "../../lib/passport-studio-contract";
import {BookOpen,CheckCircle2,FileCheck2,Smartphone,ShieldCheck} from "lucide-react";
import "./passport-studio.css";
export function PassportStudioEntry({initial,enrollment,endpoint,tenantSlug=""}:{initial:StudioSnapshot|null;enrollment:StudioEnrollment|null;endpoint:string;tenantSlug?:string}){
 const [snapshot,setSnapshot]=useState(initial),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [template,setTemplate]=useState(enrollment?.template||'general'),[locale,setLocale]=useState(enrollment?.locale||'es-AR');
 const attempt=useRef<any>(null),flight=useRef<AbortController|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;flight.current?.abort();};},[]);
 async function start(){
  if(!enrollment?.capabilities.edit||flight.current||!confirmed)return;
  if(!attempt.current)attempt.current={action:'start',operationId:crypto.randomUUID(),scope:{tenantId:enrollment.scope.tenantId,batchId:enrollment.scope.batchId},template,locale,expectedPublicDigest:enrollment.currentPublicDigest};
  const command=structuredClone(attempt.current),controller=new AbortController();flight.current=controller;setBusy(true);setMessage('');const timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(studioRequestPath(endpoint,"start",tenantSlug),{method:'POST',headers:{'content-type':'application/json','idempotency-key':command.operationId},body:JSON.stringify(command),signal:controller.signal,cache:'no-store'});
   if(!mounted.current)return;
   if(!response.ok){setUncertain(response.status>=500);if(response.status<500)attempt.current=null;setMessage(response.status===409?'El lote ya tiene una revisión o cambió el contenido. Volvé a abrir Passport Studio para consultar su estado.':response.status===403?'Esta cuenta no tiene permiso para iniciar la gestión editorial.':'No se confirmó el inicio. Revisá el estado antes de repetir otra operación.');return;}
   const raw=await boundedJSON(response) as any;
   const parsed=parseStudioEntry(raw,{bid:enrollment.scope.bid,tenantId:enrollment.scope.tenantId});
   if(!parsed.snapshot||parsed.snapshot.scope.batchId!==enrollment.scope.batchId||parsed.snapshot.actorId!==enrollment.actorId||raw.receipt?.action!=='start'||raw.receipt?.committed!==true||raw.receipt?.operationId!==command.operationId||parsed.snapshot.draft.revision!==1)throw new Error('receipt_invalid');
   setSnapshot(parsed.snapshot);attempt.current=null;
  }catch{if(mounted.current){setUncertain(true);setMessage('Resultado incierto. Conservamos el mismo intento identificado para que el servidor no duplique el inicio.');}}
  finally{clearTimeout(timer);flight.current=null;if(mounted.current)setBusy(false);}
 }
 if(snapshot)return <PassportStudio key={`${snapshot.scope.tenantId}:${snapshot.scope.batchId}:${snapshot.draft.id}`} initial={snapshot} endpoint={endpoint} tenantSlug={tenantSlug}/>;
 if(!enrollment)return <p>Fuente editorial no disponible.</p>;
 return <section className="ps-root ps-enroll" data-testid="passport-enrollment"><div className="ps-enroll-hero"><span className="ps-enroll-mark"><BookOpen size={28}/></span><p className="ps-kicker">CONTENIDO DE TU PRODUCTO · CONTROL EDITORIAL</p><h1>Prepará hoy. Publicá con confianza.</h1><p>Un espacio para editar el pasaporte, previsualizarlo en celular y publicarlo después de una revisión independiente.</p><span className="ps-chip">{enrollment.scope.bid} · {enrollment.scope.tenantLabel}</span></div>
 <div className="ps-enroll-steps">{[[Smartphone,'Vista previa móvil','Editá sin modificar lo que ve el cliente.'],[FileCheck2,'Revisión independiente','Otra persona autorizada revisa la versión.'],[CheckCircle2,'Publicación con historial','El contenido aprobado se publica y queda registrado.']].map(([Icon,title,text])=>{const Item=Icon as typeof Smartphone;return <article key={String(title)}><Item size={22}/><h2>{String(title)}</h2><p>{String(text)}</p></article>;})}</div>
 <div className="ps-enroll-bottom"><div><h2>{enrollment.document.identity.product_name||'Producto por completar'}</h2><p>Contenido actual del lote. El inicio crea un borrador, no cambia la página del consumidor.</p><p className="ps-enroll-warning"><ShieldCheck size={18}/>Al iniciar, los cambios de contenido de este lote deberán pasar por Passport Studio. La edición directa y los campos avanzados de vino quedarán bloqueados para este lote. Se conservan sus valores. No modifica claves, etiquetas ni controles físicos.</p><p>Se requiere otro usuario autorizado para aprobar. Esta entrega no crea usuarios ni concede permisos automáticamente.</p></div><div className="ps-enroll-form">
 <label>Plantilla<select disabled={busy||uncertain||!enrollment.capabilities.edit||enrollment.template==='agro'} value={template} onChange={e=>{setTemplate(e.target.value as typeof template);setConfirmed(false);}}><option value="general">General</option><option value="agro">Agro</option></select></label>
 <label>Idioma del contenido<select value={locale} disabled={busy||uncertain||!enrollment.capabilities.edit} onChange={e=>{setLocale(e.target.value as typeof locale);setConfirmed(false);}}><option value="es-AR">Español</option><option value="en">English</option><option value="pt-BR">Português</option></select></label>
 <label className="ps-enroll-confirm"><input type="checkbox" checked={confirmed} disabled={busy||uncertain||!enrollment.capabilities.edit} onChange={e=>setConfirmed(e.target.checked)}/><span>Confirmo que este lote utilizará revisión editorial antes de publicar cambios.</span></label>
 <button type="button" className="ps-btn ps-primary" disabled={!enrollment.capabilities.edit||!confirmed||busy} onClick={()=>void start()}>{busy?'Creando borrador…':uncertain?'Reconciliar el mismo inicio':'Iniciar Passport Studio'}</button>
 {!enrollment.capabilities.edit&&<p>La cuenta puede consultar, pero no iniciar la gestión editorial.</p>}
 {message&&<p role="status" className="ps-enroll-warning">{message}</p>}
 </div></div></section>;
}
