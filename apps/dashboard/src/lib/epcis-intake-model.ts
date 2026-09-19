export const INTAKE_PROTOCOL='nexid.epcis-intake.v1';
export type IntakeScope={tenant:string;tenantId:string;batchId:string;bid:string;product:string;carrier:string|null};
export type IntakeIdentity={id:string;gtin:string;lot:string;serial:string};
export type IntakeReceipt={captureId:string;documentRecordId:string;operationId:string;actorId:string;reference:string;eventCount:number;projectionCount:number;at:string;documentDigest:string;replayed:boolean;evidence:'declared_business_event'};
export type IntakeBoard={ok:true;protocol:typeof INTAKE_PROTOCOL;source:'database';scope:IntakeScope;identityCount:number;identities:IntakeIdentity[];receipts:IntakeReceipt[];capabilities:{canRead:boolean;canPrepare:boolean;canCommit:boolean;mfaRequired:boolean}};
export type IntakePreview={ok:true;protocol:typeof INTAKE_PROTOCOL;source:'database';scope:IntakeScope;ready:boolean;previewDigest:string;documentDigest:string;eventCount:number;projectionCount:number;webhookEndpoints:number;events:{row:number;id:string;type:string;time:string;action:string;step:string;existing:boolean;identities:(IntakeIdentity&{bid:string})[]}[]};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
function check(v:unknown){if(!v)throw Error('La respuesta no corresponde al lote ni al contrato esperado.');}
export function validateReceipt(r:IntakeReceipt){
 check(r&&UUID.test(r.captureId)&&UUID.test(r.documentRecordId)&&UUID.test(r.operationId)&&UUID.test(r.actorId)&&HASH.test(r.documentDigest));
 check(Number.isFinite(Date.parse(r.at))&&Number.isInteger(r.eventCount)&&r.eventCount>0&&r.eventCount<=50&&Number.isInteger(r.projectionCount)&&r.projectionCount>0&&r.projectionCount<=100);
 check(r.evidence==='declared_business_event'&&typeof r.replayed==='boolean'&&typeof r.reference==='string'&&r.reference.length<=160);return r;
}
function scoped(r:any,bid:string,tenant:string){check(r?.ok===true&&r.protocol===INTAKE_PROTOCOL&&r.scope?.bid===bid&&(!tenant||r.scope.tenant===tenant)&&UUID.test(r.scope.batchId)&&UUID.test(r.scope.tenantId));}
export function parseIntakeBoard(raw:unknown,bid:string,tenant:string){
 const r=raw as IntakeBoard;scoped(r,bid,tenant);check(r.source==='database'&&Array.isArray(r.identities)&&r.identities.length<=100&&Array.isArray(r.receipts)&&r.receipts.length<=15&&Number.isInteger(r.identityCount)&&r.identityCount>=0);
 for(const v of Object.values(r.capabilities||{}))check(typeof v==='boolean');check(typeof r.capabilities?.canRead==='boolean'&&typeof r.capabilities?.canCommit==='boolean');
 for(const i of r.identities)check(UUID.test(i.id)&&/^\d{14}$/.test(i.gtin)&&typeof i.lot==='string'&&typeof i.serial==='string');r.receipts.forEach(validateReceipt);return r;
}
export function parseIntakePreview(raw:unknown,bid:string,tenant:string){
 const r=raw as IntakePreview;scoped(r,bid,tenant);check(r.source==='database'&&typeof r.ready==='boolean'&&HASH.test(r.previewDigest)&&HASH.test(r.documentDigest)&&Array.isArray(r.events)&&r.events.length===r.eventCount&&r.eventCount>0&&r.eventCount<=50&&Number.isInteger(r.projectionCount)&&r.projectionCount>0&&r.projectionCount<=100);
 for(const e of r.events)check(typeof e.id==='string'&&Number.isFinite(Date.parse(e.time))&&typeof e.existing==='boolean'&&Array.isArray(e.identities)&&e.identities.length<=100);return r;
}
export function parseIntakeCommit(raw:unknown,scope:IntakeScope,operationId:string,hash:string){const r=raw as {ok:boolean;protocol:string;scope:IntakeScope;receipt:IntakeReceipt};scoped(r,scope.bid,scope.tenant);check(r.scope.batchId===scope.batchId&&r.receipt?.operationId===operationId&&r.receipt.documentDigest===hash);return validateReceipt(r.receipt);}
export function parseDocumentText(text:string){if(new TextEncoder().encode(text).length>100000)throw Error('El archivo supera 100 kB. Dividilo en documentos de hasta 50 eventos.');let data;try{data=JSON.parse(text);}catch{throw Error('El archivo no contiene JSON válido.');}if(!data||data.type!=='EPCISDocument'||data.schemaVersion!=='2.0'||!Array.isArray(data.epcisBody?.eventList)||data.epcisBody.eventList.length<1||data.epcisBody.eventList.length>50)throw Error('Se requiere un EPCISDocument 2.0 con 1 a 50 eventos.');return data;}
export async function guidedEpcis(tenant:string,identity:IntakeIdentity,reference:string,when:string,step:string){
 if(reference.trim().length<4||reference.length>160||!when||!['receiving','shipping','storing'].includes(step))throw Error('Completá identidad, referencia única, fecha y tipo de movimiento.');
 const date=new Date(when);if(!Number.isFinite(date.getTime()))throw Error('La fecha ingresada no es válida.');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tenant+'\0'+reference.trim()));
 const hash=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const offset=-date.getTimezoneOffset(),zone=(offset<0?'-':'+')+String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')+':'+String(Math.abs(offset)%60).padStart(2,'0');
 const uri='https://nexid.lat/01/'+identity.gtin+(identity.lot?'/10/'+encodeURIComponent(identity.lot):'')+(identity.serial?'/21/'+encodeURIComponent(identity.serial):'');
 return {'@context':'https://ref.gs1.org/standards/epcis/epcis-context.jsonld',type:'EPCISDocument',schemaVersion:'2.0',id:'urn:nexid:operator-document:'+hash,epcisBody:{eventList:[{type:'ObjectEvent',eventID:'urn:nexid:operator-event:'+hash,eventTime:date.toISOString(),eventTimeZoneOffset:zone,action:'OBSERVE',bizStep:step,epcList:[uri]}]}};
}
export const INTAKE_TYPES:Record<string,string>={ObjectEvent:'Observación',AggregationEvent:'Agrupación',TransformationEvent:'Transformación',AssociationEvent:'Asociación',TransactionEvent:'Relación comercial'};
