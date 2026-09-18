export const RECALL_PROTOCOL='nexid.batch-recalls.v1';
export const RECALL_ACTIONS=['create','save','submit','revise','publish','acknowledge','account','request_close','resume','close','cancel'] as const;
export type RecallAction=typeof RECALL_ACTIONS[number];
export type RecallActor={id:string;label:string;canRead:boolean;canWrite:boolean;canPublish:boolean;canExport:boolean};
export type RecallDocument={kind:'recall'|'quarantine';title:string;reason:string;publicMessage:string;instructions:string;contact:string;unitLabel:string;destinations:{id:string;recipient:string;assigneeId:string;units:number}[]};
export class RecallError extends Error {constructor(public code:string,public status=409){super(code);}}
export function recallId(v:unknown):string{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))throw new RecallError('recall_id_invalid',400);return v.toLowerCase();}
export function recallText(v:unknown,min:number,max:number){if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new RecallError('recall_text_invalid',400);return v.trim();}
function object(v:unknown,keys:string[]){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new RecallError('recall_field_not_allowed',400);return v as Record<string,unknown>;}
export function recallDocument(input:unknown):RecallDocument{
 const d=object(input,['kind','title','reason','publicMessage','instructions','contact','unitLabel','destinations']);
 if(d.kind!=='recall'&&d.kind!=='quarantine')throw new RecallError('recall_kind_invalid',400);
 if(!Array.isArray(d.destinations)||d.destinations.length<1||d.destinations.length>50)throw new RecallError('recall_destinations_required',400);
 const seen=new Set<string>();let total=0;
 const destinations=d.destinations.map(v=>{const r=object(v,['id','recipient','assigneeId','units']),id=recallId(r.id),assigneeId=recallId(r.assigneeId);if(seen.has(id))throw new RecallError('recall_destination_duplicate',400);seen.add(id);if(typeof r.units!=='number'||!Number.isSafeInteger(r.units)||r.units<1||r.units>10000000)throw new RecallError('recall_units_invalid',400);total+=r.units;return {id,recipient:recallText(r.recipient,2,160),assigneeId,units:r.units};});
 if(total>100000000)throw new RecallError('recall_units_invalid',400);
 return {kind:d.kind,title:recallText(d.title,5,160),reason:recallText(d.reason,10,2000),publicMessage:recallText(d.publicMessage,10,600),instructions:recallText(d.instructions,10,1000),contact:recallText(d.contact,3,200),unitLabel:recallText(d.unitLabel,2,40),destinations};
}
export function recallCommand(action:string,raw:unknown){
 if(!(RECALL_ACTIONS as readonly string[]).includes(action))throw new RecallError('recall_action_invalid',400);
 const allowed=['operationId','caseId','expectedVersion'];
 if(['create','save'].includes(action))allowed.push('document');
 if(['revise','request_close','resume','close','cancel','acknowledge','account'].includes(action))allowed.push('reason');
 if(['acknowledge','account'].includes(action))allowed.push('destinationId','evidenceReference');
 if(action==='account')allowed.push('returnedUnits','heldUnits');
 const c=object(raw,allowed),operationId=recallId(c.operationId),caseId=recallId(c.caseId);
 if(typeof c.expectedVersion!=='number'||!Number.isSafeInteger(c.expectedVersion)||c.expectedVersion<0||c.expectedVersion>1000000||(action==='create'&&c.expectedVersion!==0))throw new RecallError('recall_revision_invalid',400);
 const result:Record<string,any>={operationId,caseId,expectedVersion:c.expectedVersion,action};
 if(allowed.includes('document'))result.document=recallDocument(c.document);
 if(allowed.includes('reason'))result.reason=recallText(c.reason,10,1000);
 if(allowed.includes('destinationId')){result.destinationId=recallId(c.destinationId);result.evidenceReference=recallText(c.evidenceReference,5,400);}
 if(action==='account'){for(const field of ['returnedUnits','heldUnits']){const n=c[field];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>10000000)throw new RecallError('recall_units_invalid',400);result[field]=n;}}
 return result;
}
export function requireRecallAction(actor:RecallActor,action:RecallAction){if(!actor.canRead||!actor.canWrite||(['publish','close'].includes(action)&&!actor.canPublish))throw new RecallError('recall_action_forbidden',403);}
export function recallTotals(document:RecallDocument,progress:Record<string,any>){
 let total=0,returned=0,held=0,acknowledged=0;
 for(const d of document.destinations){const p=progress[d.id]||{};total+=d.units;returned+=p.returnedUnits||0;held+=p.heldUnits||0;if(p.acknowledgedAt)acknowledged++;}
 return {declaredUnits:total,returnedUnits:returned,heldUnits:held,pendingUnits:total-returned-held,acknowledgedDestinations:acknowledged,totalDestinations:document.destinations.length,basis:'operator_declared' as const};
}
export function recallFailure(e:unknown){if(e instanceof RecallError)return {reason:e.code,status:e.status};const message=e instanceof Error?e.message:'';if(/^recall_[a-z_]+$/.test(message))return {reason:message,status:/forbidden|independent/.test(message)?403:/not_found/.test(message)?404:409};return {reason:'recall_service_unavailable',status:503};}
