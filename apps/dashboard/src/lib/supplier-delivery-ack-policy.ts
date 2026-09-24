export const DELIVERY_ACK_PROTOCOL = "nexid.supplier-delivery-ack.v1";
export const ACK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ACK_HASH = /^sha256:[0-9a-f]{64}$/;
const fail = ():never => {throw Error("supplier_delivery_ack_contract_invalid");};
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:fail();
const uuid=(v:unknown)=>typeof v==='string'&&ACK_UUID.test(v)?v.toLowerCase():fail();
const hash=(v:unknown)=>typeof v==='string'&&ACK_HASH.test(v)?v:fail();
const integer=(v:unknown,min=0)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=2147483646?Number(v):fail();
const text=(v:unknown,max:number,multi=false)=>typeof v==='string'&&v.trim()&&v.length<=max&&!(multi?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(v)?v.trim():fail();
const stamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():fail();
export type DeliveryAckAction='received'|'issue'|'withdraw';
export type DeliveryAckCommand={action:DeliveryAckAction;expected_revision:number;expected_request_revision:number;order_id:string;dispatch_id:string;binding_id:string;artifact_id:string;artifact_hash:string;reported_hash:string|null;evidence_ref:string;reason:string};
const fields=['action','expected_revision','expected_request_revision','order_id','dispatch_id','binding_id','artifact_id','artifact_hash','reported_hash','evidence_ref','reason'];
export function parseDeliveryAckCommand(value:unknown):DeliveryAckCommand{
 const v=obj(value);if(Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k))||!['received','issue','withdraw'].includes(v.action)||v.expected_revision===2147483646)return fail();
 const artifact_hash=hash(v.artifact_hash),reported_hash=v.reported_hash===null?null:hash(v.reported_hash);
 if(v.action==='received'&&reported_hash!==artifact_hash||v.action==='withdraw'&&reported_hash!==null)return fail();
 return {action:v.action,expected_revision:integer(v.expected_revision),expected_request_revision:integer(v.expected_request_revision,1),order_id:uuid(v.order_id),dispatch_id:uuid(v.dispatch_id),binding_id:uuid(v.binding_id),artifact_id:uuid(v.artifact_id),artifact_hash,reported_hash,evidence_ref:text(v.evidence_ref,240),reason:text(v.reason,1000,true)};
}
export type DeliveryAckEvent=Omit<DeliveryAckCommand,'expected_revision'|'expected_request_revision'>&{id:string;revision:number;request_revision:number;actor_id:string;created_at:string;source:'nexid_manual_record';supplier_authenticated:false;download_verified:false;decryption_verified:false;physical_received:false};
export function parseDeliveryAckEvent(value:unknown):DeliveryAckEvent{
 const v=obj(value),command=parseDeliveryAckCommand(Object.fromEntries(fields.map(k=>[k,k==='expected_revision'?integer(v.revision,1)-1:k==='expected_request_revision'?v.request_revision:v[k]])));
 if(v.source!=='nexid_manual_record'||['supplier_authenticated','download_verified','decryption_verified','physical_received'].some(k=>v[k]!==false))return fail();
 const {expected_revision,expected_request_revision,...body}=command;return {...body,id:uuid(v.id),revision:expected_revision+1,request_revision:expected_request_revision,actor_id:uuid(v.actor_id),created_at:stamp(v.created_at),source:'nexid_manual_record',supplier_authenticated:false,download_verified:false,decryption_verified:false,physical_received:false};
}
export type DeliveryAckArtifact={id:string;hash:string;created_at:string};
export type DeliveryAckSource={dispatch_id:string;binding_id:string;supplier_ref:string;supplier_name:string;spec_revision:number;spec_hash:string;sent_at:string};
export type DeliveryAckState={request_id:string;request_revision:number;order_id:string;source:DeliveryAckSource|null;artifacts:DeliveryAckArtifact[];artifacts_count:number;artifacts_truncated:boolean;revision:number;current:DeliveryAckEvent|null;history:DeliveryAckEvent[];count:number;truncated:boolean;next_before_revision:number|null;as_of:string};
export function parseDeliveryAckState(value:unknown,expected:{id:string;orderId:string},before:number|null=null):DeliveryAckState{
 const v=obj(value),id=uuid(v.request_id),order=uuid(v.order_id),rr=integer(v.request_revision,1),rev=integer(v.revision);if(id!==expected.id||order!==expected.orderId)return fail();
 let source:DeliveryAckSource|null=null;
 if(v.source!==null){const s=obj(v.source);source={dispatch_id:uuid(s.dispatch_id),binding_id:uuid(s.binding_id),supplier_ref:text(s.supplier_ref,128),supplier_name:text(s.supplier_name,200),spec_revision:integer(s.spec_revision,1),spec_hash:hash(s.spec_hash),sent_at:stamp(s.sent_at)};}
 if(!Array.isArray(v.artifacts)||v.artifacts.length>52||v.artifacts_count!==v.artifacts.length||typeof v.artifacts_truncated!=='boolean'||!source&&v.artifacts.length)return fail();
 const artifacts=v.artifacts.map((x:any)=>({id:uuid(x.id),hash:hash(x.hash),created_at:stamp(x.created_at)}));
 if(new Set(artifacts.map((x:DeliveryAckArtifact)=>x.id)).size!==artifacts.length||artifacts.some((x:DeliveryAckArtifact)=>source&&Date.parse(x.created_at)>Date.parse(source.sent_at)))return fail();
 const current=v.current===null?null:parseDeliveryAckEvent(v.current);if((rev===0)!==(current===null)||current&&(current.revision!==rev||current.order_id!==order||current.request_revision!==rr))return fail();
 if(!Array.isArray(v.history)||v.history.length>50||v.count!==v.history.length||typeof v.truncated!=='boolean')return fail();
 const history=v.history.map(parseDeliveryAckEvent),seen=new Set<string>();for(let i=0;i<history.length;i++){const h=history[i];if(seen.has(h.id)||h.order_id!==order||h.request_revision!==rr||h.revision>rev||before!==null&&h.revision>=before||i>0&&h.revision!==history[i-1].revision+1)return fail();seen.add(h.id);}
 if(before===null&&rev>0&&(!history.length||JSON.stringify(history.at(-1))!==JSON.stringify(current)))return fail();
 const next=v.next_before_revision===null?null:integer(v.next_before_revision,1);if(v.truncated!==(next!==null)||next!==null&&(next!==history[0]?.revision||next<=1)||history.length&&history[0].revision>1&&!v.truncated)return fail();
 return{request_id:id,request_revision:rr,order_id:order,source,artifacts,artifacts_count:artifacts.length,artifacts_truncated:v.artifacts_truncated,revision:rev,current,history,count:history.length,truncated:next!==null,next_before_revision:next,as_of:stamp(v.as_of)};
}
