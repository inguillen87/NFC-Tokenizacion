import {parseGs1DigitalLinkUri,gs1IdentityKey} from './gs1-digital-link-registry';
export const TRACE_PROTOCOL = 'nexid.batch-traceability.v1';
export const TRACE_LIMITS = {events:50,shipments:20,custody:50,referencesPerEvent:100,days:93} as const;
export class TraceabilityError extends Error {
  constructor(public code:string,public status=400){super(code);}
}
function date(value:unknown):string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new TraceabilityError('trace_date_invalid');
  const parsed=new Date(value+'T00:00:00.000Z');
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new TraceabilityError('trace_date_invalid');
  return value;
}
export function traceWindow(from:unknown,to:unknown,now=new Date()){
  if(!from&&!to){to=now.toISOString().slice(0,10);from=new Date(Date.parse(String(to)+'T00:00:00Z')-29*86400000).toISOString().slice(0,10);}
  const start=date(from),end=date(to),days=(Date.parse(end)-Date.parse(start))/86400000+1;
  if(days<1||days>TRACE_LIMITS.days)throw new TraceabilityError('trace_window_1_to_93_days');
  return {from:start,to:end,start:start+'T00:00:00.000Z',endExclusive:new Date(Date.parse(end)+86400000).toISOString(),timezone:'UTC' as const};
}
function record(value:unknown):Record<string,any>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};}
export function traceText(value:unknown,max=180){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u001F\u007F]/.test(value))return null;
  return value;
}
export function traceTimestamp(value:unknown){
  const parsed=value instanceof Date?value:new Date(String(value));
  if(value==null||!Number.isFinite(parsed.getTime()))throw new TraceabilityError('trace_source_invalid',503);
  return parsed.toISOString();
}
/** Identifier text only; never expose query strings, credentials, dynamic SUN values or navigation links. */
export function traceLocation(value:unknown){
  const text=traceText(value,512);if(!text)return null;
  if(/^urn:[A-Za-z0-9][A-Za-z0-9:._-]{0,499}$/.test(text))return text;
  try{const url=new URL(text);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash)return url.href;}catch{}
  return null;
}
function vocabulary(value:unknown,kind:'BizStep'|'Disp'){
  const text=traceText(value,512);if(!text)return null;
  const prefixes=[`https://ref.gs1.org/cbv/${kind}-`,`urn:epcglobal:cbv:${kind==='BizStep'?'bizstep':'disp'}:`];
  const prefix=prefixes.find(p=>text.startsWith(p));const suffix=prefix?text.slice(prefix.length):text;
  return /^[a-z][a-z0-9_]{0,79}$/.test(suffix)?suffix:'other';
}
export function projectTraceEvent(row:Record<string,any>,batchId:string){
  const payload=record(row.projection),registry=Array.isArray(row.identifiers)?row.identifiers:[];
  const lookup=new Map<string,Record<string,any>>();
  for(const r of registry){if(typeof r.gtin==='string'&&typeof r.lot==='string'&&typeof r.serial==='string')lookup.set(gs1IdentityKey(r),r);}
  const references:Array<Record<string,any>>=[];let omitted=0;
  const add=(value:unknown,role:string,quantity:unknown=null,uom:unknown=null)=>{
    try{
      const identifier=parseGs1DigitalLinkUri(value),resolved=lookup.get(gs1IdentityKey(identifier));
      if(!resolved||references.length>=TRACE_LIMITS.referencesPerEvent){omitted++;return;}
      const amount=typeof quantity==='number'&&Number.isFinite(quantity)&&quantity>=0?quantity:null;
      const unit=typeof uom==='string'&&/^[A-Z0-9]{1,8}$/.test(uom)?uom:null;
      references.push({id:String(resolved.id),bid:String(resolved.bid),batchId:String(resolved.batch_id),gtin:identifier.gtin,lot:identifier.lot,serial:identifier.serial,role,quantity:amount,uom:unit,focus:resolved.batch_id===batchId});
    }catch{omitted++;}
  };
  if(payload.parentID!=null)add(payload.parentID,'parent');
  for(const [field,role] of [['epcList','object'],['childEPCs','child'],['inputEPCList','input'],['outputEPCList','output']]){
    const list=payload[field];if(Array.isArray(list)){for(const value of list.slice(0,100))add(value,role);if(list.length>100)omitted+=list.length-100;}
  }
  for(const [field,role] of [['quantityList','object'],['childQuantityList','child'],['inputQuantityList','input'],['outputQuantityList','output']]){
    const list=payload[field];if(Array.isArray(list)){for(const item of list.slice(0,100)){const value=record(item);add(value.epcClass,role,value.quantity,value.uom);}if(list.length>100)omitted+=list.length-100;}
  }
  const type=String(row.event_type),supported=['ObjectEvent','AggregationEvent','TransactionEvent','TransformationEvent','AssociationEvent'].includes(type);
  if(!supported)throw new TraceabilityError('trace_event_type_invalid',503);
  return {id:String(row.id),kind:'epcis' as const,type,action:['ADD','OBSERVE','DELETE'].includes(row.action)?row.action:null,occurredAt:traceTimestamp(row.event_time),recordedAt:traceTimestamp(row.record_time),step:vocabulary(row.biz_step,'BizStep'),disposition:vocabulary(row.disposition,'Disp'),readPoint:traceLocation(row.read_point),location:traceLocation(row.biz_location),correctionDeclared:row.correction_declared===true,references,omittedReferences:omitted,basis:'external_declaration' as const};
}
