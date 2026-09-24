import {checkAdminWithPermission,getAdminPrincipal}from"./auth";
import{sql}from"./db";
import{auditFreeformContainsSecret}from"./audit-freeform-secret-policy";
import{readBoundedJsonBody,RequestBodyTooLargeError}from"./bounded-request-body";
import{SupplierRequestError,parseSupplierRequestId,parseSupplierRequestIdempotencyKey}from"./supplier-request-contract";
import{resolveSupplierRequestScope}from"./supplier-request-store";
import{DELIVERY_ACK_PROTOCOL as protocol,parseDeliveryAckCommand,parseDeliveryAckState,ACK_UUID,type DeliveryAckCommand}from"./supplier-delivery-ack-policy";
const defaults={authorize:checkAdminWithPermission,principal:getAdminPrincipal,query:sql,enabled:()=>process.env.SUPPLIER_DELIVERY_ACK_ENABLED==="true"};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store, max-age=0","referrer-policy":"no-referrer"}});
const codes:Record<string,number>={supplier_request_not_found:404,supplier_delivery_ack_scope_forbidden:403,supplier_delivery_ack_request_changed:409,supplier_delivery_ack_revision_conflict:409,supplier_delivery_ack_idempotency_conflict:409,supplier_delivery_ack_source_changed:409,supplier_delivery_ack_artifact_changed:409,supplier_delivery_ack_transition_invalid:409};
export function makeSupplierDeliveryAckHandlers(overrides:Partial<typeof defaults>={}){
 const deps={...defaults,...overrides};
 async function handle(req:Request,rawId:string,write:boolean){try{
  const auth=await deps.authorize(req,"supplier_order.create");if(auth){const out=json({ok:false,protocol,reason:auth.status===401?"supplier_request_unauthorized":auth.status===403?"supplier_delivery_ack_scope_forbidden":"supplier_delivery_ack_unavailable"},auth.status);for(const h of ['retry-after','x-nexid-auth-outcome']){const v=auth.headers.get(h);if(v)out.headers.set(h,v);}return out;}
  const enabled=deps.enabled(),principal=deps.principal(req);
  if(write&&principal.scope!=="super_admin")throw new SupplierRequestError('supplier_delivery_ack_scope_forbidden',403);
  if(write&&!enabled)throw new SupplierRequestError('supplier_delivery_ack_disabled',503);
  const params=new URL(req.url).searchParams,id=parseSupplierRequestId(rawId);
  if([...params.keys()].some(k=>!['tenant',...(!write?['before_revision']:[])].includes(k)||params.getAll(k).length!==1))throw new SupplierRequestError('supplier_delivery_ack_query_invalid');
  const raw=params.get('before_revision'),before=raw===null?null:/^[1-9][0-9]{0,9}$/.test(raw)&&Number(raw)<=2147483646?Number(raw):NaN;
  if(Number.isNaN(before))throw new SupplierRequestError('supplier_delivery_ack_query_invalid');
  const scope=await resolveSupplierRequestScope(params.get('tenant'),principal,false,deps.query),actor=parseSupplierRequestId(principal.userId),session=parseSupplierRequestId(principal.sessionId);
  const[cap]=await deps.query`SELECT to_regprocedure('public.nexid_mutate_supplier_delivery_ack_v1(jsonb)') IS NOT NULL
   AND to_regprocedure('public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer)') IS NOT NULL
   AND COALESCE(has_function_privilege(current_user,to_regprocedure('public.nexid_mutate_supplier_delivery_ack_v1(jsonb)'),'EXECUTE'),false)
   AND COALESCE(has_function_privilege(current_user,to_regprocedure('public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer)'),'EXECUTE'),false) AS available`;
  if(cap?.available!==true)throw new SupplierRequestError('supplier_delivery_ack_unavailable',503);
  let command:DeliveryAckCommand|undefined,key:string|undefined,row:Record<string,unknown>|undefined;
  if(write){key=parseSupplierRequestIdempotencyKey(req.headers.get('idempotency-key'));
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new SupplierRequestError('supplier_delivery_ack_body_invalid',415);
   let raw:unknown;try{raw=await readBoundedJsonBody(req,16*1024);}catch(error){throw new SupplierRequestError(error instanceof RequestBodyTooLargeError?'supplier_delivery_ack_body_too_large':'supplier_delivery_ack_body_invalid',error instanceof RequestBodyTooLargeError?413:400);}
   try{command=parseDeliveryAckCommand(raw);}catch{throw new SupplierRequestError('supplier_delivery_ack_input_invalid');}
   if([command.reason,command.evidence_ref].some(auditFreeformContainsSecret))throw new SupplierRequestError('supplier_request_secret_content_rejected');
   const input={...command,tenant_id:scope.tenant_id,request_id:id,actor_id:actor,auth_session_id:session,idempotency_key:key};
   [row]=await deps.query`SELECT public.nexid_mutate_supplier_delivery_ack_v1(${JSON.stringify(input)}::jsonb) AS result`;
  }else[row]=await deps.query`SELECT public.nexid_supplier_delivery_ack_read_v1(${id}::uuid,${scope.tenant_id}::uuid,${actor}::uuid,${session}::uuid,${before}::integer) AS result`;
  const result=row?.result as Record<string,any>|undefined;if(!result&&!write)throw new SupplierRequestError('supplier_request_not_found',404);
  if(!result||typeof result!=='object'||Array.isArray(result))throw Error();
  if(result.ok===false){if(!Object.hasOwn(codes,result.reason))throw Error();throw new SupplierRequestError(result.reason,codes[result.reason]);}
  if(write&&result.ok!==true||result.tenant_id!==scope.tenant_id||result.tenant_slug!==scope.tenant_slug)throw Error();
  const data=parseDeliveryAckState(result,{id,orderId:command?.order_id||parseSupplierRequestId(result.order_id)},before);
  const base={ok:true,protocol,scope,writes_enabled:enabled,...data};if(!write)return json(base);
  const receipt=result.receipt;
  if(typeof result.idempotent_replay!=='boolean'||!receipt||receipt.idempotency_key!==key||receipt.action!==command!.action
   ||receipt.revision!==command!.expected_revision+1||receipt.revision>data.revision||typeof receipt.event_id!=='string'||!ACK_UUID.test(receipt.event_id)
   ||data.request_revision!==command!.expected_request_revision)throw Error();
  if(!result.idempotent_replay){if(receipt.revision!==data.revision||receipt.event_id!==data.current?.id||data.current?.actor_id!==actor||data.current?.action!==command!.action||data.current?.reason!==command!.reason)throw Error();
   for(const k of ['order_id','dispatch_id','binding_id','artifact_id','artifact_hash','reported_hash','evidence_ref'] as const)if(data.current?.[k]!==command![k])throw Error();}
  return json({...base,idempotent_replay:result.idempotent_replay,receipt:{idempotency_key:key,event_id:receipt.event_id,action:receipt.action,revision:receipt.revision}});
 }catch(error){if(error instanceof SupplierRequestError)return json({ok:false,protocol,reason:error.message},error.status);return json({ok:false,protocol,reason:'supplier_delivery_ack_unavailable'},503);}}
 return{get:(req:Request,id:string)=>handle(req,id,false),post:(req:Request,id:string)=>handle(req,id,true)};
}
