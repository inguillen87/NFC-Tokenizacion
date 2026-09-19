"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Boxes,Clock3,Download,FileText,Layers,Link2,RefreshCw,ShieldCheck,Truck} from 'lucide-react';
import {TRACE_LABELS,ROLE_LABELS,parseTrace,parseTraceDetail,relationGroups,actionLabel,traceDate,traceCsv,traceHtml,traceVocabulary,traceShipmentStatus,type TraceSnapshot,type TraceDetail,type TraceFilters} from '../lib/batch-trace-model';
import {boundedDossierJson} from '../lib/batch-dossier-readings';
import styles from './batch-trace-workspace.module.css';
type Props={bid:string;tenant:string;initial:TraceSnapshot|null;initialFilters:TraceFilters};
export function BatchTraceWorkspace({bid,tenant,initial,initialFilters}:Props){
 const [data,setData]=useState(initial),[filters,setFilters]=useState(initialFilters),[detail,setDetail]=useState<TraceDetail|null>(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(initial?'':'La fuente no confirmó esta consulta. No se presume un historial vacío.'),[tab,setTab]=useState<'events'|'shipments'>('events');
 const flight=useRef<AbortController|null>(null),mounted=useRef(true),detailRegion=useRef<HTMLElement|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;flight.current?.abort();};},[]);
 useEffect(()=>{if(!detail)return;detailRegion.current?.focus({preventScroll:true});if(window.matchMedia('(max-width:760px)').matches)detailRegion.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});},[detail]);
 function params(f:TraceFilters,company=tenant){return new URLSearchParams({...f,...(company?{tenant:company}:{})});}
 async function query(eventId?:string){
  if(flight.current)return;const f=eventId?data!.filters:filters,company=eventId?data!.scope.tenant:tenant;
  const controller=new AbortController();flight.current=controller;setBusy(true);setError('');setDetail(null);setSelected(eventId||'');if(!eventId)setData(null);
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const path=`/api/admin/batches/${encodeURIComponent(bid)}/traceability${eventId?'/events/'+encodeURIComponent(eventId):''}?${params(f,company)}`;
   const response=await fetch(path,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error(response.status===403?'Tu cuenta no tiene permiso para consultar este alcance.':response.status===400?'Revisá el período (1 a 93 días) y los filtros.':'No se pudo consultar la trazabilidad. El resultado anterior no se ofrece como actual.');
   const raw=await boundedDossierJson(response);
   if(mounted.current){if(eventId)setDetail(parseTraceDetail(raw,bid,company,f,eventId));else{const result=parseTrace(raw,bid,company,f);setData(result);setTab('events');}}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Consulta sin confirmar.');}
  finally{clearTimeout(timer);flight.current=null;if(mounted.current)setBusy(false);}
 }
 function download(kind:'html'|'csv'|'json'){
  if(!data||busy||JSON.stringify(filters)!==JSON.stringify(data.filters))return;
  const body=kind==='html'?traceHtml(data):kind==='csv'?traceCsv(data):JSON.stringify(data,null,2);
  const url=URL.createObjectURL(new Blob([body],{type:kind==='html'?'text/html;charset=utf-8':kind==='csv'?'text/csv;charset=utf-8':'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='nexid-trazabilidad.'+kind;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 const dirty=Boolean(data&&JSON.stringify(filters)!==JSON.stringify(data.filters));
 const active=data?.events.find(e=>e.id===selected);
 return <main className={styles.root} data-testid="batch-trace-workspace">
 <div className={styles.top}><Link prefetch={false} href={`/batches/${encodeURIComponent(bid)}?${new URLSearchParams(tenant?{tenant}:{})}`}><ArrowLeft size={16} aria-hidden="true"/>Volver al expediente</Link><Link prefetch={false} href={`/batches/${encodeURIComponent(bid)}?${new URLSearchParams(tenant?{tenant}:{})}#dossier-readings`}><ShieldCheck size={16} aria-hidden="true"/>Lecturas NFC</Link></div>
 <header className={styles.hero}><div><p className={styles.eyebrow}>DEL PRODUCTO A SU RECORRIDO</p><h1>Trazabilidad del lote</h1><p>{data?.scope.product||bid} · {data?.scope.tenant||tenant||'Alcance por confirmar'}</p></div><span className={styles.heroIcon}><Layers size={31} aria-hidden="true"/></span></header>
 <form className={styles.filters} onSubmit={e=>{e.preventDefault();void query();}}>
 <label>Desde · UTC<input type="date" value={filters.from} disabled={busy} onChange={e=>setFilters({...filters,from:e.target.value})}/></label>
 <label>Hasta · fin excluido<input type="date" value={filters.to} disabled={busy} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
 <label>Tipo de evento<select value={filters.eventType} disabled={busy} onChange={e=>setFilters({...filters,eventType:e.target.value})}><option value="">Todos los tipos</option>{Object.entries(TRACE_LABELS).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select></label>
 <label>Identidad registrada<select value={filters.identityId} disabled={busy} onChange={e=>setFilters({...filters,identityId:e.target.value})}><option value="">Todas las del lote</option>{data?.identities.map(i=><option value={i.id} key={i.id}>{i.gtin} · {i.serial||i.lot||'sin serie'}</option>)}</select></label>
 <button type="submit" disabled={busy} className={styles.primary}><RefreshCw size={16} aria-hidden="true"/>{busy?'Consultando…':'Consultar trazabilidad'}</button></form>
 <p role="status" className={styles.status}>{error|| (dirty?'Filtros modificados: consultá para actualizar los resultados y habilitar la exportación.':busy?'Consultando la fuente; todavía no hay un nuevo resultado confirmado.':data?'Fuente: base operativa · '+traceDate(data.observedAt)+' · sin actualización automática.':'Sin datos confirmados.')}</p>
 {data&&<>
 <div className={styles.metrics}><div><Clock3 size={19} aria-hidden="true"/><span>Eventos visibles del período</span><strong>{data.events.length}{data.hasMoreEvents?' +':''}</strong></div><div><Link2 size={19} aria-hidden="true"/><span>Identidades del lote en la lista</span><strong>{data.identities.length}{data.hasMoreIdentities?' +':''}</strong></div><div><Truck size={19} aria-hidden="true"/><span>Envíos vinculados por precinto</span><strong>{data.shipments.length}{data.hasMoreShipments?' +':''}</strong></div></div>
 <div className={styles.tabs} role="group" aria-label="Vista de trazabilidad"><button type="button" aria-pressed={tab==='events'} onClick={()=>setTab('events')}><Layers size={16} aria-hidden="true"/>Cronología y relaciones</button><button type="button" aria-pressed={tab==='shipments'} onClick={()=>setTab('shipments')}><Truck size={16} aria-hidden="true"/>Envíos vinculados</button><span className={styles.export}><button type="button" disabled={busy||dirty} onClick={()=>download('html')}><Download size={15} aria-hidden="true"/>Informe HTML</button><button type="button" disabled={busy||dirty} onClick={()=>download('csv')}>CSV</button><button type="button" disabled={busy||dirty} onClick={()=>download('json')}>JSON</button></span></div>
 <section hidden={tab!=='events'} className={styles.layout}>
 <div className={styles.card}><h2>Qué se registró</h2><p className={styles.small}>Orden por momento declarado. La fecha de registro se conserva por separado.</p>
 {data.hasMoreEvents&&<p className={styles.notice}>Se muestran 50 eventos. Reducí el período o filtrá una identidad para revisar los restantes.</p>}
 {data.events.length?<ol className={styles.timeline}>{data.events.map(e=><li key={e.id}><button type="button" aria-pressed={selected===e.id} disabled={busy||dirty} onClick={()=>void query(e.id)}><span className={styles.eventMark}><Layers size={17} aria-hidden="true"/></span><span><small>{traceDate(e.eventTime)}</small><strong>{TRACE_LABELS[e.type]}</strong><span>{actionLabel(e)}</span><em>{e.hasErrorDeclaration?'Declarado en error':'Declaración externa · no es un TAP'}</em></span><ArrowRight size={16} aria-hidden="true"/></button></li>)}</ol>:<div className={styles.empty}><Boxes size={32} aria-hidden="true"/><h3>Sin eventos EPCIS vinculados en este período</h3><p>Los TAP NFC no se convierten automáticamente en movimientos logísticos. Conservá su evidencia en Lecturas; los sistemas del cliente incorporan eventos mediante la integración existente.</p><Link href="/sdk-vision" prefetch={false} className={styles.button}>Abrir API y SDK</Link></div>}
 </div>
 <aside ref={detailRegion} tabIndex={-1} className={`${styles.card} ${styles.detailRegion}`} aria-label="Detalle del evento seleccionado">
 {detail?<TraceEventDetail detail={detail}/>:<div className={styles.empty}><Link2 size={31} aria-hidden="true"/><h2>{busy&&selected?'Consultando el evento':'Abrí un evento para ver sus relaciones'}</h2><p>{active?'No se muestra un detalle anterior como resultado del evento seleccionado.':'Verás los identificadores vinculados, sus papeles en esa declaración y las referencias del documento. No se presume la composición actual de una caja o pallet.'}</p></div>}
 </aside></section>
 <section hidden={tab!=='shipments'} className={styles.card}><h2>Envíos que utilizaron precintos de este lote</h2><p>Estado del módulo logístico al consultar. Esta vinculación identifica el precinto, no asegura qué producto contiene la caja. El filtro de fechas anterior corresponde sólo a eventos EPCIS.</p>
 {data.shipments.length?<div className={styles.shipments}>{data.shipments.map(s=><article key={s.id}><Truck size={24} aria-hidden="true"/><h3>{s.shipment_code}</h3><span className={styles.badge}>{traceShipmentStatus(s.status)}</span><p>{s.linked_seals} precintos vinculados · actualización {traceDate(s.updated_at)}</p><Link className={styles.button} prefetch={false} href={`/logistics/shipments/${encodeURIComponent(s.id)}?${new URLSearchParams({tenant:data.scope.tenant})}`}>Abrir envío y custodia<ArrowRight size={15} aria-hidden="true"/></Link></article>)}</div>:<p className={styles.notice}>No hay vínculos directos de precintos con envíos en la consulta. No se infieren envíos por nombre, SKU o cercanía geográfica.</p>}
 {data.hasMoreShipments&&<p className={styles.notice}>Se muestran diez envíos recientes. El módulo logístico conserva los demás registros.</p>}</section>
 <p className={styles.boundary}><ShieldCheck size={16} aria-hidden="true"/>Consultar y exportar no agrega movimientos, no cambia custodia, no activa etiquetas y no envía transacciones a blockchain.</p>
 </>}
 </main>;
}
function TraceEventDetail({detail:d}:{detail:TraceDetail}){
 const e=d.event,groups=relationGroups(e);
 function exportEvent(){const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='nexid-evento-trazabilidad.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
 return <div className={styles.detail} data-testid="trace-event-detail"><p className={styles.eyebrow}>EVIDENCIA DE UN EVENTO · NO ESTADO ACTUAL</p><h2>{TRACE_LABELS[e.type]}</h2><span className={styles.badge}>{actionLabel(e)}</span>
 {e.hasErrorDeclaration&&<p role="status" className={styles.warning}>El origen declaró este evento en error. No lo interpretes como evidencia vigente; conservamos su referencia histórica.</p>}
 <dl className={styles.facts}>{[['Momento declarado',traceDate(e.eventTime)],['Registro en NexID',traceDate(e.recordTime)],['Paso de negocio',traceVocabulary(e.bizStep)],['Disposición',traceVocabulary(e.disposition)],['Punto de lectura',e.readPoint||'No informado'],['Ubicación declarada',e.bizLocation||'No informada']].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
 <div className={styles.relations}>{groups.map(([role,label])=><section key={role}><h3>{label}</h3>{d.identities.filter(i=>i.roles.includes(role)).map(i=><article className={styles.identity} key={i.id} data-current={i.batchId===d.scope.batchId}><strong>{i.gtin}</strong><span>{i.lot?`Lote ${i.lot}`:'Sin lote GS1'} · {i.serial?`Serie ${i.serial}`:'Sin serie individual'}</span><small>Registro: {i.status} · {i.roles.map(r=>ROLE_LABELS[r]).join(' / ')}</small>{i.quantities.filter(q=>q.role===role).map((q,n)=><small key={n}>Cantidad declarada: {q.value??'no informada'} {q.uom||'(unidad no informada)'}</small>)}{i.batchId===d.scope.batchId?<em>Lote que estás consultando</em>:<Link prefetch={false} href={`/batches/${encodeURIComponent(i.bid)}/traceability?${new URLSearchParams({...d.filters,identityId:i.id,tenant:d.scope.tenant})}`}>Seguir en {i.bid}<ArrowRight size={13} aria-hidden="true"/></Link>}</article>)}{!d.identities.some(i=>i.roles.includes(role))&&<p className={styles.small}>Sin identificadores enumerados en este papel. No se infiere una cantidad cero ni contenido físico.</p>}</section>)}</div>
 {d.unmappedReferences>0&&<p className={styles.notice}>{d.unmappedReferences} referencias del evento no pudieron asociarse al registro visible. La relación presentada puede estar incompleta.</p>}
 <p className={styles.notice}>{e.type==='TransformationEvent'?'Las entradas y salidas corresponden a una transformación declarada; no representan una agrupación física ni una prueba de equivalencia de cantidades.':e.action==='DELETE'?'La desvinculación es una declaración histórica. No borra unidades, eventos ni registros y no permite reconstruir por sí sola el contenido actual.':'La relación pertenece a esta declaración. Abrirla no verifica un lector UHF, una ubicación GPS ni el precinto NFC.'}</p>
 <button type="button" className={styles.button} onClick={exportEvent}><Download size={15} aria-hidden="true"/>Descargar evidencia del evento</button><details className={styles.references}><summary><FileText size={16} aria-hidden="true"/>Referencias para auditoría</summary><dl className={styles.facts}>{[['ID del evento',e.id],['Referencia del origen',e.clientEventId||'No informada'],['Documento',d.documentId],['Captura',d.captureId],['Detalle consultado',traceDate(d.observedAt)]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
 </div>;
}
