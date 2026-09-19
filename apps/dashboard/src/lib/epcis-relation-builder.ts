import type {IntakeScope,IntakePreview} from './epcis-intake-model';
export const MAX_RELATION_CHILDREN=49;
export type RegisteredUnit={id:string;batchId:string;bid:string;gtin:string;lot:string;serial:string;product:string};
export type RelationDraft={action:'ADD'|'DELETE'|'OBSERVE';parent:RegisteredUnit|null;children:RegisteredUnit[]};
export const emptyRelation:RelationDraft={action:'ADD',parent:null,children:[]};
export type IdentitySearch={ok:true;protocol:'nexid.epcis-identities.v1';source:'database';scope:IntakeScope;query:{area:'batch'|'company';term:string};items:RegisteredUnit[];hasMore:boolean;nextCursor:string|null;limit:50;observedAt:string;selectionIsNotValidation:true};
export const RELATION_COPY={ADD:{title:'Agrupar unidades',verb:'Agrupar',tag:'Agregar al contenedor',detail:'Declará qué unidades agrupaste dentro de una caja o pallet identificado.'},DELETE:{title:'Separar unidades',verb:'Separar',tag:'Retirar del contenedor',detail:'Indicá exactamente qué unidades retiraste. No borra el historial ni separa elementos no seleccionados.'},OBSERVE:{title:'Observar una agrupación',verb:'Observar',tag:'Registrar lo observado',detail:'Documentá el contenedor y las unidades observadas, sin declarar una nueva alta o baja.'}} as const;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function check(v:unknown,message='La respuesta de identidades no corresponde al alcance consultado.'):asserts v{if(!v)throw Error(message);}
export function validGtin(value:string){if(!/^\d{14}$/.test(value))return false;const sum=[...value.slice(0,13)].reduce((n,c,i)=>n+Number(c)*(i%2===0?3:1),0);return (10-sum%10)%10===Number(value[13]);}
export function registeredUnit(raw:unknown):RegisteredUnit{
 const i=raw as RegisteredUnit;check(i&&uuid.test(i.id)&&uuid.test(i.batchId)&&typeof i.bid==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(i.bid)&&validGtin(i.gtin));
 for(const field of ['lot','serial'] as const)check(typeof i[field]==='string'&&i[field].length<=20&&(!i[field]||/^[!-~]+$/.test(i[field])&&!/[\\/?#%]/.test(i[field])));
 check(i.serial.length>0&&typeof i.product==='string'&&i.product.length<=240);
 return {id:i.id,batchId:i.batchId,bid:i.bid,gtin:i.gtin,lot:i.lot,serial:i.serial,product:i.product};
}
export function parseIdentitySearch(raw:unknown,scope:IntakeScope,query:{area:'batch'|'company';term:string}):IdentitySearch{
 const r=raw as IdentitySearch;check(r?.ok===true&&r.protocol==='nexid.epcis-identities.v1'&&r.source==='database'&&r.scope?.tenant===scope.tenant&&r.scope.batchId===scope.batchId&&r.scope.bid===scope.bid&&r.query?.area===query.area&&r.query.term===query.term.trim());
 check(r.limit===50&&Array.isArray(r.items)&&r.items.length<=50&&typeof r.hasMore==='boolean'&&Number.isFinite(Date.parse(r.observedAt))&&r.selectionIsNotValidation===true);
 check(r.hasMore?typeof r.nextCursor==='string'&&/^[-_A-Za-z0-9]{1,800}$/.test(r.nextCursor):r.nextCursor===null);
 const items=r.items.map(registeredUnit);check(new Set(items.map(i=>i.id)).size===items.length);if(query.area==='batch')check(items.every(i=>i.batchId===scope.batchId));
 return {...r,scope,query:{...query,term:query.term.trim()},items};
}
export function unitUri(i:RegisteredUnit){return 'https://nexid.lat/01/'+i.gtin+(i.lot?'/10/'+encodeURIComponent(i.lot):'')+'/21/'+encodeURIComponent(i.serial);}
export function checkRelation(scope:IntakeScope,draft:RelationDraft){
 check(['ADD','DELETE','OBSERVE'].includes(draft.action),'Elegí qué ocurrió con la agrupación.');
 check(draft.parent,'Elegí la identidad del contenedor.');registeredUnit(draft.parent);
 check(draft.children.length>0&&draft.children.length<=MAX_RELATION_CHILDREN,'Seleccioná entre 1 y 49 unidades para esta declaración.');
 draft.children.forEach(registeredUnit);
 const all=[draft.parent,...draft.children],keys=all.map(unitUri);
 check(new Set(keys).size===keys.length&&new Set(all.map(i=>i.id)).size===all.length,'El contenedor no puede ser una unidad de sí mismo y no se permiten identidades repetidas.');
 check(all.some(i=>i.batchId===scope.batchId&&i.bid===scope.bid),'La declaración debe incluir al menos una identidad del lote abierto.');
 return {action:draft.action,parent:{...draft.parent},children:[...draft.children].sort((a,b)=>unitUri(a)<unitUri(b)?-1:unitUri(a)>unitUri(b)?1:0)};
}
export function localEventTime(value:string){
 check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),'Ingresá una fecha y hora local completas.');
 const date=new Date(value),parts=value.split(/[-T:]/).map(Number);
 check(Number.isFinite(date.getTime())&&date.getFullYear()===parts[0]&&date.getMonth()+1===parts[1]&&date.getDate()===parts[2]&&date.getHours()===parts[3]&&date.getMinutes()===parts[4],'La fecha u hora no existe en la zona del dispositivo.');
 const offset=-date.getTimezoneOffset(),zone=(offset<0?'-':'+')+String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')+':'+String(Math.abs(offset)%60).padStart(2,'0');
 return {eventTime:date.toISOString(),eventTimeZoneOffset:zone};
}
export async function buildRelationDocument(scope:IntakeScope,draft:RelationDraft,reference:string,when:string){
 const selected=checkRelation(scope,draft);check(typeof reference==='string'&&reference.trim().length>=4&&reference.length<=160&&!/[\u0000-\u001f\u007f]/.test(reference),'Ingresá una referencia comercial estable de 4 a 160 caracteres.');
 const time=localEventTime(when),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope.tenant+'\0'+reference.trim()));
 const hash=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const event={type:'AggregationEvent',eventID:'urn:nexid:operator-event:'+hash,...time,action:selected.action,...(selected.action==='OBSERVE'?{}:{bizStep:'https://ref.gs1.org/cbv/BizStep-'+(selected.action==='ADD'?'packing':'unpacking')}),parentID:unitUri(selected.parent),childEPCs:selected.children.map(unitUri)};
 return {'@context':'https://ref.gs1.org/standards/epcis/epcis-context.jsonld',type:'EPCISDocument',schemaVersion:'2.0',id:'urn:nexid:operator-document:'+hash,epcisBody:{eventList:[event]}};
}
export function verifyRelationPreview(p:IntakePreview,document:any,scope:IntakeScope,draft:RelationDraft){
 const chosen=checkRelation(scope,draft),expected=document?.epcisBody?.eventList?.[0],event=p.events[0];
 check(p.scope.batchId===scope.batchId&&p.eventCount===1&&p.projectionCount===chosen.children.length+1&&event?.type==='AggregationEvent'&&event.action===chosen.action&&event.id===expected?.eventID,'La revisión no corresponde a la agrupación preparada.');
 check(event.time===expected.eventTime&&expected.parentID===unitUri(chosen.parent)&&JSON.stringify(expected.childEPCs)===JSON.stringify(chosen.children.map(unitUri)),'Cambió el contenido de la agrupación preparada.');
 const ids=[chosen.parent,...chosen.children];check(event.identities.length===ids.length&&ids.every(i=>event.identities.some(j=>j.id===i.id&&j.gtin===i.gtin&&j.lot===i.lot&&j.serial===i.serial&&j.bid===i.bid)),'La revisión no confirmó todas las identidades seleccionadas.');
 return chosen;
}
