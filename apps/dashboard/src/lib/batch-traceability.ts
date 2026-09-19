export type TraceRef={id:string;bid:string;batchId:string;gtin:string;lot:string;serial:string;role:'object'|'parent'|'child'|'input'|'output';quantity:number|null;uom:string|null;focus:boolean};
export type TraceEvent={id:string;kind:'epcis';type:string;action:'ADD'|'OBSERVE'|'DELETE'|null;occurredAt:string;recordedAt:string;step:string|null;disposition:string|null;readPoint:string|null;location:string|null;correctionDeclared:boolean;references:TraceRef[];omittedReferences:number;basis:'external_declaration'};
export type CustodyEvent={id:string;kind:'custody';type:string;recordedAt:string;shipmentId:string|null;shipmentCode:string|null;basis:'recorded_custody_workflow'};
export type TraceShipment={id:string;code:string;status:string;createdAt:string;updatedAt:string;basis:'current_workflow_record'};
export type BatchTrace={ok:true;protocol:'nexid.batch-traceability.v1';source:'database';observedAt:string;scope:{tenant:string;tenantName:string;bid:string;batchId:string};product:{name:string;carrier:string|null;status:string|null};window:{from:string;to:string;start:string;endExclusive:string;timezone:'UTC'};events:TraceEvent[];custody:CustodyEvent[];shipments:TraceShipment[];hasMore:{events:boolean;custody:boolean;shipments:boolean};logisticsAccess:'allowed'|'restricted';limits:{events:number;shipments:number;custody:number;referencesPerEvent:number;days:number};readOnly:true;relationshipMode:'historical_events_not_current_containment'};
export const eventLabels:Record<string,string>={ObjectEvent:'Observación de producto',AggregationEvent:'Agrupación de unidades',AssociationEvent:'Asociación de elementos',TransformationEvent:'Transformación',TransactionEvent:'Referencia de transacción'};
export const actionLabels:Record<string,string>={ADD:'Incorporación declarada',OBSERVE:'Observación declarada',DELETE:'Retiro o separación declarados'};
export const stepLabels:Record<string,string>={commissioning:'Identificación',packing:'Empaque',shipping:'Despacho',receiving:'Recepción',storing:'Almacenamiento',loading:'Carga',unloading:'Descarga',departing:'Salida',arriving:'Llegada',inspecting:'Inspección',assembling:'Ensamblado',unpacking:'Desempaque',destroying:'Destrucción',decommissioning:'Retiro de circulación',other:'Paso de negocio propio'};
export const dispositionLabels:Record<string,string>={active:'Activo según el emisor',in_progress:'En proceso',in_transit:'En tránsito',recalled:'Retirado',damaged:'Dañado',destroyed:'Destruido',sellable_accessible:'Disponible para venta',non_sellable_other:'No disponible para venta',other:'Disposición propia'};
export const custodyLabels:Record<string,string>={SEALED:'Precintado registrado',seal_applied:'Precinto aplicado',seal_assigned:'Precinto asignado',shipment_created:'Envío creado',IN_TRANSIT:'En tránsito registrado',DELIVERED_CLOSED:'Entrega registrada con precinto cerrado',DELIVERED_OPENED:'Entrega registrada con precinto abierto',QUARANTINED:'Cuarentena registrada',delivered:'Entrega registrada',scanned:'Lectura logística registrada'};
const uuid=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))throw Error('trace_id');return v;};
const rec=(v:unknown):Record<string,any>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('trace_object');return v as Record<string,any>;};
const text=(v:unknown,max=240)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u001F\u007F]/.test(v))throw Error('trace_text');return v;};
const nullable=(v:unknown,max=240)=>v===null?null:text(v,max);
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw Error('trace_bool');return v;};
const time=(v:unknown)=>{const t=text(v,40);if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(t)||!Number.isFinite(Date.parse(t)))throw Error('trace_time');return new Date(t).toISOString();};
const list=(v:unknown,n:number)=>{if(!Array.isArray(v)||v.length>n)throw Error('trace_list');return v.map(rec);};
const count=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>10000)throw Error('trace_count');return v;};
export function parseBatchTrace(raw:unknown,bid:string,tenant:string,expectedWindow?:{from:string;to:string}):BatchTrace{
 const r=rec(raw),s=rec(r.scope),w=rec(r.window),p=rec(r.product),more=rec(r.hasMore),limits=rec(r.limits);
 if(r.ok!==true||r.protocol!=='nexid.batch-traceability.v1'||r.source!=='database'||r.readOnly!==true||r.relationshipMode!=='historical_events_not_current_containment')throw Error('trace_source');
 if(s.bid!==bid||tenant&&s.tenant!==tenant||!s.tenant||!['allowed','restricted'].includes(r.logisticsAccess))throw Error('trace_scope');
 const scope={tenant:text(s.tenant,120),tenantName:text(s.tenantName,240),bid:text(s.bid,160),batchId:uuid(s.batchId)};
 const window={from:text(w.from,10),to:text(w.to,10),start:time(w.start),endExclusive:time(w.endExclusive),timezone:'UTC' as const};
 if(w.timezone!=='UTC'||window.start!==window.from+'T00:00:00.000Z'||new Date(Date.parse(window.to)+86400000).toISOString()!==window.endExclusive||Date.parse(window.endExclusive)<=Date.parse(window.start)||Date.parse(window.endExclusive)-Date.parse(window.start)>93*86400000||expectedWindow&&(w.from!==expectedWindow.from||w.to!==expectedWindow.to))throw Error('trace_window');
 const events=list(r.events,50).map(e=>{
  if(!Object.hasOwn(eventLabels,e.type)||!['ADD','OBSERVE','DELETE',null].includes(e.action)||e.basis!=='external_declaration'||e.kind!=='epcis')throw Error('trace_event');
  const occurredAt=time(e.occurredAt);if(occurredAt<window.start||occurredAt>=window.endExclusive)throw Error('trace_outside_window');
  const references=list(e.references,100).map(i=>{
   if(!['object','parent','child','input','output'].includes(i.role)||!/^[0-9]{14}$/.test(i.gtin)||i.quantity!==null&&(typeof i.quantity!=='number'||!Number.isFinite(i.quantity)||i.quantity<0))throw Error('trace_reference');
   const batchId=uuid(i.batchId),focus=bool(i.focus);if(focus!==(batchId===scope.batchId))throw Error('trace_focus');
   return {id:uuid(i.id),bid:text(i.bid,160),batchId,gtin:text(i.gtin,14),lot:text(i.lot,20),serial:text(i.serial,20),role:i.role,quantity:i.quantity,uom:nullable(i.uom,8),focus} as TraceRef;
  });
  return {id:uuid(e.id),kind:'epcis' as const,type:e.type,action:e.action,occurredAt,recordedAt:time(e.recordedAt),step:nullable(e.step,80),disposition:nullable(e.disposition,80),readPoint:nullable(e.readPoint,512),location:nullable(e.location,512),correctionDeclared:bool(e.correctionDeclared),references,omittedReferences:count(e.omittedReferences),basis:'external_declaration' as const};
 });
 const custody=list(r.custody,50).map(c=>{if(c.kind!=='custody'||c.basis!=='recorded_custody_workflow')throw Error('trace_custody');const recordedAt=time(c.recordedAt);if(recordedAt<window.start||recordedAt>=window.endExclusive)throw Error('trace_custody_window');return {id:uuid(c.id),kind:'custody' as const,type:text(c.type,60),recordedAt,shipmentId:c.shipmentId===null?null:uuid(c.shipmentId),shipmentCode:nullable(c.shipmentCode,180),basis:'recorded_custody_workflow' as const};});
 const shipments=list(r.shipments,20).map(s=>{if(s.basis!=='current_workflow_record')throw Error('trace_shipment');return {id:uuid(s.id),code:text(s.code,180),status:text(s.status,60),createdAt:time(s.createdAt),updatedAt:time(s.updatedAt),basis:'current_workflow_record' as const};});
 if(r.logisticsAccess==='restricted'&&(custody.length||shipments.length||more.custody||more.shipments))throw Error('trace_permission_leak');
 for(const a of [events,custody,shipments])if(new Set(a.map(x=>x.id)).size!==a.length)throw Error('trace_duplicate');
 for(const [k,v] of Object.entries({events:50,shipments:20,custody:50,referencesPerEvent:100,days:93}))if(limits[k]!==v)throw Error('trace_limit');
 return {ok:true,protocol:r.protocol,source:'database',observedAt:time(r.observedAt),scope,product:{name:text(p.name,240),carrier:nullable(p.carrier,80),status:nullable(p.status,80)},window,events,custody,shipments,hasMore:{events:bool(more.events),custody:bool(more.custody),shipments:bool(more.shipments)},logisticsAccess:r.logisticsAccess,limits:{events:50,shipments:20,custody:50,referencesPerEvent:100,days:93},readOnly:true,relationshipMode:'historical_events_not_current_containment'};
}
export async function readTraceJson(response:Response){
 if(!response.body)throw Error('trace_empty');const reader=response.body.getReader(),decoder=new TextDecoder();let total=0,body='';
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1048576)throw Error('trace_response_limit');body+=decoder.decode(value,{stream:true});}body+=decoder.decode();return JSON.parse(body);}finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
export function traceTimeline(data:BatchTrace,kind:string,query:string){
 const terms=query.trim().toLocaleLowerCase('es').slice(0,160);
 const rows:Array<TraceEvent|CustodyEvent>=[...data.events,...data.custody];
 return rows.filter(e=>(kind==='all'||kind==='relationships'&&e.kind==='epcis'&&['AggregationEvent','AssociationEvent','TransformationEvent'].includes(e.type)||e.kind===kind)&&(!terms||[e.type,e.kind==='epcis'?e.step:null,...(e.kind==='epcis'?e.references.flatMap(r=>[r.gtin,r.lot,r.serial,r.bid]):[e.shipmentCode])].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(terms))).sort((a,b)=>{const at=a.kind==='epcis'?a.occurredAt:a.recordedAt,bt=b.kind==='epcis'?b.occurredAt:b.recordedAt;return bt.localeCompare(at)||a.id.localeCompare(b.id);});
}
export function isRelationship(e:TraceEvent|CustodyEvent){return e.kind==='epcis'&&['AggregationEvent','AssociationEvent','TransformationEvent'].includes(e.type);}
export function traceSummary(data:BatchTrace){return {epcis:data.events.length,custody:data.custody.length,relationships:data.events.filter(isRelationship).length,identities:new Set(data.events.flatMap(e=>e.references.filter(r=>r.focus).map(r=>r.id))).size};}
