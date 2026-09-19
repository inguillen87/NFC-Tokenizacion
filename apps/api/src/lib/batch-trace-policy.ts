import {parseGs1DigitalLinkUri,gs1IdentityKey} from './gs1-digital-link-registry';
export const TRACE_PROTOCOL='nexid.batch-trace.v1';
export const TRACE_TYPES=['ObjectEvent','AggregationEvent','TransactionEvent','TransformationEvent','AssociationEvent'] as const;
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export class TraceError extends Error{constructor(public code:string,public status=400){super(code);}}
export type TraceFilters={from:string;to:string;eventType:string;identityId:string};
function day(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new TraceError('trace_date_invalid');return value;}
export function traceFilters(search:URLSearchParams,now=Date.now()):TraceFilters{
 for(const key of search.keys())if(!['tenant','from','to','eventType','identityId'].includes(key)||search.getAll(key).length!==1)throw new TraceError('trace_filter_invalid');
 const end=new Date(now+86400000).toISOString().slice(0,10),start=new Date(now-29*86400000).toISOString().slice(0,10);
 const from=day(search.get('from')||start),to=day(search.get('to')||end),span=Date.parse(to)-Date.parse(from);
 if(span<=0||span>93*86400000)throw new TraceError('trace_period_1_to_93_days');
 const eventType=search.get('eventType')||'',identityId=search.get('identityId')||'';
 if(eventType&&!TRACE_TYPES.includes(eventType as any))throw new TraceError('trace_event_type_invalid');
 if(identityId&&!UUID.test(identityId))throw new TraceError('trace_identity_invalid');
 return {from,to,eventType,identityId};
}
function text(value:unknown,max=512){if(value==null)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new TraceError('trace_stored_value_invalid',503);return value;}
function instant(value:unknown){const d=value instanceof Date?value:new Date(String(value));if(!Number.isFinite(d.getTime()))throw new TraceError('trace_stored_time_invalid',503);return d.toISOString();}
export function traceEvent(row:Record<string,any>){
 if(!UUID.test(row.id)||!TRACE_TYPES.includes(row.event_type))throw new TraceError('trace_stored_event_invalid',503);
 return {id:row.id,clientEventId:text(row.client_event_id),type:row.event_type,eventTime:instant(row.event_time),recordTime:instant(row.record_time),offset:text(row.event_time_zone_offset,6),action:text(row.action,10),bizStep:text(row.biz_step),disposition:text(row.disposition),readPoint:text(row.read_point),bizLocation:text(row.biz_location),linkedIdentifiers:Number(row.linked_count),hasErrorDeclaration:row.has_error===true,evidence:'external_declaration' as const};
}
export type TraceIdentity={id:string;batchId:string;bid:string;gtin:string;lot:string;serial:string;status:string;roles:string[];quantities:{role:string;value:number|null;uom:string|null}[]};
/** Interpret this event only. Never infer present containment, location or seal status. */
export function traceRelations(fields:Record<string,unknown>,rows:Record<string,any>[]){
 if(rows.length>100)throw new TraceError('trace_event_identifiers_over_limit',503);
 const identities:TraceIdentity[]=rows.map(r=>({id:text(r.id,36),batchId:text(r.batch_id,36),bid:text(r.bid,160),gtin:text(r.gtin,14),lot:text(r.lot,20),serial:text(r.serial,20),status:text(r.status,20),roles:[],quantities:[]}));
 const byKey=new Map(identities.map(i=>[gs1IdentityKey(i),i]));let unmapped=0,entries=0;
 function assign(raw:unknown,role:string,quantity?:Record<string,unknown>){
  if(++entries>500)throw new TraceError('trace_event_shape_over_limit',503);
  let target:TraceIdentity|undefined;
  try{target=byKey.get(gs1IdentityKey(parseGs1DigitalLinkUri(raw)));}catch{}
  if(!target){unmapped++;return;}
  if(!target.roles.includes(role))target.roles.push(role);
  if(quantity){const q=quantity.quantity;if(q!=null&&(typeof q!=='number'||!Number.isFinite(q)||q<0))throw new TraceError('trace_quantity_invalid',503);target.quantities.push({role,value:q==null?null:q as number,uom:quantity.uom==null?null:text(quantity.uom,12)});}
 }
 for(const [key,role] of [['epcList','object'],['childEPCs','child'],['inputEPCList','input'],['outputEPCList','output']] as const){
  const list=fields[key];if(list==null)continue;if(!Array.isArray(list)||list.length>100)throw new TraceError('trace_event_shape_invalid',503);for(const value of list)assign(value,role);
 }
 if(fields.parentID!=null)assign(fields.parentID,'parent');
 for(const [key,role] of [['quantityList','object'],['childQuantityList','child'],['inputQuantityList','input'],['outputQuantityList','output']] as const){
  const list=fields[key];if(list==null)continue;if(!Array.isArray(list)||list.length>100)throw new TraceError('trace_event_shape_invalid',503);for(const q of list){if(!q||typeof q!=='object'||Array.isArray(q))throw new TraceError('trace_quantity_invalid',503);assign(q.epcClass,role,q);}
 }
 return {identities,unmappedReferences:unmapped,interpretation:'selected_event_only' as const};
}
export function traceFailure(e:unknown){return e instanceof TraceError?{reason:e.code,status:e.status}:{reason:'trace_source_unavailable',status:503};}
