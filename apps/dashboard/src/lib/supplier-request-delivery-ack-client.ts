import{SupplierRequestError}from"./supplier-request-client";
import{ACK_UUID,DELIVERY_ACK_PROTOCOL,parseDeliveryAckCommand,parseDeliveryAckState,type DeliveryAckCommand,type DeliveryAckState}from"./supplier-delivery-ack-policy";
export type DeliveryAckOperation=Readonly<{key:string;body:Readonly<DeliveryAckCommand>}>;
export type DeliveryAckSnapshot=DeliveryAckState & {writes_enabled:boolean;receipt?:{idempotency_key:string;event_id:string;action:'received'|'issue'|'withdraw';revision:number};idempotent_replay?:boolean};
type Scope={id:string;orderId:string;tenant:string;tenantId:string};
const bad=():never=>{throw new SupplierRequestError('supplier_delivery_ack_contract_invalid');};
export function parseSupplierDeliveryAck(payload:any,scope:Scope,command?:DeliveryAckOperation,before:number|null=null):DeliveryAckSnapshot{
 if(!payload||payload.ok!==true||payload.protocol!==DELIVERY_ACK_PROTOCOL||typeof payload.writes_enabled!=='boolean'
 ||payload.demo===true||payload.demoMode===true||payload.dataSource==='demo'||payload.scope?.mode!=='tenant'||payload.scope.tenant_id!==scope.tenantId||payload.scope.tenant_slug!==scope.tenant)return bad();
 const data=parseDeliveryAckState(payload,scope,before),base={...data,writes_enabled:payload.writes_enabled};if(!command)return base;
 const receipt=payload.receipt;
 if(typeof payload.idempotent_replay!=='boolean'||!receipt||receipt.idempotency_key!==command.key||receipt.action!==command.body.action
 ||receipt.revision!==command.body.expected_revision+1||receipt.revision>data.revision||typeof receipt.event_id!=='string'||!ACK_UUID.test(receipt.event_id)
 ||data.request_revision!==command.body.expected_request_revision||data.order_id!==command.body.order_id)return bad();
 if(!payload.idempotent_replay){if(receipt.revision!==data.revision||receipt.event_id!==data.current?.id||data.current?.action!==command.body.action||data.current.reason!==command.body.reason)return bad();
 for(const k of ['order_id','dispatch_id','binding_id','artifact_id','artifact_hash','reported_hash','evidence_ref'] as const)if(data.current?.[k]!==command.body[k])return bad();}
 return{...base,idempotent_replay:payload.idempotent_replay,receipt:{idempotency_key:receipt.idempotency_key,event_id:receipt.event_id,action:receipt.action,revision:receipt.revision}};
}
export async function supplierDeliveryAckCall(input:Scope&{command?:DeliveryAckOperation;before?:number|null;signal?:AbortSignal},fetcher:typeof fetch=fetch):Promise<DeliveryAckSnapshot>{
 if(!ACK_UUID.test(input.id)||!ACK_UUID.test(input.orderId)||!ACK_UUID.test(input.tenantId)||!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(input.tenant)
 ||(input.command&&!ACK_UUID.test(input.command.key))||(input.before!==undefined&&input.before!==null&&(!Number.isSafeInteger(input.before)||input.before<1||input.before>2147483646))||(input.command&&input.before))return bad();
 if(input.command)parseDeliveryAckCommand(input.command.body);
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);if(input.signal?.aborted)abort();else input.signal?.addEventListener('abort',abort,{once:true});
 const command=input.command;
 try{
 const query=new URLSearchParams({tenant:input.tenant});if(input.before)query.set('before_revision',String(input.before));
 const response=await fetcher(`/api/admin/supplier-requests/${input.id}/delivery-ack?${query}`,{method:command?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:controller.signal,
 headers:{Accept:'application/json',...(command?{'Content-Type':'application/json','Idempotency-Key':command.key}:{})},...(command?{body:JSON.stringify(command.body)}:{})});
 let payload:any;try{const reader=response.body?.getReader();if(!reader)throw Error();const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>256*1024){await reader.cancel();throw Error();}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();payload=JSON.parse(text);}finally{reader.releaseLock();}
 }catch{throw new SupplierRequestError('supplier_delivery_ack_contract_invalid',response.status,Boolean(command));}
 if(!response.ok){const certain=response.status<500&&response.status!==408&&payload?.ok===false&&typeof payload.reason==='string'&&/^(supplier_delivery_ack_|supplier_request_|request_body_)/.test(payload.reason);throw new SupplierRequestError(certain?payload.reason:'supplier_delivery_ack_unavailable',response.status,Boolean(command&&!certain));}
 if(response.headers.get('x-nexid-data-mode')!=='production'||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw new SupplierRequestError('supplier_delivery_ack_contract_invalid',response.status,Boolean(command));
 try{return parseSupplierDeliveryAck(payload,input,command,input.before||null);}catch{throw new SupplierRequestError('supplier_delivery_ack_contract_invalid',response.status,Boolean(command));}
 }catch(error){if(error instanceof SupplierRequestError)throw error;throw new SupplierRequestError('supplier_delivery_ack_unavailable',0,Boolean(command));}
 finally{clearTimeout(timer);input.signal?.removeEventListener('abort',abort);}
}
