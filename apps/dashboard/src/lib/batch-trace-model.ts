export const TRACE_PROTOCOL='nexid.batch-trace.v1';
export const TRACE_LABELS={ObjectEvent:'Observación de objetos',AggregationEvent:'Agrupación / desagrupación',TransactionEvent:'Vinculación comercial',TransformationEvent:'Transformación',AssociationEvent:'Asociación'} as const;
export type TraceType=keyof typeof TRACE_LABELS;
export type TraceFilters={from:string;to:string;eventType:string;identityId:string};
export type TraceScope={tenant:string;tenantId:string;batchId:string;bid:string;product:string;carrier:string|null};
export type TraceEvent={id:string;clientEventId:string;type:TraceType;eventTime:string;recordTime:string;offset:string;action:string;bizStep:string;disposition:string;readPoint:string;bizLocation:string;linkedIdentifiers:number;hasErrorDeclaration:boolean;evidence:'external_declaration'};
export type TraceId={id:string;batchId:string;bid:string;gtin:string;lot:string;serial:string;status:string;roles:string[];quantities:{role:string;value:number|null;uom:string|null}[]};
export type TraceSnapshot={ok:true;protocol:typeof TRACE_PROTOCOL;source:'database';readOnly:true;observedAt:string;scope:TraceScope;filters:TraceFilters;events:TraceEvent[];hasMoreEvents:boolean;identities:{id:string;gtin:string;lot:string;serial:string;status:string}[];hasMoreIdentities:boolean;shipments:{id:string;shipment_code:string;status:string;created_at:string;updated_at:string;linked_seals:number}[];hasMoreShipments:boolean};
export type TraceDetail={ok:true;protocol:typeof TRACE_PROTOCOL;source:'database';readOnly:true;observedAt:string;scope:TraceScope;filters:TraceFilters;event:TraceEvent;documentId:string;captureId:string;identities:TraceId[];unmappedReferences:number;interpretation:'selected_event_only'};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function verify(condition:unknown):asserts condition{if(!condition)throw Error('La fuente no confirmó un resultado válido para este alcance.');}
function text(v:unknown,max=512){verify(typeof v==='string'&&v.length<=max);}
function id(v:unknown){verify(typeof v==='string'&&UUID.test(v));}
function date(v:unknown){verify(typeof v==='string'&&Number.isFinite(Date.parse(v)));}
function count(v:unknown,max=100000){verify(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max);}
function flag(v:unknown){verify(typeof v==='boolean');}
function common(r:any,bid:string,tenant:string,f:TraceFilters){
 verify(r?.ok===true&&r.protocol===TRACE_PROTOCOL&&r.source==='database'&&r.readOnly===true&&r.scope?.bid===bid&&(!tenant||r.scope.tenant===tenant));
 id(r.scope.batchId);id(r.scope.tenantId);text(r.scope.tenant,120);text(r.scope.bid,160);text(r.scope.product,1000);date(r.observedAt);
 verify(r.filters&&Object.keys(f).every(k=>r.filters[k]===f[k as keyof TraceFilters]));
}
function event(e:any){id(e?.id);verify(Object.hasOwn(TRACE_LABELS,e.type)&&e.evidence==='external_declaration');date(e.eventTime);date(e.recordTime);flag(e.hasErrorDeclaration);count(e.linkedIdentifiers,100);for(const key of ['clientEventId','offset','action','bizStep','disposition','readPoint','bizLocation'])text(e[key]);}
export function parseTrace(raw:unknown,bid:string,tenant:string,f:TraceFilters):TraceSnapshot{
 const r=raw as TraceSnapshot;common(r,bid,tenant,f);verify(Array.isArray(r.events)&&r.events.length<=50&&Array.isArray(r.identities)&&r.identities.length<=100&&Array.isArray(r.shipments)&&r.shipments.length<=10);
 r.events.forEach(event);r.identities.forEach(i=>{id(i.id);verify(/^\d{14}$/.test(i.gtin));text(i.lot,20);text(i.serial,20);text(i.status,30);});
 r.shipments.forEach(s=>{id(s.id);text(s.shipment_code,160);text(s.status,60);date(s.created_at);date(s.updated_at);count(s.linked_seals);});
 flag(r.hasMoreEvents);flag(r.hasMoreIdentities);flag(r.hasMoreShipments);return r;
}
export function parseTraceDetail(raw:unknown,bid:string,tenant:string,f:TraceFilters,eventId:string):TraceDetail{
 const r=raw as TraceDetail;common(r,bid,tenant,f);event(r.event);verify(r.event.id===eventId&&r.interpretation==='selected_event_only');id(r.documentId);id(r.captureId);count(r.unmappedReferences,500);verify(Array.isArray(r.identities)&&r.identities.length<=100);
 for(const i of r.identities){id(i.id);id(i.batchId);text(i.bid,160);verify(/^\d{14}$/.test(i.gtin));text(i.lot,20);text(i.serial,20);text(i.status,30);verify(Array.isArray(i.roles)&&i.roles.every(x=>['object','parent','child','input','output'].includes(x)));verify(Array.isArray(i.quantities)&&i.quantities.length<=500);for(const q of i.quantities){verify(q.value===null||(typeof q.value==='number'&&Number.isFinite(q.value)&&q.value>=0));verify(q.uom===null||typeof q.uom==='string');}}
 return r;
}
export function defaultTraceFilters(now=Date.now()):TraceFilters{return {from:new Date(now-29*86400000).toISOString().slice(0,10),to:new Date(now+86400000).toISOString().slice(0,10),eventType:'',identityId:''};}
export function traceDate(value:string){return new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC';}
export function actionLabel(e:TraceEvent){
 if(e.type==='TransformationEvent')return 'Entradas y salidas declaradas';
 if(['AggregationEvent','AssociationEvent'].includes(e.type))return e.action==='ADD'?'Vinculación declarada':e.action==='DELETE'?'Desvinculación declarada':'Relación observada';
 return e.action==='ADD'?'Alta declarada':e.action==='DELETE'?'Baja declarada':'Observación declarada';
}
export function relationGroups(e:TraceEvent){return e.type==='TransformationEvent'?[['input','Entradas'],['output','Salidas']]:['AggregationEvent','AssociationEvent'].includes(e.type)?[['parent','Elemento padre'],['child','Elementos hijos']]:[['object','Objetos declarados']];}
export const ROLE_LABELS:Record<string,string>={parent:'Padre',child:'Hijo',input:'Entrada',output:'Salida',object:'Objeto'};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function traceCsv(data:TraceSnapshot){const q=(v:unknown)=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,x=>"'"+x).replaceAll('"','""')+'"';return [['evento','tipo','momento_UTC','registrado_UTC','accion','paso_de_negocio','evidencia'],...data.events.map(e=>[e.id,e.type,e.eventTime,e.recordTime,e.action,e.bizStep,e.evidence])].map(r=>r.map(q).join(',')).join('\r\n');}
export function traceHtml(data:TraceSnapshot){
 return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trazabilidad del lote</title><style>body{font:14px system-ui;color:#193447;max-width:1100px;margin:35px auto;padding:20px}h1{font-size:32px}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border-bottom:1px solid #b6d5e2;padding:10px;text-align:left;overflow-wrap:anywhere}aside{padding:16px;background:#eef6fa}small{color:#3a6178}@media print{body{margin:0}tr{break-inside:avoid}}</style><h1>'+esc(data.scope.product||data.scope.bid)+'</h1><p>Expediente de trazabilidad · '+esc(data.scope.tenant)+' · '+esc(data.scope.bid)+'</p><p>Eventos desde '+esc(data.filters.from)+' hasta '+esc(data.filters.to)+' (fin excluido, UTC). Consultado: '+esc(data.observedAt)+'</p><aside>Los eventos EPCIS son declaraciones externas. No prueban autenticidad NFC, ubicación actual ni composición vigente de un pallet. Se exportan '+data.events.length+' eventos visibles'+(data.hasMoreEvents?'; hay más resultados: reducir el período.':'.')+'</aside><table><thead><tr><th>Fecha declarada</th><th>Tipo / acción</th><th>Paso</th><th>Referencia</th></tr></thead><tbody>'+data.events.map(e=>'<tr><td>'+esc(e.eventTime)+'<br><small>Registrado '+esc(e.recordTime)+'</small></td><td>'+esc(TRACE_LABELS[e.type])+'<br>'+esc(actionLabel(e))+(e.hasErrorDeclaration?'<br>DECLARADO EN ERROR':'')+'</td><td>'+esc(e.bizStep||'No informado')+'</td><td>'+esc(e.id)+'</td></tr>').join('')+'</tbody></table><h2>Envíos vinculados por precinto</h2><p>Estado del módulo logístico al consultar, independiente del período EPCIS. La vinculación no identifica el contenido de la caja.</p>'+data.shipments.map(s=>'<p>'+esc(s.shipment_code)+' · '+esc(s.status)+' · '+s.linked_seals+' precintos vinculados</p>').join('')+'<small>Exportación autónoma sin recursos remotos. Conservá el JSON para revisar fuentes y límites.</small></html>';
}
export function traceVocabulary(value:string){
 const labels:Record<string,string>={
 'https://ref.gs1.org/cbv/BizStep-packing':'Embalaje',
 'https://ref.gs1.org/cbv/BizStep-unpacking':'Desembalaje',
 'https://ref.gs1.org/cbv/BizStep-shipping':'Despacho',
 'https://ref.gs1.org/cbv/BizStep-receiving':'Recepción',
 'https://ref.gs1.org/cbv/BizStep-commissioning':'Alta de identificación',
 'https://ref.gs1.org/cbv/BizStep-storing':'Almacenamiento',
 'https://ref.gs1.org/cbv/Disp-in_transit':'En tránsito',
 'https://ref.gs1.org/cbv/Disp-in_progress':'En proceso',
 'https://ref.gs1.org/cbv/Disp-active':'Activo',
 'https://ref.gs1.org/cbv/Disp-recalled':'Retiro declarado',
 };
 return labels[value]||value||'No informado';
}
export function traceShipmentStatus(value:string){return ({DRAFT:'Borrador',draft:'Borrador',CREATED:'Creado',IN_TRANSIT:'En tránsito',DELIVERED_CLOSED:'Entregado con precinto cerrado',DELIVERED_OPENED:'Entregado con precinto abierto',QUARANTINED:'En cuarentena'} as Record<string,string>)[value]||value;}
