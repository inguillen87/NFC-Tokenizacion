"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowDown,Boxes,PackageMinus,Search,ScanLine,X,Plus,Check,ArrowRight} from 'lucide-react';
import type {IntakeScope} from '../lib/epcis-intake-model';
import {parseIdentitySearch,RELATION_COPY,MAX_RELATION_CHILDREN,type IdentitySearch,type RegisteredUnit,type RelationDraft} from '../lib/epcis-relation-builder';
import {boundedDossierJson} from '../lib/batch-dossier-readings';
import styles from './epcis-relation-composer.module.css';
type Props={scope:IntakeScope;value:RelationDraft;disabled:boolean;validated?:boolean;onChange:(draft:RelationDraft)=>void};
export function RelationComposer({scope,value,disabled,validated=false,onChange}:Props){
 const [area,setArea]=useState<'batch'|'company'>('batch'),[term,setTerm]=useState(''),[result,setResult]=useState<IdentitySearch|null>(null),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const [directoryOpen,setDirectoryOpen]=useState(true);
 useEffect(()=>{if(validated)setDirectoryOpen(false);},[validated]);
 const controller=useRef<AbortController|null>(null),alive=useRef(true),sequence=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;controller.current?.abort();};},[]);
 function reset(){sequence.current++;controller.current?.abort();setResult(null);setMessage('');}
 async function search(next=false){
  if(disabled||loading)return;const query={area,term:term.trim()},cursor=next?result?.nextCursor:null;
  if(area==='company'&&query.term.length<2){setMessage('Para buscar en otros lotes escribí al menos dos caracteres del lote, GTIN o serie.');return;}
  if(next&&!cursor)return;const c=new AbortController(),seq=++sequence.current;controller.current=c;const timer=setTimeout(()=>c.abort(),12000);
  setLoading(true);setResult(null);setMessage('');
  try{
   const params=new URLSearchParams({tenant:scope.tenant,area:query.area,term:query.term,...(cursor?{cursor}:{})});
   const response=await fetch(`/api/admin/batches/${encodeURIComponent(scope.bid)}/epcis-intake/identities?${params}`,{cache:'no-store',signal:c.signal});
   if(!response.ok)throw Error(response.status===403?'Tu cuenta no tiene acceso a esta búsqueda.':response.status===429?'La búsqueda alcanzó el límite temporal. Esperá un minuto; la selección se conserva.':'No se pudieron consultar las identidades. La selección anterior no se considera validada.');
   const data=parseIdentitySearch(await boundedDossierJson(response),scope,query);
   if(alive.current&&seq===sequence.current){setResult(data);setMessage(data.items.length?`${data.items.length} identidades en esta página${data.hasMore?'; hay más resultados.':'.'}`:'No hay coincidencias activas con serie. No se crearon identidades de ejemplo.');}
  }catch(e){if(alive.current&&seq===sequence.current)setMessage(e instanceof Error?e.message:'Fuente no disponible.');}
  finally{clearTimeout(timer);if(controller.current===c)controller.current=null;if(alive.current)setLoading(false);}
 }
 function choose(unit:RegisteredUnit,role:'parent'|'child'){
  if(disabled)return;
  if(value.parent?.id===unit.id||value.children.some(c=>c.id===unit.id))return;
  if(role==='parent')onChange({...value,parent:unit});
  else if(value.children.length<MAX_RELATION_CHILDREN)onChange({...value,children:[...value.children,unit]});
 }
 return <section className={styles.composer} data-testid="relation-composer" aria-label="Preparar una agrupación">
  <div className={styles.actions} role="group" aria-label="Tipo de agrupación">{([['ADD',Boxes],['DELETE',PackageMinus],['OBSERVE',ScanLine]] as const).map(([action,Icon])=><button type="button" disabled={disabled} aria-pressed={value.action===action} key={action} onClick={()=>onChange({...value,action})}><Icon size={20} aria-hidden="true"/><strong>{RELATION_COPY[action].verb}</strong></button>)}</div>
  <p className={styles.description}>{RELATION_COPY[value.action].detail}</p>
  <RelationSummary value={value} scope={scope} onChange={disabled?undefined:onChange}/>
  <details className={styles.searchPanel} open={directoryOpen} onToggle={e=>setDirectoryOpen(e.currentTarget.open)}><summary><Search size={17} aria-hidden="true"/>Buscar o cambiar identidades</summary>
   <div className={styles.searchFields}><label>Dónde buscar<select value={area} disabled={disabled||loading} onChange={e=>{reset();setArea(e.target.value as typeof area);}}><option value="batch">En este lote</option><option value="company">En otros lotes de mi empresa</option></select></label><label>Lote, GTIN o serie<input aria-label="Buscar lote GTIN o serie" maxLength={80} value={term} disabled={disabled||loading} onChange={e=>{reset();setTerm(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search();}}} placeholder="Ej.: CAJA-0042"/></label></div>
   <button type="button" className={styles.searchButton} disabled={disabled||loading} onClick={()=>void search()}><Search size={15} aria-hidden="true"/>{loading?'Buscando…':'Buscar identidades'}</button><p className={styles.help}>La búsqueda se ejecuta al solicitarla. Elegir una identidad no registra un movimiento ni aprueba su estado físico.</p>
   <p role="status" className={styles.status}>{message}</p>
   {result&&<ul className={styles.results}>{result.items.map(i=>{const parent=value.parent?.id===i.id,child=value.children.some(c=>c.id===i.id);return <li key={i.id}><div><span>{i.bid===scope.bid?'LOTE ACTUAL':i.bid}</span><strong>{i.serial}</strong><small>{i.product} · GTIN {i.gtin}{i.lot?' · '+i.lot:''}</small></div><div className={styles.pickActions}>{parent||child?<span className={styles.selected}><Check size={14} aria-hidden="true"/>{parent?'Contenedor':'Unidad elegida'}</span>:<><button type="button" disabled={disabled} aria-label={`Usar ${i.serial} como contenedor`} onClick={()=>choose(i,'parent')}>Contenedor</button><button type="button" disabled={disabled||value.children.length>=MAX_RELATION_CHILDREN} aria-label={`Agregar ${i.serial} a unidades`} onClick={()=>choose(i,'child')}><Plus size={14} aria-hidden="true"/>Unidad</button></>}</div></li>;})}</ul>}
   {result?.hasMore&&<button type="button" className={styles.more} disabled={disabled||loading} onClick={()=>void search(true)}>Más coincidencias<ArrowRight size={15} aria-hidden="true"/></button>}
  </details>
 </section>;
}
export function RelationSummary({value,scope,onChange}:{value:RelationDraft;scope:IntakeScope;onChange?:(draft:RelationDraft)=>void}){
 const belongs=value.parent?.batchId===scope.batchId||value.children.some(i=>i.batchId===scope.batchId);
 return <div className={styles.summary} data-action={value.action} data-testid="relation-summary">
  <div className={styles.parent}><Boxes size={24} aria-hidden="true"/><div><span>CONTENEDOR IDENTIFICADO</span><strong>{value.parent?.serial||'Elegí una caja o pallet registrado'}</strong>{value.parent&&<small>{value.parent.bid} · {value.parent.gtin}</small>}</div>{onChange&&value.parent&&<button type="button" aria-label="Quitar contenedor" onClick={()=>onChange({...value,parent:null})}><X size={16} aria-hidden="true"/></button>}</div>
  <div className={styles.relationLine}><ArrowDown size={18} aria-hidden="true"/><span>{RELATION_COPY[value.action].tag}</span></div>
  <div className={styles.children}><h4>{value.children.length} {value.children.length===1?'identidad seleccionada':'identidades seleccionadas'}<span>Máximo {MAX_RELATION_CHILDREN}</span></h4>{value.children.length?<ul>{value.children.map(i=><li key={i.id}><div><strong>{i.serial}</strong><small>{i.bid} · {i.gtin}</small></div>{onChange&&<button type="button" aria-label={`Quitar ${i.serial} de unidades`} onClick={()=>onChange({...value,children:value.children.filter(c=>c.id!==i.id)})}><X size={15} aria-hidden="true"/></button>}</li>)}</ul>:<p>Agregá las unidades de la declaración. No se inventan series ni cantidades.</p>}</div>
  {(value.parent||value.children.length>0)&&!belongs&&<p className={styles.warning}>Debe participar al menos una identidad del lote {scope.bid}.</p>}
  {value.action==='DELETE'&&<p className={styles.warning}>Sólo se declara la separación de las identidades elegidas. No elimina registros ni demuestra que el contenedor quedó vacío.</p>}
 </div>;
}
