'use client';
import {useEffect,useRef,useState} from 'react';
import {fetchSupplierServices,SupplierServiceReadError} from '../lib/supplier-service-client';
import type {SupplierServiceSnapshot,SupplierServiceId} from '../lib/supplier-service-contract';
import type {SupplierRequestReviewGuard} from './supplier-request-review';
import styles from './supplier-request-workspace.module.css';
const labels:Record<SupplierServiceId,string>={cancellation:'Cancelación comercial',quotation:'Cotización y acuerdo',supplier_binding:'Proveedor y especificación',delivery_ack:'Acuse documental'};
const states={setup_required:'Preparación pendiente',temporarily_disabled:'Desactivado',read_only:'Consulta sin nuevas escrituras',workflow_available:'Flujo habilitado; acceso por confirmar'};
type Props={tenant:string;tenantId:string;suspended:boolean;canInteract:()=>boolean;onGuard:(v:SupplierRequestReviewGuard)=>void;onSnapshot:(v:SupplierServiceSnapshot|null)=>void;onAccessUnavailable:()=>void};
export function SupplierServiceStatus({tenant,tenantId,suspended,canInteract,onGuard,onSnapshot,onAccessUnavailable}:Props){
 const [sample,setSample]=useState<SupplierServiceSnapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[expired,setExpired]=useState(false);
 const alive=useRef(true),epoch=useRef(0),active=useRef<AbortController|null>(null),restoreFocus=useRef(false),button=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;active.current?.abort();};},[]);
 useEffect(()=>{if(!busy&&restoreFocus.current){restoreFocus.current=false;button.current?.focus();}},[busy]);
 useEffect(()=>{if(!sample)return;const timer=setTimeout(()=>setExpired(true),Math.max(0,Math.min(60000,Date.parse(sample.observedAt)+60000-Date.now())));return()=>clearTimeout(timer);},[sample]);
 async function load(){
  if(active.current||!canInteract())return;const sequence=++epoch.current,controller=new AbortController();active.current=controller;onGuard({dirty:false,locked:true});setBusy(true);setMessage('');setSample(null);onSnapshot(null);setExpired(false);
  try{const data=await fetchSupplierServices({tenant,tenantId},controller.signal);if(!alive.current||epoch.current!==sequence)return;setSample(data);onSnapshot(data);}
  catch(error){if(!alive.current||epoch.current!==sequence)return;const e=error instanceof SupplierServiceReadError?error:new SupplierServiceReadError(0);onSnapshot(null);
   if(e.status===401||e.status===403){onGuard({dirty:false,locked:false});onAccessUnavailable();return;}
   setMessage(e.status===404?'La API conectada no publica esta comprobación. No se da por habilitado ningún flujo adicional.':e.kind==='invalid'?'La respuesta no coincide con esta empresa o con el contrato esperado. No se utiliza para decidir disponibilidad.':'No se confirmó la disponibilidad. Los expedientes y comprobantes no se modificaron.');
  }finally{if(active.current===controller)active.current=null;if(alive.current&&epoch.current===sequence){onGuard({dirty:false,locked:false});setBusy(false);}}
 }
 function cancel(){epoch.current++;active.current?.abort();active.current=null;restoreFocus.current=true;setBusy(false);setSample(null);onSnapshot(null);onGuard({dirty:false,locked:false});setMessage('Consulta cancelada, sin cambios en el expediente.');}
 return <section className={styles.reviewPanel} data-testid="supplier-services"><h3>Disponibilidad del circuito</h3><p className={styles.muted}>Consultá qué módulos ofrece la API conectada para esta empresa. No consulta pedidos ni autoriza una operación: cada flujo vuelve a comprobar sesión, acceso y versión.</p>
 <div className={styles.actions}><button ref={button} className={styles.button} type="button" data-testid="supplier-services-refresh" disabled={busy||suspended} onClick={()=>void load()}>{busy?'Consultando disponibilidad…':'Revisar disponibilidad'}</button>{busy?<button className={styles.button} type="button" data-testid="supplier-services-cancel" onClick={cancel}>Cancelar consulta</button>:null}</div>
 <p role="status" aria-live="polite">{busy?'Consulta de metadatos en curso. No se ejecutan migraciones ni escrituras.':message||(!sample?'Disponibilidad aún no consultada. Los controles de cada módulo son consultas, no confirmaciones de habilitación.':'')}</p>
 {sample?<><p className={styles.muted}>{expired?'Observación anterior; actualizá antes de decidir.':'Observación puntual; no es monitoreo continuo.'} Hora UTC: {sample.observedAt.replace('T',' ').replace('Z','')}. Los cambios posteriores los verifica cada operación en el servidor.</p>
 <ul className={styles.list}>{sample.services.map(s=><li key={s.id} data-testid={'supplier-service-'+s.id}><div><strong>{labels[s.id]}</strong><span>{states[s.state]}</span><span>{s.state==='setup_required'?'NexID debe completar los requisitos de despliegue; no es un error en tu solicitud.':s.state==='temporarily_disabled'?'El módulo está desactivado en esta API; no se inicia una cancelación.':s.state==='read_only'?'El historial se puede consultar; las nuevas escrituras están desactivadas.':'La disponibilidad técnica no confirma permisos sobre este expediente ni el siguiente paso comercial.'}</span></div></li>)}</ul></>:null}
 </section>;
}
