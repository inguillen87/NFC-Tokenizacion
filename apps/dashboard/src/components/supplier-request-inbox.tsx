'use client';
import{useRef,useState}from'react';
import type{SupplierRequest}from'../lib/supplier-request-client';
import{buildRequestInbox,INBOX_STATES,inboxState,inboxActivity,inboxActivityLabel,inboxNextStep,type InboxFilter,type InboxGroup,type InboxSort}from'../lib/supplier-request-inbox';
import styles from'./supplier-request-workspace.module.css';import view from'./supplier-request-inbox.module.css';
type Props={items:SupplierRequest[]|null;truncated:boolean;loading:boolean;error:string;disabled:boolean;selectedId?:string;isNexid:boolean;includeCancelled?:boolean;onOpen:(item:SupplierRequest)=>void};
const groups:{id:InboxGroup;label:string}[]=[{id:'all',label:'Cargadas'},{id:'draft',label:'Borradores'},{id:'company',label:'Empresa debe responder'},{id:'nexid',label:'NexID debe revisar'}];
export function SupplierRequestInbox({items,truncated,loading,error,disabled,selectedId,isNexid,includeCancelled=false,onOpen}:Props){
 const[query,setQuery]=useState(''),[filter,setFilter]=useState<InboxFilter>('all'),[group,setGroup]=useState<InboxGroup>('all'),[sort,setSort]=useState<InboxSort>('source');const search=useRef<HTMLInputElement|null>(null);
 const{counts,visible}=buildRequestInbox(items||[],query,filter,group,sort,isNexid);const filtered=Boolean(query||filter!=='all'||group!=='all');
 function clear(){setQuery('');setFilter('all');setGroup('all');search.current?.focus();}
 return<div data-testid="supplier-request-inbox" aria-busy={loading}>
 {items?<><div className={view.groups} role="group" aria-label="Filtrar por borradores o aclaraciones">
 {groups.map(g=><button key={g.id} type="button" className={view.group} aria-pressed={group===g.id} aria-label={g.label+': '+counts[g.id]+'. Filtrar solicitudes cargadas'} data-testid={'inbox-group-'+g.id} onClick={()=>{setGroup(g.id);setFilter('all');}}><span>{g.label}</span><strong aria-hidden="true">{counts[g.id]}</strong></button>)}
 </div><p className={styles.muted}>Conteos de las solicitudes cargadas, antes de filtrar. No incluyen tareas de cotización.</p></>:null}
 <div className={styles.toolbar}>
 <label>Buscar entre las solicitudes cargadas<input ref={search} data-testid="supplier-request-inbox-search" type="search" maxLength={200} placeholder="Producto, empresa o referencia" value={query} onChange={e=>setQuery(e.target.value)} aria-describedby="request-inbox-search-hint"/></label>
 <label>Estado de gestión<select data-testid="supplier-request-inbox-filter" value={filter} onChange={e=>{setFilter(e.target.value as InboxFilter);setGroup('all');}}><option value="all">Todos los estados</option>{Object.entries(INBOX_STATES).filter(([id])=>includeCancelled||id!=='cancelled').map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label>Ordenar solicitudes<select data-testid="request-inbox-sort" value={sort} onChange={e=>setSort(e.target.value as InboxSort)}><option value="source">Orden de la consulta</option><option value="recent">Actividad más reciente</option><option value="oldest">Actividad más antigua</option><option value="review">Revisión primero</option></select></label>
 </div>
 <p className={styles.muted} id="request-inbox-search-hint">Combiná producto, empresa o referencia, sin distinguir tildes. Sólo se buscan registros cargados.</p>
 <p role="status" aria-live="polite">{error||(loading&&items===null?'Consultando la fuente…':items?.length===0?'La fuente no encontró solicitudes en este alcance.':items&&visible.length===0?'No hay coincidencias entre las solicitudes cargadas. Probá otro filtro o búsqueda.':'')}</p>
 {items?<p className={styles.muted} data-testid="supplier-request-inbox-count" role="status">{visible.length} de {items.length} solicitudes cargadas{truncated?'; no es el total del historial':''}. Los filtros se aplican sólo a esta respuesta.</p>:null}
 {filtered?<div className={!visible.length&&items?.length?view.empty:undefined}>{!visible.length&&items?.length?<><strong>Ninguna solicitud coincide con estos filtros</strong><p>Limpiá los filtros o actualizá la bandeja. Esta búsqueda no consulta registros antiguos que no estén cargados.</p></>:null}<button className={styles.button} data-testid="request-inbox-clear" type="button" onClick={clear}>Limpiar búsqueda y filtros</button></div>:null}
 {items&&selectedId&&!visible.some(row=>row.id===selectedId)?<p className={view.openHint} data-testid="request-inbox-open-outside">El expediente abierto no aparece en estos resultados. Filtrar no descarta su edición. <a href="#supplier-request-editor">Ir al expediente abierto</a></p>:null}
 {visible.length?<ul className={styles.list}>{visible.map(item=><li key={item.id} className={item.id===selectedId?view.selected:undefined} data-testid="request-inbox-row">
 <div><strong>{item.title}</strong><span>{item.tenant_slug} · {INBOX_STATES[inboxState(item)]} · versión {item.revision}</span><span className={view.next}>{inboxNextStep(item,isNexid)}</span><span>Última actividad: <time dateTime={inboxActivity(item)||undefined}>{inboxActivityLabel(item)}</time></span><code className={view.reference}>{item.id}</code>{item.id===selectedId?<span className={view.selectionLabel}>Expediente abierto</span>:null}</div>
 <button className={styles.button+' '+view.rowButton} data-testid="supplier-request-open" type="button" disabled={disabled} aria-current={item.id===selectedId?'true':undefined} aria-label={'Ver solicitud '+item.title+' de '+item.tenant_slug+', referencia '+item.id} onClick={()=>{if(!disabled)onOpen(item);}}>Ver solicitud</button>
 </li>)}</ul>:null}
 {truncated&&items?<p className={styles.notice}>Se muestran las solicitudes más recientes; hay más registros fuera de esta respuesta.</p>:null}
 </div>;
}
