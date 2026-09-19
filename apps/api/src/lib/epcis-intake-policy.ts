import {createHash} from 'node:crypto';
import {validateEpcisDocument,EpcisError} from './epcis';
export const INTAKE_PROTOCOL='nexid.epcis-intake.v1';
export const INTAKE_MAX_BYTES=100000;
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export class IntakeError extends Error{constructor(public code:string,public status=400,public row:number|null=null){super(code);}}
export function intakeCapabilities(role:string,has:(name:string)=>boolean,denied:(name:string)=>boolean,mfa:boolean){
 const human=['super-admin','tenant-owner','tenant-admin','operations-manager'].includes(role);
 const canRead=human&&has('batches:read')&&has('logistics:read')&&!denied('epcis.import');
 return {canRead,canPrepare:canRead,canCommit:canRead&&mfa&&has('logistics:write')&&!denied('sdk:epcis:write'),mfaRequired:canRead&&!mfa};
}
export function stable(value:unknown):string{return Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}':JSON.stringify(value);}
export function digest(value:unknown){return createHash('sha256').update(stable(value)).digest('hex');}
const rootFields=new Set(['@context','type','schemaVersion','creationDate','id','epcisBody']);
const eventFields=new Set(['type','eventID','eventTime','eventTimeZoneOffset','action','bizStep','disposition','readPoint','bizLocation','epcList','parentID','childEPCs','quantityList','childQuantityList','inputEPCList','outputEPCList','inputQuantityList','outputQuantityList','transformationID']);
export function intakeDocument(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw),'utf8')>INTAKE_MAX_BYTES)throw new IntakeError('intake_document_size_or_type',413);
 const doc=raw as Record<string,any>;
 if(Object.keys(doc).some(k=>!rootFields.has(k))||!doc.epcisBody||Object.keys(doc.epcisBody).some(k=>k!=='eventList'))throw new IntakeError('intake_document_fields_unsupported',422);
 if(!Array.isArray(doc.epcisBody.eventList)||doc.epcisBody.eventList.length<1||doc.epcisBody.eventList.length>50)throw new IntakeError('intake_1_to_50_events',422);
 function nested(value:unknown,allowed:string[],row:number){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new IntakeError('intake_event_fields_unsupported',422,row);}
 doc.epcisBody.eventList.forEach((event:any,index:number)=>{if(!event||typeof event!=='object')return;for(const key of ['readPoint','bizLocation'])if(event[key]!=null)nested(event[key],['id'],index+1);for(const key of ['quantityList','childQuantityList','inputQuantityList','outputQuantityList'])if(Array.isArray(event[key]))for(const item of event[key])nested(item,['epcClass','quantity','uom'],index+1);});
 const seen=new Set();
 doc.epcisBody.eventList.forEach((e:any,index:number)=>{if(!e||typeof e!=='object'||Object.keys(e).some(k=>!eventFields.has(k)))throw new IntakeError('intake_event_fields_unsupported',422,index+1);if(typeof e.eventID!=='string'||!e.eventID||seen.has(e.eventID))throw new IntakeError('intake_unique_event_id_required',422,index+1);seen.add(e.eventID);if(typeof e.eventTime!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(e.eventTime)||!Number.isFinite(Date.parse(e.eventTime))||new Date(e.eventTime.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==e.eventTime.slice(0,10))throw new IntakeError('intake_event_time_with_zone_required',422,index+1);});
 try{return validateEpcisDocument(doc);}catch(e){if(e instanceof EpcisError)throw new IntakeError(e.code,e.status,e.detail&&typeof e.detail==='object'&&'index' in e.detail&&typeof e.detail.index==='number'?e.detail.index+1:null);throw e;}
}
export function intakeReference(value:unknown){if(typeof value!=='string'||value.trim().length<4||value.length>160||/[\u0000-\u001f\u007f]/.test(value))throw new IntakeError('intake_reference_required');return value.trim();}
